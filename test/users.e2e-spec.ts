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
    // Whitelist: true penting untuk memfilter properti yang tidak ada di DTO (security)
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);
    const configService = app.get<ConfigService>(ConfigService);
    const jwtSecret = configService.get<string>('jwt.secret') || 'secret_key';

    // 1. Create Admin
    const admin = await prisma.user.create({
      data: {
        email: `u_adm_${Date.now()}@t.com`,
        password: 'hash_password',
        name: 'Adm',
        role: Role.SUPER_ADMIN,
        phone: '08111111111',
      },
    });
    adminId = admin.id;
    adminToken = jwtService.sign(
      { sub: admin.id, email: admin.email, role: admin.role },
      { secret: jwtSecret },
    );

    // 2. Create Advertiser
    const advertiser = await prisma.user.create({
      data: {
        email: `u_adv_${Date.now()}@t.com`,
        password: 'hash_password',
        name: 'Adv',
        role: Role.ADVERTISER,
        phone: '08222222222',
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

  // [NEW] Test Self-Service Update Profile
  describe('PATCH /users/profile', () => {
    it('Should update own profile (Name & Phone)', async () => {
      const newName = 'Advertiser Updated';
      const newPhone = '081234567890';

      await request(app.getHttpServer())
        .patch('/users/profile')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({
          name: newName,
          phone: newPhone,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.name).toBe(newName);
          expect(res.body.data.phone).toBe(newPhone);
        });

      // Verify DB persistence
      const updatedUser = await prisma.user.findUnique({
        where: { id: advertiserId },
      });
      expect(updatedUser?.name).toBe(newName);
      expect(updatedUser?.phone).toBe(newPhone);
    });

    it('Should IGNORE restricted fields (Email, Role, Password)', async () => {
      const originalUser = await prisma.user.findUnique({
        where: { id: advertiserId },
      });

      await request(app.getHttpServer())
        .patch('/users/profile')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({
          email: 'hacker@test.com',
          role: Role.SUPER_ADMIN,
          password: 'new_password',
          name: 'Name Changed Only',
        })
        .expect(200);

      const checkUser = await prisma.user.findUnique({
        where: { id: advertiserId },
      });

      // Assert fields NOT changed
      expect(checkUser?.email).toBe(originalUser?.email);
      expect(checkUser?.role).toBe(originalUser?.role);
      expect(checkUser?.password).toBe(originalUser?.password);

      // Assert allowed field CHANGED
      expect(checkUser?.name).toBe('Name Changed Only');
    });

    it('Should fail if phone number format is invalid', async () => {
      await request(app.getHttpServer())
        .patch('/users/profile')
        .set('Authorization', `Bearer ${advertiserToken}`)
        .send({
          phone: 'invalid-phone-number',
        })
        .expect(400); // Bad Request from ValidationPipe (@IsPhoneNumber)
    });
  });
});
