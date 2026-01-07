import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/providers/prisma/prisma.service';
import { QueueService } from '../src/providers/queue/queue.service';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor'; // [FIX] Import Interceptor
import { applyBigIntSerializers } from '../src/common/utils/bigint.util';

describe('Telemetry Module (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Mock Queue Service
  const mockQueueService = {
    addImpressionJob: jest.fn().mockResolvedValue(true),
  };

  let deviceId: string;
  let screenId: number;

  beforeAll(async () => {
    applyBigIntSerializers();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(QueueService)
      .useValue(mockQueueService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalInterceptors(new TransformInterceptor()); // [FIX] Gunakan Interceptor
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // 1. Setup Data: Buat Property & Screen untuk Auth
    const property = await prisma.property.create({
      data: {
        name: 'Telemetry Test Prop',
        classification: 'STANDARD',
        type: 'MALL',
      },
    });

    deviceId = `MAC-TELEMETRY-${Date.now()}`;
    const screen = await prisma.screen.create({
      data: {
        propertyId: property.id,
        name: 'Screen 1',
        code: deviceId, // Ini X-Device-ID
        orientation: 'LANDSCAPE',
      },
    });
    screenId = screen.id;
  });

  afterAll(async () => {
    // Cleanup DB
    await prisma.screen.deleteMany({ where: { id: screenId } });
    await prisma.property.deleteMany({
      where: { name: 'Telemetry Test Prop' },
    });
    await app.close();
  });

  describe('POST /telemetry/impression', () => {
    it('should return 401 if X-Device-ID header is missing', async () => {
      await request(app.getHttpServer())
        .post('/telemetry/impression')
        .send({ impressions: [] })
        .expect(401);
    });

    it('should ingest impressions and push to queue (202 Accepted)', async () => {
      const payload = {
        impressions: [
          {
            campaignId: 101,
            timestamp: new Date().toISOString(),
            duration: 15,
          },
          {
            campaignId: 102,
            timestamp: new Date().toISOString(),
            duration: 30,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/telemetry/impression')
        .set('X-Device-ID', deviceId) // Header Auth Player
        .send(payload)
        .expect(202); // Expect Accepted

      // Verifikasi Response (Sekarang ada .data karena Interceptor)
      expect(response.body.data.success).toBe(true);
      expect(response.body.data.queued).toBe(2);

      // Verifikasi Queue Service dipanggil
      expect(mockQueueService.addImpressionJob).toHaveBeenCalledWith(
        expect.objectContaining({
          screenId: screenId,
          impressions: expect.arrayContaining([
            expect.objectContaining({ campaignId: 101 }),
          ]),
        }),
      );
    });

    it('should return 400 for invalid payload', async () => {
      await request(app.getHttpServer())
        .post('/telemetry/impression')
        .set('X-Device-ID', deviceId)
        .send({ impressions: 'not-an-array' })
        .expect(400);
    });
  });
});
