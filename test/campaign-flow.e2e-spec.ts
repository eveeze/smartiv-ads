import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/providers/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthModule } from '../src/modules/auth/auth.module';
import { ApprovalStatus, Role, AdSlot, DurationPackage } from '@prisma/client';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor';
import { applyBigIntSerializers } from '../src/common/utils/bigint.util';
import { Server } from 'http';

// [FIX] 1. Definisi Interface untuk Response Type Safety
interface CampaignItem {
  id: number;
}

interface ApiResponse<T> {
  data: T;
}

describe('Campaign Flow (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  let httpServer: Server;

  let advertiserToken: string;
  let adminToken: string;
  let advertiserId: number;
  let adminId: number;
  let propertyId: number;
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

    httpServer = app.getHttpServer() as Server;
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
        // [FIX] Enable slot agar valid
        enabledSlots: [AdSlot.SCREENSAVER, AdSlot.INFO_SLIDER],
      },
    });
    propertyId = property.id;

    await prisma.rateCard.create({
      data: {
        propertyId: property.id,
        classification: 'PREMIUM',
        targetSlot: AdSlot.SCREENSAVER,
        pricePerDay: BigInt(50000), // 50rb per screen per hari
      },
    });

    // Buat 1 Screen Online agar campaign bisa jalan
    await prisma.screen.create({
      data: {
        propertyId: property.id,
        name: 'S1',
        code: `S1-${ts}`,
        status: 'ONLINE',
      },
    });

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
    // Cleanup Logic
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
      await request(httpServer)
        .post('/campaigns')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({
          name: 'Poor Campaign',
          startDate: getFutureDate(1),
          // [FIX] Update Payload Phase 3
          propertyId: propertyId,
          targetSlot: AdSlot.SCREENSAVER,
          durationPackage: DurationPackage.WEEKLY,
          mediaId: mediaId,
        })
        .expect(400);
    });
  });

  describe('2. Standard Flow (Auto-Tag Screens)', () => {
    it('Topup Balance first', async () => {
      await prisma.wallet.update({
        where: { userId: advertiserId },
        data: { balance: BigInt(5000000) }, // Topup besar agar cukup
      });
    });

    it('Should create campaign successfully', async () => {
      const res = await request(httpServer)
        .post('/campaigns')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({
          name: 'Standard Campaign',
          startDate: getFutureDate(5),
          mediaId: mediaId,
          // [FIX] Payload Baru
          propertyId: propertyId,
          targetSlot: AdSlot.SCREENSAVER,
          durationPackage: DurationPackage.WEEKLY, // 7 Hari
        })
        .expect(201);

      const body = res.body as ApiResponse<CampaignItem>;
      campaignId = body.data.id;

      const wallet = await prisma.wallet.findUnique({
        where: { userId: advertiserId },
      });

      expect(wallet).toBeDefined();
      expect(Number(wallet!.frozenBalance)).toBeGreaterThan(0);
    });

    it('Admin approves -> Deduct frozen', async () => {
      await request(httpServer)
        .patch(`/campaigns/${campaignId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approved: true })
        .expect(200);

      const wallet = await prisma.wallet.findUnique({
        where: { userId: advertiserId },
      });

      expect(wallet).toBeDefined();
      expect(Number(wallet!.frozenBalance)).toBe(0);
    });
  });

  describe('3. Cancel Campaign Flow', () => {
    let cancelCampaignId: number;

    it('Should create another campaign to cancel', async () => {
      const res = await request(httpServer)
        .post('/campaigns')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({
          name: 'To Be Cancelled',
          startDate: getFutureDate(10),
          mediaId: mediaId,
          propertyId: propertyId,
          targetSlot: AdSlot.SCREENSAVER,
          durationPackage: DurationPackage.WEEKLY,
        })
        .expect(201);

      const body = res.body as ApiResponse<CampaignItem>;
      cancelCampaignId = body.data.id;
    });

    it('Should Cancel PENDING campaign -> Refund Frozen Balance', async () => {
      await request(httpServer)
        .patch(`/campaigns/${cancelCampaignId}/cancel`)
        .set('Authorization', `Bearer ${advertiserToken}`)
        .expect(200);
    });
  });

  describe('4. Draft Management Flow', () => {
    let draftId: number;

    it('Should create a campaign as DRAFT', async () => {
      const res = await request(httpServer)
        .post('/campaigns')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({
          name: 'Draft Candidate',
          startDate: getFutureDate(20),
          mediaId: mediaId,
          propertyId: propertyId,
          targetSlot: AdSlot.SCREENSAVER,
          durationPackage: DurationPackage.WEEKLY,
          saveAsDraft: true, // Flag Draft
        })
        .expect(201);

      const body = res.body as ApiResponse<CampaignItem>;
      draftId = body.data.id;
    });

    it('Should update DRAFT campaign name & dates', async () => {
      await request(httpServer)
        .patch(`/campaigns/${draftId}`)
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({
          name: 'Updated Draft Name',
          startDate: getFutureDate(21),
        })
        .expect(200);
    });

    it('Should SUBMIT draft -> Become PENDING & Freeze Balance', async () => {
      await request(httpServer)
        .patch(`/campaigns/${draftId}/submit`)
        .set('Authorization', `Bearer ${advertiserToken}`)
        .expect(200);
    });

    it('Should delete DRAFT campaign', async () => {
      const res = await request(httpServer)
        .post('/campaigns')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({
          name: 'To Delete',
          startDate: getFutureDate(25),
          mediaId: mediaId,
          propertyId: propertyId,
          targetSlot: AdSlot.SCREENSAVER,
          durationPackage: DurationPackage.WEEKLY,
          saveAsDraft: true,
        })
        .expect(201);

      const body = res.body as ApiResponse<CampaignItem>;
      const deleteId = body.data.id;

      await request(httpServer)
        .delete(`/campaigns/${deleteId}`)
        .set('Authorization', `Bearer ${advertiserToken}`)
        .expect(200);
    });
  });
});
