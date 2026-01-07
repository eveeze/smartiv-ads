import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/providers/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthModule } from '../src/modules/auth/auth.module'; // Wajib import ini
import { ApprovalStatus, CampaignStatus, Role } from '@prisma/client';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor';
import { applyBigIntSerializers } from '../src/common/utils/bigint.util';

describe('Campaign Flow (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;

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
      imports: [AppModule, AuthModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    authService = app.get<AuthService>(AuthService);

    const ts = Date.now();

    // 1. Setup User & Admin
    const advertiser = await prisma.user.create({
      data: {
        email: `camp_adv_${ts}@test.com`,
        password: 'hash',
        name: 'Camp Advertiser',
        role: Role.ADVERTISER,
      },
    });
    advertiserId = advertiser.id;
    // Create token helper
    const advPayload = await authService.createToken(advertiser);
    advertiserToken = advPayload.accessToken;

    await prisma.wallet.create({ data: { userId: advertiserId, balance: 0 } });

    const admin = await prisma.user.create({
      data: {
        email: `camp_adm_${ts}@test.com`,
        password: 'hash',
        name: 'Camp Admin',
        role: Role.SUPER_ADMIN,
      },
    });
    adminId = admin.id;
    const adminPayload = await authService.createToken(admin);
    adminToken = adminPayload.accessToken;

    // 2. Setup Property & Screens
    const property = await prisma.property.create({
      data: {
        name: `Camp Hotel ${ts}`,
        classification: 'PREMIUM',
        type: 'MALL',
      },
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
      data: {
        propertyId: property.id,
        name: 'S1',
        code: `S1-${ts}`,
        orientation: 'LANDSCAPE',
        status: 'ONLINE',
      },
    });
    screenId1 = s1.id;

    const s2 = await prisma.screen.create({
      data: {
        propertyId: property.id,
        name: 'S2',
        code: `S2-${ts}`,
        orientation: 'LANDSCAPE',
        status: 'ONLINE',
      },
    });
    screenId2 = s2.id;

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
    // [FIX] Teardown Aman (Cek jika variable sudah terisi)
    if (advertiserId) {
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
    }

    if (propertyId) {
      await prisma.screen.deleteMany({ where: { propertyId } });
      await prisma.rateCard.deleteMany({ where: { propertyId } });
      await prisma.property.deleteMany({ where: { id: propertyId } });
    }

    const uIds = [advertiserId, adminId].filter((id) => id !== undefined);
    if (uIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { userId: { in: uIds } } });
      await prisma.user.deleteMany({ where: { id: { in: uIds } } });
    }

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
          endDate: getFutureDate(7),
          mediaId: mediaId,
          screenIds: [screenId1],
        })
        .expect(201);

      campaignId = res.body.data.id;
      const wallet = await prisma.wallet.findUnique({
        where: { userId: advertiserId },
      });

      expect(wallet).toBeDefined();
      expect(Number(wallet!.frozenBalance)).toBeGreaterThan(0);
    });

    it('Admin approves -> Deduct frozen', async () => {
      await request(app.getHttpServer())
        .patch(`/campaigns/${campaignId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approved: true })
        .expect(200);

      const wallet = await prisma.wallet.findUnique({
        where: { userId: advertiserId },
      });

      expect(wallet).toBeDefined();
      expect(Number(wallet!.frozenBalance)).toBe(0);
      expect(Number(wallet!.balance)).toBeLessThan(500000);
    });
  });

  describe('3. Cancel Campaign Flow (NEW)', () => {
    let cancelCampaignId: number;

    it('Should create another campaign to cancel', async () => {
      const res = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({
          name: 'To Be Cancelled',
          startDate: getFutureDate(10),
          endDate: getFutureDate(11),
          mediaId: mediaId,
          screenIds: [screenId1],
        })
        .expect(201);

      cancelCampaignId = res.body.data.id;

      const wallet = await prisma.wallet.findUnique({
        where: { userId: advertiserId },
      });
      expect(wallet).toBeDefined();
      expect(Number(wallet!.frozenBalance)).toBeGreaterThan(0);
    });

    it('Should Cancel PENDING campaign -> Refund Frozen Balance', async () => {
      await request(app.getHttpServer())
        .patch(`/campaigns/${cancelCampaignId}/cancel`)
        .set('Authorization', `Bearer ${advertiserToken}`)
        .expect(200);

      const campaign = await prisma.campaign.findUnique({
        where: { id: cancelCampaignId },
      });
      expect(campaign?.status).toBe(CampaignStatus.CANCELLED);

      const wallet = await prisma.wallet.findUnique({
        where: { userId: advertiserId },
      });
      expect(wallet).toBeDefined();
      expect(Number(wallet!.frozenBalance)).toBe(0);
    });
  });

  describe('4. Draft Management Flow (NEW - Phase 5.8)', () => {
    let draftId: number;

    it('Should create a campaign as DRAFT (Status: DRAFT, No Frozen)', async () => {
      const res = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({
          name: 'Draft Candidate',
          startDate: getFutureDate(20),
          endDate: getFutureDate(22),
          mediaId: mediaId,
          screenIds: [screenId1],
          saveAsDraft: true,
        })
        .expect(201);

      draftId = res.body.data.id;

      const campaign = await prisma.campaign.findUnique({
        where: { id: draftId },
      });
      expect(campaign?.status).toBe(CampaignStatus.DRAFT);

      const wallet = await prisma.wallet.findUnique({
        where: { userId: advertiserId },
      });
      expect(Number(wallet!.frozenBalance)).toBe(0);
    });

    it('Should update DRAFT campaign name & dates', async () => {
      await request(app.getHttpServer())
        .patch(`/campaigns/${draftId}`)
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({
          name: 'Updated Draft Name',
          startDate: getFutureDate(21),
        })
        .expect(200);
    });

    it('Should SUBMIT draft -> Become PENDING & Freeze Balance', async () => {
      await request(app.getHttpServer())
        .patch(`/campaigns/${draftId}/submit`)
        .set('Authorization', `Bearer ${advertiserToken}`)
        .expect(200);

      const campaign = await prisma.campaign.findUnique({
        where: { id: draftId },
      });
      expect(campaign?.status).toBe(CampaignStatus.PENDING_REVIEW);

      const wallet = await prisma.wallet.findUnique({
        where: { userId: advertiserId },
      });
      expect(Number(wallet!.frozenBalance)).toBeGreaterThan(0);
    });

    it('Should fail updating if status is NOT DRAFT', async () => {
      await request(app.getHttpServer())
        .patch(`/campaigns/${draftId}`)
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({ name: 'Hacking Attempt' })
        .expect(400);
    });

    it('Should delete DRAFT campaign', async () => {
      const res = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({
          name: 'To Delete',
          startDate: getFutureDate(25),
          endDate: getFutureDate(26),
          mediaId: mediaId,
          screenIds: [screenId1],
          saveAsDraft: true,
        })
        .expect(201);

      const deleteId = res.body.data.id;

      await request(app.getHttpServer())
        .delete(`/campaigns/${deleteId}`)
        .set('Authorization', `Bearer ${advertiserToken}`)
        .expect(200);

      const check = await prisma.campaign.findUnique({
        where: { id: deleteId },
      });
      expect(check).toBeNull();
    });
  });
});
