import { PrismaClient, Role, AdSlot } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Idempotent Seeding...');

  // Menggunakan hashSync untuk stabilitas di container
  const hashedPassword = bcrypt.hashSync('password123', 10);

  // 1. Upsert Super Admin
  await prisma.user.upsert({
    where: { email: 'admin@smartiv.com' },
    update: {},
    create: {
      email: 'admin@smartiv.com',
      password: hashedPassword,
      name: 'Super Admin',
      role: Role.SUPER_ADMIN,
      isActive: true, // WAJIB TRUE agar bisa login
      wallet: { create: { balance: 0 } },
    },
  });
  console.log('✅ Admin Check: admin@smartiv.com');

  // 2. Upsert Advertiser
  await prisma.user.upsert({
    where: { email: 'advertiser@test.com' },
    update: {},
    create: {
      email: 'advertiser@test.com',
      password: hashedPassword,
      name: 'PT Maju Mundur',
      phone: '081234567890',
      role: Role.ADVERTISER,
      isActive: true, // WAJIB TRUE
      wallet: { create: { balance: 10000000 } },
    },
  });
  console.log('✅ Advertiser Check: advertiser@test.com');

  // 3. Upsert Property
  await prisma.property.upsert({
    where: { smartivCode: 'HMS-001' },
    update: {},
    create: {
      name: 'Hotel Mulia Senayan',
      type: 'HOTEL',
      classification: 'LUXURY',
      city: 'Jakarta',
      smartivCode: 'HMS-001',
      enabledSlots: [AdSlot.SCREENSAVER, AdSlot.INFO_SLIDER],
    },
  });

  console.log('🚀 Seeding Finished Safely!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
