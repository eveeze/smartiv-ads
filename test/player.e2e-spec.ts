import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/providers/prisma/prisma.service';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor';
import {
  ApprovalStatus,
  CampaignStatus,
  MediaType,
  AdSlot,
  Role,
} from '@prisma/client';
import { applyBigIntSerializers } from '../src/common/utils/bigint.util';
import { Server } from 'http';

// [FIX] 1. Definisi Interface untuk Response Type Safety
interface PlayerConfig {
  screenId: number;
  propertyName: string;
  refreshInterval: number;
}

interface PlaylistItem {
  campaignId: number;
  mediaId: number;
  duration: number;
}

interface PlaylistResponse {
  totalItems: number;
  items: PlaylistItem[];
}

// Wrapper generic untuk response standard { data: T }
interface ApiResponse<T> {
  data: T;
}

describe('PlayerModule (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  // [FIX] 2. Deklarasikan httpServer dengan tipe jelas
  let httpServer: Server;

  // Data IDs
  let propertyId: number;
  let screenId: number;
  let mediaId: number;
  let campaignId: number;
  let advertiserId: number;

  const deviceCode = 'PLAYER-E2E-TEST-001';

  beforeAll(async () => {
    applyBigIntSerializers();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    // [FIX] 3. Explicit Casting 'as Server' untuk menghilangkan error unsafe assignment
    httpServer = app.getHttpServer() as Server;
    prisma = app.get<PrismaService>(PrismaService);

    // --- SEED DATA ---

    // 1. Create Advertiser
    const advertiser = await prisma.user.create({
      data: {
        email: `player_adv_${Date.now()}@test.com`,
        password: 'hash',
        role: Role.ADVERTISER,
        name: 'Player Advertiser',
      },
    });
    advertiserId = advertiser.id;

    // 2. Create Property
    const property = await prisma.property.create({
      data: {
        name: 'Player Test Hotel',
        classification: 'PREMIUM',
        address: 'Jl. Test E2E',
        city: 'Metropolis',
      },
    });
    propertyId = property.id;

    // 3. Create Screen (The Device)
    const screen = await prisma.screen.create({
      data: {
        propertyId: property.id,
        name: 'Lobby TV',
        code: deviceCode, // IMPORTANT: Used for Header
        orientation: 'LANDSCAPE',
        status: 'OFFLINE', // Initial status
      },
    });
    screenId = screen.id;

    // 4. Create Media
    const media = await prisma.media.create({
      data: {
        uploaderId: advertiserId,
        filename: 'ad.jpg',
        originalName: 'ad.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        type: MediaType.IMAGE,
        url: 'http://minio/ad.jpg',
        status: ApprovalStatus.APPROVED,
      },
    });
    mediaId = media.id;

    // 5. Create Active Campaign Targeting this Screen
    const campaign = await prisma.campaign.create({
      data: {
        advertiserId,
        name: 'Active Ad',
        startDate: new Date(), // Today
        endDate: new Date(new Date().setDate(new Date().getDate() + 1)), // Tomorrow
        totalCost: 100000,
        status: CampaignStatus.ACTIVE,
        screens: { connect: { id: screenId } },
      },
    });
    campaignId = campaign.id;

    await prisma.campaignItem.create({
      data: {
        campaignId,
        mediaId,
        targetSlot: AdSlot.SCREENSAVER,
        durationSec: 15,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.campaignItem.deleteMany({ where: { campaignId } });
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
    await prisma.media.deleteMany({ where: { id: mediaId } });
    await prisma.screen.deleteMany({ where: { id: screenId } });
    await prisma.property.deleteMany({ where: { id: propertyId } });
    await prisma.user.deleteMany({ where: { id: advertiserId } });
    await app.close();
  });

  describe('Security & Auth', () => {
    it('should return 401 if X-Device-ID is missing', async () => {
      // [FIX] Gunakan httpServer yang sudah ditiping
      await request(httpServer).get('/player/config').expect(401);
    });

    it('should return 401 if X-Device-ID is invalid', async () => {
      await request(httpServer)
        .get('/player/config')
        .set('X-Device-ID', 'WRONG-CODE')
        .expect(401);
    });
  });

  describe('GET /player/config', () => {
    it('should return config for valid device', async () => {
      const res = await request(httpServer)
        .get('/player/config')
        .set('X-Device-ID', deviceCode)
        .expect(200);

      // [FIX] 4. Type Casting response body agar member access aman
      const body = res.body as ApiResponse<PlayerConfig>;
      const data = body.data;

      expect(data.screenId).toBe(screenId);
      expect(data.propertyName).toBe('Player Test Hotel');
      expect(data.refreshInterval).toBe(900);
    });
  });

  describe('GET /player/playlist', () => {
    it('should return active playlist items', async () => {
      const res = await request(httpServer)
        .get('/player/playlist')
        .set('X-Device-ID', deviceCode)
        .expect(200);

      // [FIX] 5. Type Casting response body untuk playlist
      const body = res.body as ApiResponse<PlaylistResponse>;
      const data = body.data;

      expect(data.totalItems).toBe(1);
      // Akses array item juga aman karena sudah ditiping di interface
      expect(data.items[0].campaignId).toBe(campaignId);
      expect(data.items[0].mediaId).toBe(mediaId);
      expect(data.items[0].duration).toBe(15);
    });
  });

  describe('POST /player/heartbeat', () => {
    it('should update device status to ONLINE', async () => {
      // 1. Initial check (was seeded as OFFLINE)
      // We skip manual check here to keep test clean, assuming create worked.

      // 2. Send Heartbeat
      await request(httpServer)
        .post('/player/heartbeat')
        .set('X-Device-ID', deviceCode)
        .send({
          ipAddress: '10.20.30.40',
          freeStorage: 5000000,
        })
        .expect(201); // Created

      // 3. Verify Database Update
      const updatedScreen = await prisma.screen.findUnique({
        where: { id: screenId },
      });

      expect(updatedScreen?.status).toBe('ONLINE');
      expect(updatedScreen?.ipAddress).toBe('10.20.30.40');
      expect(updatedScreen?.lastPing).not.toBeNull();
    });
  });
});
