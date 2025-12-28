import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/providers/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor'; // [IMPORT PENTING]

describe('UsersModule (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;

  let adminToken: string;
  let advertiserToken: string;
  let targetUserId: number;

  const uniqueSuffix = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // [FIX 1] Setup Interceptor
    app.useGlobalInterceptors(new TransformInterceptor());

    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    configService = app.get<ConfigService>(ConfigService);

    // [FIX 2] Gunakan secret dari ConfigService agar token valid
    const jwtSecret =
      configService.get<string>('jwt.secret') ||
      process.env.JWT_SECRET ||
      'secret_key';

    // 1. Create Admin
    const admin = await prisma.user.create({
      data: {
        email: `admin_${uniqueSuffix}@users.e2e`,
        name: 'Admin Users',
        password: 'hash',
        role: Role.SUPER_ADMIN,
        phone: `111${uniqueSuffix}`,
      },
    });
    adminToken = jwtService.sign(
      { sub: admin.id, email: admin.email, role: admin.role },
      { secret: jwtSecret },
    );

    // 2. Create Advertiser (Target)
    const advertiser = await prisma.user.create({
      data: {
        email: `adv_${uniqueSuffix}@users.e2e`,
        name: 'Advertiser Target',
        password: 'hash',
        role: Role.ADVERTISER,
        phone: `222${uniqueSuffix}`,
      },
    });
    targetUserId = advertiser.id;
    advertiserToken = jwtService.sign(
      { sub: advertiser.id, email: advertiser.email, role: advertiser.role },
      { secret: jwtSecret },
    );
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: '@users.e2e' } },
    });
    await app.close();
  });

  describe('GET /users', () => {
    it('Admin should be able to get list', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Karena Interceptor + PageDto: { data: { data: [], meta: {} } }
      expect(Array.isArray(res.body.data.data)).toBeTruthy();
      expect(res.body.data.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.meta).toBeDefined();
    });

    it('Advertiser should be Forbidden', async () => {
      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .expect(403);
    });
  });

  describe('GET /users/:id', () => {
    it('Admin should see user detail', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Karena Interceptor: { data: { id: ... } }
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe(targetUserId);
      expect(res.body.data.email).toContain('adv_');
      expect(res.body.data.password).toBeUndefined();
    });

    it('Advertiser should be Forbidden', async () => {
      await request(app.getHttpServer())
        .get(`/users/${targetUserId}`)
        .set('Authorization', `Bearer ${advertiserToken}`)
        .expect(403);
    });
  });
});
