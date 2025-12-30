import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/providers/prisma/prisma.service';
import { PropertyClass, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { TransformInterceptor } from './../src/common/interceptors/transform/transform.interceptor';
// [FIX] 1. Import helper BigInt
import { applyBigIntSerializers } from './../src/common/utils/bigint.util';

describe('Rate Card Management (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let rateCardId: number;
  let adminId: number;

  beforeAll(async () => {
    // [FIX] 2. Panggil ini SEBELUM membuat aplikasi.
    // Ini wajib karena Jest me-reset prototype BigInt di setiap test suite.
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

    // --- SETUP ADMIN ---
    const adminEmail = 'admin.ratecard.e2e@test.com';
    const adminPassword = 'password123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Hapus user lama (Clean Slate)
    await prisma.user.deleteMany({ where: { email: adminEmail } });

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

    // Login
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(201);

    adminToken = loginRes.body.data?.accessToken || loginRes.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup
    if (rateCardId) {
      await prisma.rateCard
        .delete({ where: { id: rateCardId } })
        .catch(() => {});
    }
    if (adminId) {
      await prisma.user.delete({ where: { id: adminId } }).catch(() => {});
    }
    await app.close();
  });

  // --- TEST CASES ---

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
    const res = await request(app.getHttpServer())
      .post('/inventory/rate-cards')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        classification: PropertyClass.PREMIUM,
        pricePerDay: 500000,
      })
      // Error 500 sebelumnya terjadi di sini karena return body mengandung BigInt
      // Dengan fix di atas, seharusnya sekarang 201
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
      .expect(409);
  });

  it('4. Get All Rate Cards', async () => {
    const res = await request(app.getHttpServer())
      .get('/inventory/rate-cards')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const data = res.body.data || res.body;
    expect(Array.isArray(data)).toBe(true);

    const found = data.find((rc) => rc.id === rateCardId);
    expect(found).toBeDefined();
    // BigInt dari server akan jadi string/number di JSON
    expect(Number(found.pricePerDay)).toBe(500000);
  });

  it('5. Update Rate Card Price', async () => {
    // Karena step 2 sudah fix (rateCardId ada), step ini tidak akan 400 lagi
    await request(app.getHttpServer())
      .patch(`/inventory/rate-cards/${rateCardId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        pricePerDay: 750000,
      })
      .expect(200);
  });

  it('6. Delete Rate Card', async () => {
    await request(app.getHttpServer())
      .delete(`/inventory/rate-cards/${rateCardId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Verify Deletion
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
