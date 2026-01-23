import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/providers/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ApprovalStatus, Role } from '@prisma/client';
import { join } from 'path';
import * as fs from 'fs';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor';
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { Server } from 'http';

// [FIX] Definisi Interface untuk Response Type Safety
interface MediaItem {
  id: number;
  status: ApprovalStatus;
}

interface UploadResponse {
  data: MediaItem;
}

interface PendingListResponse {
  data: MediaItem[];
}

describe('MediaModule (e2e) - Moderation', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let advertiserToken: string;
  let adminToken: string;
  let httpServer: Server; // [FIX] Deklarasi server dengan tipe yang benar

  // Track IDs for targeted cleanup
  let advertiserId: number;
  let adminId: number;
  let mediaId: number;

  const fixturesDir = join(__dirname, 'fixtures');
  const testImage = join(fixturesDir, 'test-image.jpg');

  beforeAll(async () => {
    // 0. Setup Fixture
    if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir);
    fs.writeFileSync(testImage, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    // [FIX] Casting server agar aman digunakan di supertest
    httpServer = app.getHttpServer() as Server;

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    configService = app.get<ConfigService>(ConfigService);

    // Setup S3 (Mock/MinIO)
    // [FIX] Menggunakan generics untuk configService.get agar return typenya aman
    const endpoint = configService.get<string>('minio.endpoint') ?? 'localhost';
    const port = configService.get<number>('minio.port') ?? 9000;
    const bucketName =
      configService.get<string>('minio.bucket') ?? 'test-bucket';

    // [FIX] Casting accessKey dan secretKey sebagai string karena .get bisa return undefined
    const accessKeyId =
      configService.get<string>('minio.accessKey') ?? 'minioadmin';
    const secretAccessKey =
      configService.get<string>('minio.secretKey') ?? 'minioadmin';

    const s3 = new S3Client({
      endpoint: `http://${endpoint}:${port}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });
    try {
      await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch {
      await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
    }

    const jwtSecret = configService.get<string>('jwt.secret') || 'secret_key';

    // 1. Create Advertiser
    const advertiser = await prisma.user.create({
      data: {
        email: `adv_media_${Date.now()}@test.com`,
        password: 'hash',
        name: 'Advertiser Media',
        role: Role.ADVERTISER,
        phone: '08123456789',
      },
    });
    advertiserId = advertiser.id;
    advertiserToken = jwtService.sign(
      { sub: advertiser.id, email: advertiser.email, role: advertiser.role },
      { secret: jwtSecret },
    );

    // 2. Create Admin
    const admin = await prisma.user.create({
      data: {
        email: `admin_media_${Date.now()}@test.com`,
        password: 'hash',
        name: 'Super Admin Media',
        role: Role.SUPER_ADMIN,
      },
    });
    adminId = admin.id;
    adminToken = jwtService.sign(
      { sub: admin.id, email: admin.email, role: admin.role },
      { secret: jwtSecret },
    );
  });

  afterAll(async () => {
    // Targeted Cleanup Only
    if (mediaId) await prisma.media.deleteMany({ where: { id: mediaId } });
    if (advertiserId) {
      await prisma.wallet.deleteMany({ where: { userId: advertiserId } });
      await prisma.user.deleteMany({
        where: { id: { in: [advertiserId, adminId] } },
      });
    }

    if (fs.existsSync(testImage)) fs.unlinkSync(testImage);
    if (fs.existsSync(fixturesDir)) fs.rmdirSync(fixturesDir);
    await app.close();
  });

  describe('Workflow: Upload -> Pending -> Admin Approve', () => {
    it('1. Advertiser uploads media', async () => {
      const res = await request(httpServer)
        .post('/media/upload')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .attach('file', testImage)
        .expect(201);

      // [FIX] Type assertion menggunakan 'as UploadResponse'
      const body = res.body as UploadResponse;
      expect(body.data.status).toBe(ApprovalStatus.PENDING);
      mediaId = body.data.id;
    });

    it('2. Admin checks pending queue', async () => {
      const res = await request(httpServer)
        .get('/media/pending')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // [FIX] Type assertion menggunakan 'as PendingListResponse'
      const body = res.body as PendingListResponse;
      const found = body.data.find((m) => m.id === mediaId);
      expect(found).toBeDefined();
    });

    it('3. Admin Approves the media', async () => {
      const res = await request(httpServer)
        .patch(`/media/${mediaId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ApprovalStatus.APPROVED })
        .expect(200);

      const body = res.body as UploadResponse;
      expect(body.data.status).toBe(ApprovalStatus.APPROVED);
    });

    it('4. Admin Rejects media (Fail Validation)', async () => {
      await request(httpServer)
        .patch(`/media/${mediaId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ApprovalStatus.REJECTED })
        .expect(400);
    });

    it('5. Admin Rejects media (Success)', async () => {
      const res = await request(httpServer)
        .patch(`/media/${mediaId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ApprovalStatus.REJECTED, rejectionReason: 'Policy' })
        .expect(200);

      const body = res.body as UploadResponse;
      expect(body.data.status).toBe(ApprovalStatus.REJECTED);
    });

    it('6. Advertiser tries to moderate (Fail)', async () => {
      await request(httpServer)
        .patch(`/media/${mediaId}/review`)
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({ status: ApprovalStatus.APPROVED })
        .expect(403);
    });
  });
});
