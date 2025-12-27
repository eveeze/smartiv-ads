import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/providers/prisma/prisma.service';
import { AdSlot, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

describe('InventoryModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  const uniqueId = Date.now();
  const adminUser = {
    email: `admin_${uniqueId}@smartiv.com`,
    password: 'SuperSecretAdmin123!',
    role: Role.SUPER_ADMIN,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Seed Admin
    const hashedPassword = await bcrypt.hash(adminUser.password, 10);
    await prisma.user.create({
      data: {
        email: adminUser.email,
        password: hashedPassword,
        name: 'Test Admin',
        role: Role.SUPER_ADMIN,
        wallet: { create: { balance: 0 } },
      },
    });

    // Login Admin
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminUser.email, password: adminUser.password });

    adminToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup
    const property = await prisma.property.findFirst({
      where: { smartivCode: `TEST-${uniqueId}` },
    });

    if (property) {
      await prisma.screen.deleteMany({ where: { propertyId: property.id } });
      await prisma.property.delete({ where: { id: property.id } });
    }

    await prisma.wallet.deleteMany({
      where: { user: { email: adminUser.email } },
    });
    await prisma.user.delete({ where: { email: adminUser.email } });

    await app.close();
  });

  let propertyId: number;
  let screenId: number;

  describe('/inventory/properties (CRUD)', () => {
    it('POST /properties - Create', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/properties')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Hotel',
          smartivCode: `TEST-${uniqueId}`,
          enabledSlots: [AdSlot.SCREENSAVER],
        })
        .expect(201);

      propertyId = res.body.id;
      expect(res.body.name).toBe('E2E Hotel');
    });

    it('GET /properties - List with Pagination', () => {
      return request(app.getHttpServer())
        .get('/inventory/properties?page=1&take=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBeGreaterThan(0);
          expect(res.body.meta.total).toBeGreaterThan(0);
        });
    });

    it('PATCH /properties/:id - Update', () => {
      return request(app.getHttpServer())
        .patch(`/inventory/properties/${propertyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'E2E Hotel Updated' })
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('E2E Hotel Updated');
        });
    });
  });

  describe('/inventory/screens (CRUD)', () => {
    it('POST /screens - Create', async () => {
      // Guard clause untuk TS
      if (!propertyId) throw new Error('Property creation failed');

      const res = await request(app.getHttpServer())
        .post('/inventory/screens')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          propertyId,
          code: `MAC-${uniqueId}`,
          name: 'Lobby TV',
        })
        .expect(201);
      screenId = res.body.id;
    });

    it('PATCH /screens/:id - Update', () => {
      return request(app.getHttpServer())
        .patch(`/inventory/screens/${screenId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Lobby TV Updated' })
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Lobby TV Updated');
        });
    });

    it('DELETE /screens/:id - Remove', () => {
      return request(app.getHttpServer())
        .delete(`/inventory/screens/${screenId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  // Cleanup Property via API DELETE
  it('DELETE /properties/:id - Remove Property', () => {
    return request(app.getHttpServer())
      .delete(`/inventory/properties/${propertyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
