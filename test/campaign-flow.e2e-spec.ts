import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/providers/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ApprovalStatus,
  CampaignStatus,
  Role,
  TransactionType,
} from '@prisma/client';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor';
import { applyBigIntSerializers } from '../src/common/utils/bigint.util';

describe('Campaign Flow (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let advertiserToken: string;
  let adminToken: string;

  let advertiserId: number;
  let adminId: number;
  let propertyId: number;
  let screenId1: number;
  let screenId2: number;
  let mediaId: number;
  let campaignId: number;

  const getFutureDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  beforeAll(async () => {
    applyBigIntSerializers();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    const configService = app.get<ConfigService>(ConfigService);
    const jwtSecret = configService.get<string>('jwt.secret') || 'secret_key';

    // 1. Setup User & Admin
    const advertiser = await prisma.user.create({
      data: {
        email: `camp_adv_${Date.now()}@test.com`,
        password: 'hash',
        name: 'Camp Advertiser',
        role: Role.ADVERTISER,
      },
    });
    advertiserId = advertiser.id;
    await prisma.wallet.create({ data: { userId: advertiserId, balance: 0 } });

    advertiserToken = jwtService.sign(
      { sub: advertiser.id, email: advertiser.email, role: advertiser.role },
      { secret: jwtSecret },
    );

    const admin = await prisma.user.create({
      data: {
        email: `camp_adm_${Date.now()}@test.com`,
        password: 'hash',
        name: 'Camp Admin',
        role: Role.SUPER_ADMIN,
      },
    });
    adminId = admin.id;
    adminToken = jwtService.sign(
      { sub: admin.id, email: admin.email, role: admin.role },
      { secret: jwtSecret },
    );

    // 2. Setup Property & 2 Screens (Untuk test Buyout)
    const property = await prisma.property.create({
      data: { name: 'Camp Hotel', classification: 'PREMIUM' },
    });
    propertyId = property.id;

    await prisma.rateCard.create({
      data: {
        propertyId: property.id,
        classification: 'PREMIUM',
        pricePerDay: BigInt(50000),
      },
    });

    const s1 = await prisma.screen.create({
      data: { propertyId: property.id, name: 'S1', code: `S1-${Date.now()}` },
    });
    screenId1 = s1.id;

    const s2 = await prisma.screen.create({
      data: { propertyId: property.id, name: 'S2', code: `S2-${Date.now()}` },
    });
    screenId2 = s2.id;

    // 3. Setup Media
    const media = await prisma.media.create({
      data: {
        uploaderId: advertiserId,
        filename: 'test.jpg',
        originalName: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 1000,
        type: 'IMAGE',
        url: 'http://minio/test.jpg',
        status: ApprovalStatus.APPROVED,
      },
    });
    mediaId = media.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.campaignItem.deleteMany({
      where: { campaign: { advertiserId } },
    });
    await prisma.campaign.deleteMany({ where: { advertiserId } });
    await prisma.media.deleteMany({ where: { id: mediaId } });
    await prisma.transaction.deleteMany({
      where: { wallet: { userId: advertiserId } },
    });
    await prisma.withdrawalRequest.deleteMany({
      where: { wallet: { userId: advertiserId } },
    });
    await prisma.wallet.deleteMany({ where: { userId: advertiserId } });
    await prisma.screen.deleteMany({ where: { propertyId } });
    await prisma.rateCard.deleteMany({});
    await prisma.property.deleteMany({ where: { id: propertyId } });
    await prisma.auditLog.deleteMany({
      where: { userId: { in: [advertiserId, adminId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [advertiserId, adminId] } },
    });
    await app.close();
  });

  describe('1. Validation Flow', () => {
    it('Should fail if balance insufficient', async () => {
      await request(app.getHttpServer())
        .post('/campaigns')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({
          name: 'Poor Campaign',
          startDate: getFutureDate(1),
          endDate: getFutureDate(2),
          mediaId: mediaId,
          screenIds: [screenId1],
        })
        .expect(400);
    });
  });

  describe('2. Selective Screen Flow', () => {
    it('Topup Balance first', async () => {
      await prisma.wallet.update({
        where: { userId: advertiserId },
        data: { balance: BigInt(500000) }, // Topup 500k
      });
    });

    it('Should create campaign for 1 screen', async () => {
      const res = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({
          name: 'Selective Campaign',
          startDate: getFutureDate(5),
          endDate: getFutureDate(7), // 2 days x 50k = 100k
          mediaId: mediaId,
          screenIds: [screenId1], // Only S1
        })
        .expect(201);

      campaignId = res.body.data.id;
      // Validasi biaya: 100k
      // Frozen Balance: 100k
      const wallet = await prisma.wallet.findUnique({
        where: { userId: advertiserId },
      });
      // [FIX] Null Check
      expect(wallet).toBeDefined();
      expect(Number(wallet!.frozenBalance)).toBe(100000);
    });

    it('Admin approves -> Deduct 100k', async () => {
      await request(app.getHttpServer())
        .patch(`/campaigns/${campaignId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approved: true })
        .expect(200);

      const wallet = await prisma.wallet.findUnique({
        where: { userId: advertiserId },
      });
      // [FIX] Null Check
      expect(wallet).toBeDefined();
      expect(Number(wallet!.frozenBalance)).toBe(0);
      expect(Number(wallet!.balance)).toBe(400000); // 500k - 100k
    });
  });

  describe('3. Property Buyout Flow (NEW)', () => {
    it('Should create campaign for ALL screens (Buyout)', async () => {
      // Cost: 2 screens x 2 days x 50k = 200k
      const res = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({
          name: 'Buyout Campaign',
          startDate: getFutureDate(10),
          endDate: getFutureDate(12),
          mediaId: mediaId,
          propertyId: propertyId, // <-- Pakai Property ID
        })
        .expect(201);

      const newCampaignId = res.body.data.id;

      // Verify Target Screens Count (Must be 2)
      const campaign = await prisma.campaign.findUnique({
        where: { id: newCampaignId },
        include: { screens: true },
      });
      // [FIX] Null Check
      expect(campaign).toBeDefined();
      expect(campaign!.screens.length).toBe(2); // S1 and S2
      expect(Number(campaign!.totalCost)).toBe(200000);

      // Verify Wallet Frozen increased by 200k
      const wallet = await prisma.wallet.findUnique({
        where: { userId: advertiserId },
      });
      // [FIX] Null Check
      expect(wallet).toBeDefined();
      // Sisa 400k - 200k (Frozen) = 200k Available
      expect(Number(wallet!.frozenBalance)).toBe(200000);
    });
  });
});
