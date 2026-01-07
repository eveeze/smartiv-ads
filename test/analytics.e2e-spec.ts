import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/providers/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthModule } from '../src/modules/auth/auth.module';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor';
import { applyBigIntSerializers } from '../src/common/utils/bigint.util';
import { Role, CampaignStatus, ScreenStatus } from '@prisma/client';

describe('Analytics Module (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;

  let advertiserToken: string;
  let adminToken: string;
  let advertiserId: number;
  let adminId: number;
  let propertyId: number;
  let screenId: number;

  beforeAll(async () => {
    applyBigIntSerializers();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, AuthModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    authService = app.get<AuthService>(AuthService);

    const ts = Date.now();

    // A. Create Admin
    const admin = await prisma.user.create({
      data: {
        email: `admin_analytics_${ts}@test.com`,
        password: 'hash',
        role: Role.SUPER_ADMIN,
        name: 'Super Admin',
      },
    });
    adminId = admin.id;
    const adminPayload = await authService.createToken(admin);
    adminToken = adminPayload.accessToken;

    // B. Create Advertiser
    const advertiser = await prisma.user.create({
      data: {
        email: `adv_analytics_${ts}@test.com`,
        password: 'hash',
        role: Role.ADVERTISER,
        name: 'Advertiser One',
        wallet: { create: { balance: 5000000 } },
      },
    });
    advertiserId = advertiser.id;
    const advPayload = await authService.createToken(advertiser);
    advertiserToken = advPayload.accessToken;

    // C. Create Inventory
    const property = await prisma.property.create({
      data: {
        name: `Analytics Mall ${ts}`,
        classification: 'PREMIUM',
        type: 'MALL',
      },
    });
    propertyId = property.id;

    const screen = await prisma.screen.create({
      data: {
        propertyId,
        name: 'Screen A',
        code: `MAC-ANALYTICS-${ts}`,
        status: ScreenStatus.ONLINE,
      },
    });
    screenId = screen.id;

    // D. Create Campaign
    await prisma.campaign.create({
      data: {
        advertiserId,
        name: 'Analytics Campaign',
        startDate: new Date(),
        endDate: new Date(),
        totalCost: 1000000,
        status: CampaignStatus.ACTIVE,
        screens: { connect: { id: screenId } },
      },
    });
  });

  afterAll(async () => {
    if (advertiserId) {
      await prisma.campaignItem.deleteMany({
        where: { campaign: { advertiserId } },
      });
      await prisma.campaign.deleteMany({ where: { advertiserId } });
      await prisma.transaction.deleteMany({
        where: { wallet: { userId: advertiserId } },
      });
      await prisma.withdrawalRequest.deleteMany({
        where: { wallet: { userId: advertiserId } },
      });
      await prisma.wallet.deleteMany({ where: { userId: advertiserId } });
    }

    if (screenId) {
      await prisma.impressionLog.deleteMany({ where: { screenId } });
      await prisma.screen.deleteMany({ where: { id: screenId } });
    }

    if (propertyId) {
      await prisma.rateCard.deleteMany({ where: { propertyId } });
      await prisma.property.deleteMany({ where: { id: propertyId } });
    }

    const userIds = [adminId, advertiserId].filter((id) => id !== undefined);
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    await app.close();
  });

  describe('GET /analytics/advertiser/summary', () => {
    it('should return correct summary for advertiser', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics/advertiser/summary')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .expect(200);

      const data = res.body.data;
      expect(data.activeCampaigns).toBe(1);
      expect(data.totalSpent).toBe('1000000');
    });

    it('should return 403 for Admin role', async () => {
      await request(app.getHttpServer())
        .get('/analytics/advertiser/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });
  });

  describe('GET /analytics/admin/summary', () => {
    it('should return global summary for admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics/admin/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const data = res.body.data;

      // [FIX] Gunakan GreaterThanOrEqual agar tidak fail jika ada campaign lain dari test parallel
      expect(Number(data.totalRevenue)).toBeGreaterThanOrEqual(1000000);

      expect(data.totalScreens).toBeGreaterThanOrEqual(1);
    });
  });
});
