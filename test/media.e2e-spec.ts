import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/providers/prisma/prisma.service';
import { StorageService } from '../src/providers/storage/storage.service';
import { QueueService } from '../src/providers/queue/queue.service';
import { Role, ApprovalStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

describe('MediaModule (e2e) - Moderation', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let advertiserToken: string;
  let adminToken: string;
  let uploadedMediaId: number;

  const mockStorageService = {
    uploadFile: jest.fn().mockResolvedValue('http://mock-s3/file.url'),
  };
  const mockQueueService = {
    addTranscodeJob: jest.fn().mockResolvedValue(undefined),
  };

  // Valid JPG Header (untuk bypass FileSignatureValidatorPipe)
  const validJpgBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ]);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StorageService)
      .useValue(mockStorageService)
      .overrideProvider(QueueService)
      .useValue(mockQueueService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Clean DB (Urutan Penting: Media -> Wallet -> User)
    await prisma.media.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.user.deleteMany();

    // 1. Create Advertiser
    const password = await bcrypt.hash('password123', 10);
    const advertiser = await prisma.user.create({
      data: {
        email: 'advertiser@test.com',
        password,
        role: Role.ADVERTISER,
        wallet: { create: { balance: 0 } },
      },
    });
    const advLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'advertiser@test.com', password: 'password123' });
    advertiserToken = advLogin.body.accessToken;

    // 2. Create Admin
    await prisma.user.create({
      data: {
        email: 'admin@test.com',
        password,
        role: Role.SUPER_ADMIN,
        wallet: { create: { balance: 0 } },
      },
    });
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' });
    adminToken = adminLogin.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup Akhir (Urutan Penting!)
    await prisma.media.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('Workflow: Upload -> Pending -> Admin Approve', () => {
    it('1. Advertiser uploads media (Status should be PENDING)', async () => {
      const res = await request(app.getHttpServer())
        .post('/media/upload')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .attach('file', validJpgBuffer, { filename: 'ad.jpg' })
        .expect(201);

      uploadedMediaId = res.body.id;
      expect(res.body.status).toBe(ApprovalStatus.PENDING);
    });

    it('2. Admin checks pending queue', async () => {
      const res = await request(app.getHttpServer())
        .get('/media/pending')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].status).toBe(ApprovalStatus.PENDING);
    });

    it('3. Admin Approves the media', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/media/${uploadedMediaId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ApprovalStatus.APPROVED })
        .expect(200);

      expect(res.body.status).toBe(ApprovalStatus.APPROVED);
      expect(res.body.reviewedBy).toBeDefined();
    });

    it('4. Admin Rejects media (Fail Validation without Reason)', async () => {
      // Buat media baru untuk direject
      const uploadRes = await request(app.getHttpServer())
        .post('/media/upload')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .attach('file', validJpgBuffer, { filename: 'bad.jpg' })
        .expect(201);

      const mediaId = uploadRes.body.id;

      // Coba Reject tanpa alasan
      await request(app.getHttpServer())
        .patch(`/media/${mediaId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ApprovalStatus.REJECTED })
        .expect(400); // Bad Request (ValidationPipe)
    });

    it('5. Admin Rejects media (Success with Reason)', async () => {
      // Ambil media pending lain (atau yang baru dibuat jika perlu)
      const pendingMedia = await prisma.media.findFirst({
        where: { status: ApprovalStatus.PENDING },
      });

      // FIX: Pastikan media ditemukan sebelum lanjut (Handling Null Safety)
      if (!pendingMedia) {
        throw new Error('No pending media found for test case');
      }

      const res = await request(app.getHttpServer())
        .patch(`/media/${pendingMedia.id}/review`) // Aman diakses karena sudah dicek
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: ApprovalStatus.REJECTED,
          rejectionReason: 'Blurry Image',
        })
        .expect(200);

      expect(res.body.status).toBe(ApprovalStatus.REJECTED);
      expect(res.body.rejectionReason).toBe('Blurry Image');
    });

    it('6. Advertiser tries to moderate (Should Fail)', async () => {
      await request(app.getHttpServer())
        .get('/media/pending')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .expect(403); // Forbidden
    });
  });
});
