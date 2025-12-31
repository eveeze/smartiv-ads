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

    // 2. Setup Property & Screens
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
      data: {
        propertyId: property.id,
        name: 'S1',
        code: `S1-${Date.now()}`,
        status: 'ONLINE',
      },
    });
    screenId1 = s1.id;

    const s2 = await prisma.screen.create({
      data: {
        propertyId: property.id,
        name: 'S2',
        code: `S2-${Date.now()}`,
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
          screenIds: [screenId1],
        })
        .expect(201);

      campaignId = res.body.data.id;
      const wallet = await prisma.wallet.findUnique({
        where: { userId: advertiserId },
      });
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
      expect(wallet).toBeDefined();
      expect(Number(wallet!.frozenBalance)).toBe(0);
      expect(Number(wallet!.balance)).toBe(400000); // 500k - 100k
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
          endDate: getFutureDate(11), // 1 day = 50k
          mediaId: mediaId,
          screenIds: [screenId1],
        })
        .expect(201);

      cancelCampaignId = res.body.data.id;

      // Verify Frozen Balance Increases (50k)
      const wallet = await prisma.wallet.findUnique({
        where: { userId: advertiserId },
      });
      expect(wallet).toBeDefined();
      // Saldo 400k - 50k(frozen) -> Available 350k, Frozen 50k
      expect(Number(wallet!.frozenBalance)).toBe(50000);
    });

    it('Should Cancel PENDING campaign -> Refund Frozen Balance', async () => {
      await request(app.getHttpServer())
        .patch(`/campaigns/${cancelCampaignId}/cancel`)
        .set('Authorization', `Bearer ${advertiserToken}`)
        .expect(200);

      // Verify Status Cancelled
      const campaign = await prisma.campaign.findUnique({
        where: { id: cancelCampaignId },
      });
      expect(campaign?.status).toBe(CampaignStatus.CANCELLED);

      // Verify Refund (Frozen Balance Released)
      const wallet = await prisma.wallet.findUnique({
        where: { userId: advertiserId },
      });
      expect(wallet).toBeDefined();
      expect(Number(wallet!.frozenBalance)).toBe(0);
      expect(Number(wallet!.balance)).toBe(400000); // Kembali ke 400k
    });
  });

  describe('4. Draft Management Flow (NEW - Phase 5.8)', () => {
    let draftId: number;

    it('Should create a campaign (simulated as DRAFT)', async () => {
      // Catatan: Karena endpoint Create defaultnya PENDING_REVIEW (sesuai Phase 5.5),
      // kita akan override statusnya di DB menjadi DRAFT agar bisa ditest fitur Edit/Delete Draftnya.
      // Dalam implementasi nyata, mungkin ada flag `isDraft` di DTO Create.

      const res = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({
          name: 'Draft Candidate',
          startDate: getFutureDate(20),
          endDate: getFutureDate(22),
          mediaId: mediaId,
          screenIds: [screenId1],
        })
        .expect(201);

      draftId = res.body.data.id;

      // Force status to DRAFT via Prisma (Simulation)
      await prisma.campaign.update({
        where: { id: draftId },
        data: { status: CampaignStatus.DRAFT },
      });
    });

    it('Should update DRAFT campaign name & dates', async () => {
      await request(app.getHttpServer())
        .patch(`/campaigns/${draftId}`)
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({
          name: 'Updated Draft Name',
          startDate: getFutureDate(21), // Geser tanggal
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.name).toBe('Updated Draft Name');
          // StartDate berubah
          expect(res.body.data.startDate).toContain(getFutureDate(21));
        });
    });

    it('Should fail updating if status is NOT DRAFT', async () => {
      // Ubah status ke PENDING_REVIEW
      await prisma.campaign.update({
        where: { id: draftId },
        data: { status: CampaignStatus.PENDING_REVIEW },
      });

      await request(app.getHttpServer())
        .patch(`/campaigns/${draftId}`)
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({ name: 'Hacking Attempt' })
        .expect(400); // Bad Request
    });

    it('Should delete DRAFT campaign', async () => {
      // Kembalikan ke DRAFT
      await prisma.campaign.update({
        where: { id: draftId },
        data: { status: CampaignStatus.DRAFT },
      });

      await request(app.getHttpServer())
        .delete(`/campaigns/${draftId}`)
        .set('Authorization', `Bearer ${advertiserToken}`)
        .expect(200);

      // Verify Gone from DB
      const check = await prisma.campaign.findUnique({
        where: { id: draftId },
      });
      expect(check).toBeNull();
    });
  });
});
