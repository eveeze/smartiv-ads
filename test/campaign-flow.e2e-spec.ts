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
  let screenId: number;
  let mediaId: number;
  let campaignId: number;

  // Helper Date Dinamis
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

    // 2. Setup Screen & RateCard
    const property = await prisma.property.create({
      data: { name: 'Camp Hotel', classification: 'PREMIUM' },
    });
    await prisma.rateCard.create({
      data: {
        propertyId: property.id,
        classification: 'PREMIUM',
        pricePerDay: BigInt(50000), // 50k per day
      },
    });
    const screen = await prisma.screen.create({
      data: {
        propertyId: property.id,
        name: 'Screen 1',
        code: `SCR-${Date.now()}`,
      },
    });
    screenId = screen.id;

    // 3. Setup Approved Media
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
    // Targeted Cleanup
    await prisma.campaignItem.deleteMany({
      where: { campaign: { advertiserId } },
    });
    await prisma.campaign.deleteMany({ where: { advertiserId } });
    await prisma.media.deleteMany({ where: { id: mediaId } });
    await prisma.transaction.deleteMany({
      where: { wallet: { userId: advertiserId } },
    });
    await prisma.wallet.deleteMany({ where: { userId: advertiserId } });
    await prisma.screen.deleteMany({ where: { id: screenId } });
    await prisma.rateCard.deleteMany({});
    await prisma.property.deleteMany({ where: { name: 'Camp Hotel' } });

    // [FIX] Hapus AuditLog sebelum User karena relasi Foreign Key
    await prisma.auditLog.deleteMany({
      where: { userId: { in: [advertiserId, adminId] } },
    });

    await prisma.user.deleteMany({
      where: { id: { in: [advertiserId, adminId] } },
    });
    await app.close();
  });

  describe('1. Validation Flow', () => {
    it('Should fail if balance is insufficient', async () => {
      await request(app.getHttpServer())
        .post('/campaigns')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({
          name: 'Poor Campaign',
          startDate: getFutureDate(1), // Besok
          endDate: getFutureDate(3), // 3 hari lagi (2 days duration = 100k)
          mediaId: mediaId,
          screenIds: [screenId],
        })
        .expect(400); // Insufficient Balance
    });
  });

  describe('2. Success Flow', () => {
    it('Topup Balance first', async () => {
      // Topup 200k
      await prisma.wallet.update({
        where: { userId: advertiserId },
        data: { balance: BigInt(200000) },
      });
    });

    it('Should create campaign and freeze balance', async () => {
      const res = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({
          name: 'Rich Campaign',
          startDate: getFutureDate(5), // 5 hari lagi
          endDate: getFutureDate(7), // 7 hari lagi (2 days = 100k cost)
          mediaId: mediaId,
          screenIds: [screenId],
        })
        .expect(201);

      campaignId = res.body.data.id;
      expect(res.body.data.status).toBe(CampaignStatus.PENDING_REVIEW);

      const wallet = await prisma.wallet.findUnique({
        where: { userId: advertiserId },
      });
      // Null Check
      expect(wallet).toBeDefined();
      expect(Number(wallet!.balance)).toBe(100000); // 200k - 100k
      expect(Number(wallet!.frozenBalance)).toBe(100000); // 100k frozen
    });

    it('Admin should see pending campaign', async () => {
      const res = await request(app.getHttpServer())
        .get('/campaigns/pending')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const found = res.body.data.data.find((c) => c.id === campaignId);
      expect(found).toBeDefined();
    });

    it('Admin approves campaign -> Deduct Frozen', async () => {
      await request(app.getHttpServer())
        .patch(`/campaigns/${campaignId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approved: true })
        .expect(200);

      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
      });
      // Null Check
      expect(campaign).toBeDefined();
      expect(campaign!.status).toBe(CampaignStatus.ACTIVE);

      const wallet = await prisma.wallet.findUnique({
        where: { userId: advertiserId },
      });
      // Null Check
      expect(wallet).toBeDefined();
      expect(Number(wallet!.balance)).toBe(100000); // Sisa 100k
      expect(Number(wallet!.frozenBalance)).toBe(0); // Frozen gone

      const tx = await prisma.transaction.findFirst({
        where: {
          walletId: wallet!.id,
          type: TransactionType.SPEND,
        },
      });
      // Null Check
      expect(tx).toBeDefined();
      expect(Number(tx!.amount)).toBe(100000);
    });
  });
});
