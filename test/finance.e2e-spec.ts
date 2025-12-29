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
import { applyBigIntSerializers } from '../src/common/utils/bigint.util'; // [FIX] Import Utility

describe('FinanceModule (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let advertiserToken: string;
  let advertiserId: number;

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
    // [FIX] Apply BigInt Serializer untuk lingkungan Test
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
    const jwtSecret =
      configService.get<string>('jwt.secret') || process.env.JWT_SECRET;

    // Seed Advertiser
    const user = await prisma.user.create({
      data: {
        email: `finance_${Date.now()}@test.com`,
        name: 'Finance User',
        password: 'hash',
        role: Role.ADVERTISER,
        phone: '08123',
      },
    });
    advertiserId = user.id;
    advertiserToken = jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      { secret: jwtSecret },
    );
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany();
    await prisma.withdrawalRequest.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.user.deleteMany({ where: { id: advertiserId } });
    await app.close();
  });

  describe('Topup Flow', () => {
    it('POST /finance/topup - Should return Midtrans Token', async () => {
      const res = await request(app.getHttpServer())
        .post('/finance/topup')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({ amount: 100000 })
        .expect(201);

      expect(res.body.data.token).toBe('mock-snap-token');
      expect(mockMidtransService.createSnapTransaction).toHaveBeenCalled();
    });

    it('GET /finance/wallet - Should verify transaction created', async () => {
      const res = await request(app.getHttpServer())
        .get('/finance/wallet')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .expect(200);

      expect(res.body.data.balance).toBe(0);
      expect(res.body.data.transactions.length).toBeGreaterThan(0);
    });
  });
});
