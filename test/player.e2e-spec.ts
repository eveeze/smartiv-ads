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
  DurationPackage,
} from '@prisma/client';
import { applyBigIntSerializers } from '../src/common/utils/bigint.util';
import { Server } from 'http';

// [FIX] 1. Definisi Interface Baru (Phase 4)
interface PlayerConfig {
  screenId: number;
  screenName: string;
  refreshInterval: number;
  // [FIX] Nested Property Object
  property: {
    name: string;
    timezone: string;
    logo: string;
  };
}

interface PlaylistItem {
  campaignId: number;
  mediaId: number;
  duration: number;
  slot: AdSlot;
}

interface PlaylistResponse {
  slot: AdSlot;
  totalDuration: number;
  items: PlaylistItem[];
}

interface ApiResponse<T> {
  data: T;
}

describe('PlayerModule (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let httpServer: Server;

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

    httpServer = app.getHttpServer() as Server;
    prisma = app.get<PrismaService>(PrismaService);

    // --- SEED DATA ---
    const advertiser = await prisma.user.create({
      data: {
        email: `player_adv_${Date.now()}@test.com`,
        password: 'hash',
        role: Role.ADVERTISER,
        name: 'Player Advertiser',
      },
    });
    advertiserId = advertiser.id;

    // Create Property
    const property = await prisma.property.create({
      data: {
        name: 'Player Test Hotel',
        classification: 'PREMIUM',
        address: 'Jl. Test E2E',
        city: 'Metropolis',
        timezone: 'Asia/Jakarta',
        enabledSlots: [AdSlot.SCREENSAVER],
      },
    });
    propertyId = property.id;

    // Rate Card (Required for campaign calculation)
    await prisma.rateCard.create({
      data: {
        propertyId: property.id,
        targetSlot: AdSlot.SCREENSAVER,
        pricePerDay: BigInt(5000),
      },
    });

    // Create Screen
    const screen = await prisma.screen.create({
      data: {
        propertyId: property.id,
        name: 'Lobby TV',
        code: deviceCode,
        orientation: 'LANDSCAPE',
        status: 'ONLINE', // Must be online to be picked
      },
    });
    screenId = screen.id;

    // Create Media
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

    // Create Active Campaign
    const campaign = await prisma.campaign.create({
      data: {
        advertiserId,
        name: 'Active Ad',
        startDate: new Date(),
        endDate: new Date(new Date().setDate(new Date().getDate() + 7)),
        totalCost: 100000,
        status: CampaignStatus.ACTIVE,
        // [FIX] Phase 3 Fields
        propertyId: propertyId,
        targetSlot: AdSlot.SCREENSAVER,
        durationPackage: DurationPackage.WEEKLY,
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
    if (campaignId) {
      await prisma.campaignItem.deleteMany({ where: { campaignId } });
      await prisma.campaign.deleteMany({ where: { id: campaignId } });
    }
    await prisma.media.deleteMany({ where: { id: mediaId } });
    await prisma.screen.deleteMany({ where: { id: screenId } });
    await prisma.rateCard.deleteMany({ where: { propertyId } });
    await prisma.property.deleteMany({ where: { id: propertyId } });
    await prisma.user.deleteMany({ where: { id: advertiserId } });
    await app.close();
  });

  describe('GET /player/config', () => {
    it('should return config for valid device', async () => {
      const res = await request(httpServer)
        .get('/player/config')
        .set('X-Device-ID', deviceCode)
        .expect(200);

      const body = res.body as ApiResponse<PlayerConfig>;
      const data = body.data;

      expect(data.screenId).toBe(screenId);
      // [FIX] Perubahan struktur: nama property ada di dalam object property
      expect(data.property.name).toBe('Player Test Hotel');
      expect(data.property.timezone).toBe('Asia/Jakarta');
    });
  });

  describe('GET /player/playlist', () => {
    it('should return active playlist items', async () => {
      const res = await request(httpServer)
        .get('/player/playlist?slot=SCREENSAVER') // Explicit slot request
        .set('X-Device-ID', deviceCode)
        .expect(200);

      const body = res.body as ApiResponse<PlaylistResponse>;
      const data = body.data;

      // [FIX] Struktur baru tidak selalu punya totalItems di root, tapi array items
      expect(data.items.length).toBe(1);
      expect(data.items[0].campaignId).toBe(campaignId);
      expect(data.items[0].mediaId).toBe(mediaId);
      expect(data.items[0].slot).toBe(AdSlot.SCREENSAVER);
    });
  });

  describe('POST /player/heartbeat', () => {
    it('should update device status to ONLINE', async () => {
      await request(httpServer)
        .post('/player/heartbeat')
        .set('X-Device-ID', deviceCode)
        .send({
          ipAddress: '10.20.30.40',
          freeStorage: 5000000,
        })
        .expect(201);

      const updatedScreen = await prisma.screen.findUnique({
        where: { id: screenId },
      });

      expect(updatedScreen?.status).toBe('ONLINE');
      expect(updatedScreen?.ipAddress).toBe('10.20.30.40');
    });
  });
});
