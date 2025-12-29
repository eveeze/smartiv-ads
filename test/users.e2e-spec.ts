import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/providers/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor';

describe('UsersModule (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let advertiserToken: string;

  // Track IDs
  let adminId: number;
  let advertiserId: number;

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

    const admin = await prisma.user.create({
      data: {
        email: `u_adm_${Date.now()}@t.com`,
        password: 'h',
        name: 'Adm',
        role: Role.SUPER_ADMIN,
      },
    });
    adminId = admin.id;
    adminToken = jwtService.sign(
      { sub: admin.id, email: admin.email, role: admin.role },
      { secret: jwtSecret },
    );

    const advertiser = await prisma.user.create({
      data: {
        email: `u_adv_${Date.now()}@t.com`,
        password: 'h',
        name: 'Adv',
        role: Role.ADVERTISER,
      },
    });
    advertiserId = advertiser.id;
    advertiserToken = jwtService.sign(
      { sub: advertiser.id, email: advertiser.email, role: advertiser.role },
      { secret: jwtSecret },
    );
  });

  afterAll(async () => {
    // [FIX] Targeted Cleanup
    await prisma.user.deleteMany({
      where: { id: { in: [adminId, advertiserId] } },
    });
    await app.close();
  });

  describe('GET /users', () => {
    it('Admin should be able to get list', async () => {
      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
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
        .get(`/users/${advertiserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.data.id).toBe(advertiserId);
    });

    it('Advertiser should be Forbidden', async () => {
      await request(app.getHttpServer())
        .get(`/users/${advertiserId}`)
        .set('Authorization', `Bearer ${advertiserToken}`)
        .expect(403);
    });
  });
});
