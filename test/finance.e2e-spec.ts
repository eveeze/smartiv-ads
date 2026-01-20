import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/providers/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { MidtransService } from '../src/providers/payment/midtrans.service';
import { ConfigService } from '@nestjs/config';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor';
import { applyBigIntSerializers } from '../src/common/utils/bigint.util';
import { Server } from 'http';

// [FIX] Interface Definitions for Type Safety
interface CostCalculationResponse {
  data: {
    totalCost: number;
  };
}

interface WalletResponse {
  data: {
    balance: number;
  };
}

interface TransactionsResponse {
  data: {
    data: unknown[];
  };
}

describe('FinanceModule (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let advertiserToken: string;
  let adminToken: string;

  // Track IDs
  let advertiserId: number;
  let adminId: number;
  let screenId: number;
  let propertyId: number;
  let rateCardId: number;

  const mockMidtransService = {
    createSnapTransaction: jest.fn().mockResolvedValue({
      token: 'mock-snap-token',
      redirectUrl: 'http://mock-url',
    }),
    verifyNotification: jest.fn().mockResolvedValue({
      order_id: 'MOCK-ORDER',
      transaction_status: 'settlement',
      fraud_status: 'accept',
    }),
  };

  beforeAll(async () => {
    applyBigIntSerializers();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MidtransService)
      .useValue(mockMidtransService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    const configService = app.get<ConfigService>(ConfigService);
    const jwtSecret = configService.get<string>('jwt.secret') || 'secret_key';

    // 1. Users
    const advertiser = await prisma.user.create({
      data: {
        email: `fin_adv_${Date.now()}@t.com`,
        password: 'h',
        name: 'FinUser',
        role: Role.ADVERTISER,
      },
    });
    advertiserId = advertiser.id;
    advertiserToken = jwtService.sign(
      { sub: advertiser.id, email: advertiser.email, role: advertiser.role },
      { secret: jwtSecret },
    );

    const admin = await prisma.user.create({
      data: {
        email: `fin_adm_${Date.now()}@t.com`,
        password: 'h',
        name: 'FinAdm',
        role: Role.SUPER_ADMIN,
      },
    });
    adminId = admin.id;
    adminToken = jwtService.sign(
      { sub: admin.id, email: admin.email, role: admin.role },
      { secret: jwtSecret },
    );

    // 2. Inventory Data for Calculator
    const property = await prisma.property.create({
      data: { name: 'Fin Hotel', type: 'HOTEL', classification: 'PREMIUM' },
    });
    propertyId = property.id;

    const rateCard = await prisma.rateCard.create({
      data: {
        propertyId: property.id,
        classification: 'PREMIUM',
        pricePerDay: BigInt(50000),
      },
    });
    rateCardId = rateCard.id;

    const screen = await prisma.screen.create({
      data: {
        propertyId: property.id,
        name: 'Fin Screen',
        code: `FS-${Date.now()}`,
      },
    });
    screenId = screen.id;
  });

  afterAll(async () => {
    // [FIX] Targeted Cleanup
    await prisma.transaction.deleteMany({
      where: { wallet: { userId: advertiserId } },
    });
    await prisma.withdrawalRequest.deleteMany({
      where: { wallet: { userId: advertiserId } },
    });
    await prisma.wallet.deleteMany({ where: { userId: advertiserId } });

    await prisma.screen.deleteMany({ where: { id: screenId } });
    await prisma.rateCard.deleteMany({ where: { id: rateCardId } });
    await prisma.property.deleteMany({ where: { id: propertyId } });

    await prisma.user.deleteMany({
      where: { id: { in: [advertiserId, adminId] } },
    });
    await app.close();
  });

  describe('Calculator Flow', () => {
    it('POST /finance/calculate-cost', async () => {
      // [FIX] Cast to Server
      const res = await request(app.getHttpServer() as Server)
        .post('/finance/calculate-cost')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({
          screenIds: [screenId],
          startDate: '2025-01-01',
          endDate: '2025-01-03',
        })
        .expect(201);

      // [FIX] Explicit Type Assertion
      const body = res.body as CostCalculationResponse;
      expect(body.data.totalCost).toBe(100000);
    });
  });

  describe('Topup Flow', () => {
    it('POST /finance/topup', async () => {
      // [FIX] Cast to Server
      await request(app.getHttpServer() as Server)
        .post('/finance/topup')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({ amount: 100000 })
        .expect(201);
    });

    it('GET /finance/wallet', async () => {
      // [FIX] Cast to Server
      const res = await request(app.getHttpServer() as Server)
        .get('/finance/wallet')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .expect(200);

      // [FIX] Explicit Type Assertion
      const body = res.body as WalletResponse;
      expect(body.data.balance).toBe(0);
    });
  });

  describe('Admin Transactions Flow', () => {
    it('GET /finance/admin/transactions', async () => {
      // [FIX] Cast to Server
      const res = await request(app.getHttpServer() as Server)
        .get('/finance/admin/transactions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // [FIX] Explicit Type Assertion
      const body = res.body as TransactionsResponse;
      expect(Array.isArray(body.data.data)).toBeTruthy();
    });
  });
});
