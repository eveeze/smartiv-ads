import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/providers/prisma/prisma.service';
import { AdSlot, Role, ScreenOrientation, RoomCategory } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config'; // [FIX] Import ConfigService
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor';

describe('InventoryModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService; // [FIX] Variable configService
  let adminToken: string;

  const uniqueId = Date.now();
  const adminEmail = `admin_${uniqueId}@e2e.test`;

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
    configService = app.get<ConfigService>(ConfigService); // [FIX] Init ConfigService

    // [FIX] Ambil secret yang benar dari ConfigService
    const jwtSecret =
      configService.get<string>('jwt.secret') ||
      process.env.JWT_SECRET ||
      'secret_key';

    // 1. Clean & Seed Admin
    await prisma.user.deleteMany({ where: { email: adminEmail } });

    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: await bcrypt.hash('secret', 10),
        name: 'Admin E2E',
        role: Role.SUPER_ADMIN,
        phone: `081${uniqueId}`,
      },
    });

    // 2. Generate Token Manual dengan Secret yang Benar
    adminToken = jwtService.sign(
      { sub: admin.id, email: admin.email, role: admin.role },
      { secret: jwtSecret },
    );
  });

  afterAll(async () => {
    const prop = await prisma.property.findFirst({
      where: { smartivCode: `E2E-${uniqueId}` },
    });
    if (prop) {
      await prisma.screen.deleteMany({ where: { propertyId: prop.id } });
      await prisma.property.delete({ where: { id: prop.id } });
    }
    await prisma.user.deleteMany({ where: { email: adminEmail } });
    await app.close();
  });

  let propertyId: number;
  let screenId: number;

  describe('Properties', () => {
    it('POST /inventory/properties - Create Success', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/properties')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Hotel',
          type: 'HOTEL',
          classification: 'PREMIUM',
          city: 'Jakarta',
          smartivCode: `E2E-${uniqueId}`,
          enabledSlots: [AdSlot.SCREENSAVER],
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();
      propertyId = res.body.data.id;
    });

    it('GET /inventory/properties - List Pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/properties?page=1&take=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data.data)).toBeTruthy();
      expect(res.body.data.meta).toBeDefined();
    });

    it('GET /inventory/properties/list - Dropdown', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/properties/list')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBeTruthy();
      expect(res.body.data[0]).toHaveProperty('id');
    });
  });

  describe('Screens', () => {
    it('POST /inventory/screens - Create Success', async () => {
      if (!propertyId)
        throw new Error('Cannot create screen: propertyId is undefined');

      const res = await request(app.getHttpServer())
        .post('/inventory/screens')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          propertyId: propertyId,
          name: 'Lobby TV',
          code: `SCR-${uniqueId}`,
          orientation: ScreenOrientation.LANDSCAPE,
          roomCategory: RoomCategory.LOBBY,
        })
        .expect(201);

      screenId = res.body.data.id;
    });

    it('GET /inventory/screens/list - Dropdown Filtered', async () => {
      if (!propertyId) return;

      const res = await request(app.getHttpServer())
        .get(`/inventory/screens/list?propertyId=${propertyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].code).toBe(`SCR-${uniqueId}`);
    });
  });
});
