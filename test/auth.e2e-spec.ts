import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest'; // <--- PERUBAHAN DI SINI
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/providers/prisma/prisma.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Gunakan email unik setiap run agar tidak bentrok Unique Constraint DB
  const uniqueId = Date.now();
  const testUser = {
    email: `e2e_test_${uniqueId}@smartiv.com`,
    password: 'SuperSecret123!',
    name: 'E2E Tester',
    phone: '08129999999',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Pastikan ValidationPipe aktif sama seperti di main.ts
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });
  afterAll(async () => {
    // Cek apakah prisma ada sebelum akses
    if (prisma) {
      const user = await prisma.user.findUnique({
        where: { email: testUser.email },
      });
      if (user) {
        await prisma.wallet.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
    }

    // Cek apakah app ada sebelum close
    if (app) {
      await app.close();
    }
  });

  describe('/auth/register (POST)', () => {
    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.email).toEqual(testUser.email);
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('should fail if email already exists', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(400); // Expect BadRequest
    });

    it('should fail validation if password too short', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...testUser, email: 'fail@test.com', password: '123' })
        .expect(400);
    });
  });

  describe('/auth/login (POST)', () => {
    it('should login and return jwt token', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(201) // Default NestJS POST status is 201
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body.user).toHaveProperty('email', testUser.email);
        });
    });

    it('should fail with invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword!',
        })
        .expect(401);
    });
  });

  // Test route terproteksi
  describe('/auth/me (GET)', () => {
    let accessToken: string;

    // Login dulu untuk dapat token
    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password });
      accessToken = res.body.accessToken;
    });

    it('should get profile with valid token', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.email).toEqual(testUser.email);
        });
    });

    it('should fail without token', () => {
      return request(app.getHttpServer()).get('/auth/me').expect(401);
    });
  });
});
