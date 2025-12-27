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

    // 1. Seed Super Admin untuk keperluan test
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

    // 2. Login untuk dapat Token
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminUser.email, password: adminUser.password });

    adminToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup Data
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

  describe('/inventory/properties (POST)', () => {
    it('should allow Admin to create property', () => {
      return request(app.getHttpServer())
        .post('/inventory/properties')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Test Hotel',
          smartivCode: `TEST-${uniqueId}`, // Code unik
          enabledSlots: [AdSlot.SCREENSAVER, AdSlot.INFO_SLIDER],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('E2E Test Hotel');
          expect(res.body.enabledSlots).toContain(AdSlot.SCREENSAVER);
        });
    });

    it('should reject without token', () => {
      return request(app.getHttpServer())
        .post('/inventory/properties')
        .send({ name: 'Fail' })
        .expect(401);
    });
  });

  describe('/inventory/screens (POST)', () => {
    let propertyId: number;

    // Ambil propertyId dari langkah sebelumnya
    beforeAll(async () => {
      const prop = await prisma.property.findFirst({
        where: { smartivCode: `TEST-${uniqueId}` },
      });

      // FIX: Tambahkan pengecekan ini agar TypeScript tidak error
      if (!prop) {
        throw new Error('Property setup failed in previous step');
      }

      propertyId = prop.id;
    });

    it('should create screen successfully', () => {
      return request(app.getHttpServer())
        .post('/inventory/screens')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          propertyId: propertyId,
          code: `MAC-${uniqueId}`,
          name: 'Lobby TV E2E',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.code).toBe(`MAC-${uniqueId}`);
          expect(res.body.propertyId).toBe(propertyId);
        });
    });

    it('should fail if screen code duplicate', () => {
      return request(app.getHttpServer())
        .post('/inventory/screens')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          propertyId: propertyId,
          code: `MAC-${uniqueId}`, // Duplicate
          name: 'Lobby TV Duplicate',
        })
        .expect(409); // Conflict
    });
  });
});
