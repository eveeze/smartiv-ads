import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/providers/prisma/prisma.service';
import { PropertyClass, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { TransformInterceptor } from './../src/common/interceptors/transform/transform.interceptor';
import { applyBigIntSerializers } from './../src/common/utils/bigint.util';
import { Server } from 'http';

// [FIX] Definisi Interface untuk Type Safety Response
interface RateCardItem {
  id: number;
  classification: PropertyClass;
  pricePerDay: number | string; // BigInt mungkin terserialisasi jadi string/number
  propertyId: number | null;
}

interface LoginResponseData {
  accessToken: string;
}

// Wrapper untuk response yang mungkin dibungkus interceptor atau raw
interface ApiResponse<T> {
  data?: T;
  message?: string | object;
  [key: string]: unknown; // Fallback untuk properti lain
}

describe('Rate Card Management (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let rateCardId: number;
  let adminId: number;
  let httpServer: Server; // [FIX] Simpan referensi server dengan tipe yang jelas

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

    // [FIX] Cast ke Server agar tidak dianggap 'any' oleh linter saat masuk ke request()
    httpServer = app.getHttpServer() as Server;
    prisma = app.get<PrismaService>(PrismaService);

    const adminEmail = 'admin.ratecard.e2e@test.com';
    const adminPassword = 'password123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await prisma.rateCard.deleteMany({});
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

    const loginRes = await request(httpServer)
      .post('/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(200);

    // [FIX] Type assertion untuk login response
    const body = loginRes.body as ApiResponse<LoginResponseData> &
      LoginResponseData;
    adminToken = body.data?.accessToken || body.accessToken || '';
  });

  afterAll(async () => {
    await prisma.rateCard.deleteMany({});
    if (adminId) {
      await prisma.user.delete({ where: { id: adminId } }).catch(() => {});
    }
    await app.close();
  });

  it('1. Create Rate Card (Validation Error)', async () => {
    await request(httpServer)
      .post('/inventory/rate-cards')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        pricePerDay: 500000,
      })
      .expect(400)
      .expect((res) => {
        // [FIX] Type assertion untuk error response
        const body = res.body as ApiResponse<null>;
        const message = JSON.stringify(body.message || body);
        expect(message).toContain(
          'propertyId is required when classification is missing',
        );
      });
  });

  it('2. Create Rate Card (Global PREMIUM Class)', async () => {
    await prisma.rateCard.deleteMany({
      where: { classification: PropertyClass.PREMIUM, propertyId: null },
    });

    const res = await request(httpServer)
      .post('/inventory/rate-cards')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        classification: PropertyClass.PREMIUM,
        pricePerDay: 500000,
      })
      .expect(201);

    // [FIX] Type assertion agar akses properti aman
    const body = res.body as ApiResponse<RateCardItem> & RateCardItem;
    const data = body.data || body;

    expect(data.pricePerDay).toBeDefined();
    rateCardId = data.id;
  });

  it('3. Prevent Duplicate Rate Card Configuration', async () => {
    await request(httpServer)
      .post('/inventory/rate-cards')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        classification: PropertyClass.PREMIUM,
        pricePerDay: 600000,
      })
      .expect(409);
  });

  it('4. Get All Rate Cards', async () => {
    const res = await request(httpServer)
      .get('/inventory/rate-cards')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // [FIX] Type assertion untuk array response
    const body = res.body as ApiResponse<RateCardItem[]> & RateCardItem[];
    const data = body.data || body;

    expect(Array.isArray(data)).toBe(true);

    if (rateCardId) {
      // [FIX] 'data' sekarang sudah bertipe array RateCardItem, find aman digunakan

      const found = (data as any[]).find((rc) => rc.id === rateCardId);
      expect(found).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(Number(found.pricePerDay)).toBe(500000);
    } else {
      throw new Error('Rate Card ID is undefined (Step 2 Failed)');
    }
  });

  it('5. Update Rate Card Price', async () => {
    if (!rateCardId) throw new Error('Rate Card ID Missing');

    await request(httpServer)
      .patch(`/inventory/rate-cards/${rateCardId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        pricePerDay: 750000,
      })
      .expect(200);
  });

  it('6. Delete Rate Card', async () => {
    if (!rateCardId) throw new Error('Rate Card ID Missing');

    await request(httpServer)
      .delete(`/inventory/rate-cards/${rateCardId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(httpServer)
      .get('/inventory/rate-cards')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .then((res) => {
        // [FIX] Type assertion di block then
        const body = res.body as ApiResponse<RateCardItem[]> & RateCardItem[];
        const data = body.data || body;

        let found: RateCardItem | undefined;
        if (Array.isArray(data)) {
          found = data.find((rc) => rc.id === rateCardId);
        }

        expect(found).toBeUndefined();
      });
  });
});
