import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest'; // [FIX] Ganti import * as menjadi import default
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/providers/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let accessToken: string;

  const testUserEmail = `auth_test_${Date.now()}@example.com`;
  const registerUserEmail = `auth_reg_${Date.now()}@example.com`;

  const cleanupUsers = async () => {
    const targetEmails = [testUserEmail, registerUserEmail];
    const users = await prisma.user.findMany({
      where: { email: { in: targetEmails } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);

    if (userIds.length > 0) {
      await prisma.wallet.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    const configService = app.get<ConfigService>(ConfigService);
    const jwtSecret = configService.get<string>('jwt.secret') || 'secret_key';

    await cleanupUsers();

    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = await prisma.user.create({
      data: {
        email: testUserEmail,
        password: hashedPassword,
        name: 'E2E Test User',
        role: Role.ADVERTISER,
        phone: '08123456789',
      },
    });
    await prisma.wallet.create({ data: { userId: user.id } });

    accessToken = jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      { secret: jwtSecret },
    );
  });

  afterAll(async () => {
    await cleanupUsers();
    await app.close();
  });

  describe('/auth/register (POST)', () => {
    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: registerUserEmail,
          password: 'password123',
          name: 'New User',
          phone: '08123456780',
        })
        .expect(201);
    });
  });

  describe('/auth/login (POST)', () => {
    it('should login and return jwt token', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUserEmail, password: 'password123' })
        .expect(200) // Expect 200 OK
        .expect((res) => {
          expect(res.body.data.accessToken).toBeDefined();
        });
    });

    it('should fail with wrong password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUserEmail, password: 'wrongpassword' })
        .expect(401);
    });
  });

  describe('/auth/me (GET)', () => {
    it('should get profile with valid token', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.email).toEqual(testUserEmail);
        });
    });

    it('should fail without token', () => {
      return request(app.getHttpServer()).get('/auth/me').expect(401);
    });
  });
});
