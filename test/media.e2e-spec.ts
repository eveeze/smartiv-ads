import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/providers/prisma/prisma.service';
import { StorageService } from '../src/providers/storage/storage.service';
import { QueueService } from '../src/providers/queue/queue.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

describe('MediaModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  const mockStorageService = {
    uploadFile: jest.fn().mockResolvedValue('http://mock-s3/file.jpg'),
  };
  const mockQueueService = {
    addTranscodeJob: jest.fn().mockResolvedValue(undefined),
  };

  const testUser = {
    email: `media_test_${Date.now()}@test.com`,
    password: 'password123',
  };

  // Setup file dummy fisik untuk tes agar MIME type terdeteksi sempurna
  const tempJpg = path.join(__dirname, 'temp_test.jpg');
  const tempMp4 = path.join(__dirname, 'temp_test.mp4');
  const tempPdf = path.join(__dirname, 'temp_test.pdf');

  beforeAll(async () => {
    // Buat file dummy
    fs.writeFileSync(tempJpg, Buffer.from([0xff, 0xd8, 0xff, 0xe0])); // Header JPG
    fs.writeFileSync(
      tempMp4,
      Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]),
    ); // Header MP4
    fs.writeFileSync(tempPdf, Buffer.from('%PDF-1.5')); // Header PDF

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

    const hashedPassword = await bcrypt.hash(testUser.password, 10);
    const user = await prisma.user.create({
      data: {
        email: testUser.email,
        password: hashedPassword,
        name: 'Media Tester',
        role: Role.ADVERTISER,
        wallet: { create: { balance: 0 } },
      },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send(testUser);
    token = loginRes.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup file dummy
    if (fs.existsSync(tempJpg)) fs.unlinkSync(tempJpg);
    if (fs.existsSync(tempMp4)) fs.unlinkSync(tempMp4);
    if (fs.existsSync(tempPdf)) fs.unlinkSync(tempPdf);

    // Cleanup DB
    const user = await prisma.user.findUnique({
      where: { email: testUser.email },
    });

    if (user) {
      await prisma.media.deleteMany({ where: { uploaderId: user.id } });
      await prisma.wallet.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }

    await app.close();
  });

  describe('/media/upload (POST)', () => {
    it('should upload an image successfully', async () => {
      return (
        request(app.getHttpServer())
          .post('/media/upload')
          .set('Authorization', `Bearer ${token}`)
          // Gunakan file fisik
          .attach('file', tempJpg)
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('id');
            expect(res.body.mimeType).toBe('image/jpeg');
            expect(res.body.isTranscoded).toBe(true);
          })
      );
    });

    it('should upload a video and queue it', async () => {
      return request(app.getHttpServer())
        .post('/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', tempMp4)
        .expect(201)
        .expect((res) => {
          expect(res.body.mimeType).toBe('video/mp4');
          expect(res.body.isTranscoded).toBe(false);
        });
    });

    it('should fail if no file attached', async () => {
      return request(app.getHttpServer())
        .post('/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .expect(422); // Unprocessable Entity (File required)
    });

    it('should fail for unsupported file type', async () => {
      return request(app.getHttpServer())
        .post('/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', tempPdf)
        .expect(422); // Unprocessable Entity (FileTypeValidator)
    });
  });

  describe('/media (GET)', () => {
    it('should list uploaded media', async () => {
      return request(app.getHttpServer())
        .get('/media')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(2);
        });
    });
  });
});
