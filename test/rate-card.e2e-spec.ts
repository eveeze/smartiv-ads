import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/providers/prisma/prisma.service';
import { PropertyClass, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { TransformInterceptor } from './../src/common/interceptors/transform/transform.interceptor';
import { applyBigIntSerializers } from './../src/common/utils/bigint.util';

describe('Rate Card Management (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let rateCardId: number;
  let adminId: number;

  beforeAll(async () => {
    applyBigIntSerializers();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // --- SETUP DATA ADMIN ---
    const adminEmail = 'admin.ratecard.e2e@test.com';
    const adminPassword = 'password123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // [FIX] Cleanup lebih menyeluruh sebelum mulai
    await prisma.rateCard.deleteMany({}); // Hapus semua rate card lama
    await prisma.user.deleteMany({ where: { email: adminEmail } });

    // Create Admin User di DB Test
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: 'Admin RateCard',
        role: Role.SUPER_ADMIN,
        phone: '081999888777',
      },
    });
    adminId = admin.id;

    // Login untuk mendapatkan Token
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(201);

    adminToken = loginRes.body.data?.accessToken || loginRes.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup Data Test
    await prisma.rateCard.deleteMany({});
    if (adminId) {
      await prisma.user.delete({ where: { id: adminId } }).catch(() => {});
    }
    await app.close();
  });

  it('1. Create Rate Card (Validation Error)', async () => {
    await request(app.getHttpServer())
      .post('/inventory/rate-cards')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        pricePerDay: 500000,
      })
      .expect(400)
      .expect((res) => {
        const message = JSON.stringify(res.body.message || res.body);
        expect(message).toContain(
          'propertyId is required when classification is missing',
        );
      });
  });

  it('2. Create Rate Card (Global PREMIUM Class)', async () => {
    // Pastikan bersih dulu agar tidak 409 Conflict
    await prisma.rateCard.deleteMany({
      where: { classification: PropertyClass.PREMIUM, propertyId: null },
    });

    const res = await request(app.getHttpServer())
      .post('/inventory/rate-cards')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        classification: PropertyClass.PREMIUM,
        pricePerDay: 500000,
      })
      .expect(201);

    const data = res.body.data || res.body;
    expect(data.pricePerDay).toBeDefined();
    rateCardId = data.id;
  });

  it('3. Prevent Duplicate Rate Card Configuration', async () => {
    await request(app.getHttpServer())
      .post('/inventory/rate-cards')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        classification: PropertyClass.PREMIUM,
        pricePerDay: 600000,
      })
      .expect(409); // Conflict Exception from Service
  });

  it('4. Get All Rate Cards', async () => {
    const res = await request(app.getHttpServer())
      .get('/inventory/rate-cards')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const data = res.body.data || res.body;
    expect(Array.isArray(data)).toBe(true);

    // [FIX] Validasi yang lebih aman (karena id mungkin undefined jika step 2 gagal)
    if (rateCardId) {
      const found = data.find((rc) => rc.id === rateCardId);
      expect(found).toBeDefined();
      expect(Number(found.pricePerDay)).toBe(500000);
    } else {
      // Jika step 2 gagal, test ini akan fail, tapi dengan pesan jelas
      throw new Error('Rate Card ID is undefined (Step 2 Failed)');
    }
  });

  it('5. Update Rate Card Price', async () => {
    if (!rateCardId) throw new Error('Rate Card ID Missing');

    await request(app.getHttpServer())
      .patch(`/inventory/rate-cards/${rateCardId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        pricePerDay: 750000,
      })
      .expect(200);
  });

  it('6. Delete Rate Card', async () => {
    if (!rateCardId) throw new Error('Rate Card ID Missing');

    await request(app.getHttpServer())
      .delete(`/inventory/rate-cards/${rateCardId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/inventory/rate-cards')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .then((res) => {
        const data = res.body.data || res.body;
        const found = data.find((rc) => rc.id === rateCardId);
        expect(found).toBeUndefined();
      });
  });
});
