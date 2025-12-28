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
    email: `media_final_${Date.now()}@test.com`,
    password: 'password123',
  };

  // 1. Valid 1x1 Pixel JPEG (Full Structure)
  const validJpgBase64 =
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const jpgBuffer = Buffer.from(validJpgBase64, 'base64');

  // 2. Valid Minimal MP4 Container (ISO Base Media)
  const validMp4Base64 =
    'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAACVtZGF0';
  const mp4Buffer = Buffer.from(validMp4Base64, 'base64');

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
          // Kirim Buffer Valid JPG + Nama File + MIME Type
          .attach('file', jpgBuffer, {
            filename: 'test.jpg',
            contentType: 'image/jpeg',
          })
          .expect((res) => {
            // Debugging log jika masih error (akan muncul di console)
            if (res.status !== 201) {
              console.error(
                'Image Upload Error Response:',
                JSON.stringify(res.body, null, 2),
              );
            }
          })
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
          // Kirim Buffer Valid MP4
          .attach('file', mp4Buffer, {
            filename: 'video.mp4',
            contentType: 'video/mp4',
          })
          .expect((res) => {
            if (res.status !== 201) {
              console.error(
                'Video Upload Error Response:',
                JSON.stringify(res.body, null, 2),
              );
            }
          })
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

    it('should fail for unsupported file type', async () => {
      // Kirim buffer sembarang dengan ekstensi .pdf
      const buffer = Buffer.from('fake-pdf-content');
      return request(app.getHttpServer())
        .post('/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', buffer, {
          filename: 'doc.pdf',
          contentType: 'application/pdf',
        })
        .expect(422);
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
          // Harapannya >= 2 karena image dan video di atas sukses
          expect(res.body.length).toBeGreaterThanOrEqual(2);
        });
    });
  });
});
