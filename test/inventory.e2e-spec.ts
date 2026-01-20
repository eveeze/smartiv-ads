import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/providers/prisma/prisma.service';
import { AdSlot, Role, ScreenOrientation, RoomCategory } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor';
import { Server } from 'http'; // [FIX] Import type Server for explicit casting

// [FIX] Interface untuk Type Safety Response Body
interface CreateEntityResponse {
  data: {
    id: number;
  };
}

describe('InventoryModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let adminId: number; // Track ID

  const uniqueId = Date.now();

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
        email: `inv_admin_${uniqueId}@e2e.test`,
        password: await bcrypt.hash('secret', 10),
        name: 'Admin E2E',
        role: Role.SUPER_ADMIN,
      },
    });
    adminId = admin.id;
    adminToken = jwtService.sign(
      { sub: admin.id, email: admin.email, role: admin.role },
      { secret: jwtSecret },
    );
  });

  let propertyId: number;
  let screenId: number;

  afterAll(async () => {
    if (screenId) await prisma.screen.delete({ where: { id: screenId } });
    if (propertyId) await prisma.property.delete({ where: { id: propertyId } });
    if (adminId) await prisma.user.delete({ where: { id: adminId } });
    await app.close();
  });

  describe('Properties', () => {
    it('POST /inventory/properties - Create Success', async () => {
      // [FIX] Cast httpServer to Server type
      const res = await request(app.getHttpServer() as Server)
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

      // [FIX] Explicit casting to avoid accessing 'any'
      const body = res.body as CreateEntityResponse;
      propertyId = body.data.id;
    });

    it('GET /inventory/properties - List Pagination', async () => {
      // [FIX] Cast httpServer
      await request(app.getHttpServer() as Server)
        .get('/inventory/properties?page=1&take=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('GET /inventory/properties/list - Dropdown', async () => {
      // [FIX] Cast httpServer
      await request(app.getHttpServer() as Server)
        .get('/inventory/properties/list')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Screens', () => {
    it('POST /inventory/screens - Create Success', async () => {
      if (!propertyId) throw new Error('Property setup failed');
      // [FIX] Cast httpServer
      const res = await request(app.getHttpServer() as Server)
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

      // [FIX] Explicit casting to avoid accessing 'any'
      const body = res.body as CreateEntityResponse;
      screenId = body.data.id;
    });

    it('GET /inventory/screens/list - Dropdown Filtered', async () => {
      if (!propertyId) return;
      // [FIX] Cast httpServer
      await request(app.getHttpServer() as Server)
        .get(`/inventory/screens/list?propertyId=${propertyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});
