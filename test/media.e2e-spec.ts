import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/providers/prisma/prisma.service';
import { StorageService } from '../src/providers/storage/storage.service';
import { QueueService } from '../src/providers/queue/queue.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

describe('MediaModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  const mockStorageService = {
    uploadFile: jest.fn().mockResolvedValue('http://mock-s3/file.url'),
  };
  const mockQueueService = {
    addTranscodeJob: jest.fn().mockResolvedValue(undefined),
  };

  const testUser = {
    email: `media_secure_${Date.now()}@test.com`,
    password: 'password123',
  };

  // HEADER BINARY ASLI (PENTING UNTUK SECURITY CHECK)
  // Ini adalah data hex minimal agar library 'file-type' mengenalinya sebagai JPG & MP4
  const validJpgBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ]);
  const validMp4Buffer = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    0x00, 0x00, 0x02, 0x00,
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

    const hashedPassword = await bcrypt.hash(testUser.password, 10);
    await prisma.user.create({
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
          // Kirim Buffer Valid
          .attach('file', validJpgBuffer, { filename: 'test.jpg' })
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('id');
            expect(res.body.mimeType).toBe('image/jpeg');
            expect(res.body.isTranscoded).toBe(true);
          })
      );
    });

    it('should upload a video and queue it', async () => {
      return (
        request(app.getHttpServer())
          .post('/media/upload')
          .set('Authorization', `Bearer ${token}`)
          // Kirim Buffer Valid
          .attach('file', validMp4Buffer, { filename: 'video.mp4' })
          .expect(201)
          .expect((res) => {
            expect(res.body.mimeType).toBe('video/mp4');
            expect(res.body.isTranscoded).toBe(false);
          })
      );
    });

    it('should fail if no file attached', async () => {
      return request(app.getHttpServer())
        .post('/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .expect(422);
    });

    // Test Security: Kirim file sampah tapi rename jadi .jpg
    it('should fail for fake file content (Security Check)', async () => {
      const fakeBuffer = Buffer.from('ini-bukan-gambar-beneran');
      return (
        request(app.getHttpServer())
          .post('/media/upload')
          .set('Authorization', `Bearer ${token}`)
          // Kita coba tipu server dengan ekstensi jpg
          .attach('file', fakeBuffer, { filename: 'hacker.jpg' })
          .expect(422) // HARUS GAGAL (Unprocessable Entity) karena magic bytes salah
          .expect((res) => {
            // Pastikan pesan errornya dari validator kita
            expect(res.body.message).toContain('Validation failed');
          })
      );
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
