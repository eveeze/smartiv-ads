import { PrismaClient, Role, AdSlot } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Idempotent Seeding...');

  // 1. Definisikan Password (Sebaiknya gunakan env variable di produksi)
  const defaultPassword = process.env.INITIAL_ADMIN_PASSWORD || 'password123';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  // 2. Upsert Super Admin
  // Menggunakan upsert agar jika email sudah ada, tidak akan error atau membuat duplikat
  const admin = await prisma.user.upsert({
    where: { email: 'admin@smartiv.com' },
    update: {}, // Tidak mengubah apa pun jika user sudah ada
    create: {
      email: 'admin@smartiv.com',
      password: hashedPassword,
      name: 'Super Admin',
      role: Role.SUPER_ADMIN,
      isActive: true,
      wallet: {
        create: { balance: 0 },
      },
    },
  });
  console.log(`✅ Admin Check: ${admin.email}`);

  // 3. Upsert Advertiser (Hanya untuk keperluan testing awal/staging)
  const advertiser = await prisma.user.upsert({
    where: { email: 'advertiser@test.com' },
    update: {},
    create: {
      email: 'advertiser@test.com',
      password: hashedPassword,
      name: 'PT Maju Mundur',
      phone: '081234567890',
      role: Role.ADVERTISER,
      isActive: true,
      wallet: {
        create: { balance: 10000000 }, // 10 Juta
      },
    },
  });
  console.log(`✅ Advertiser Check: ${advertiser.email}`);

  // 4. Upsert Dummy Property (Opsional)
  // Menggunakan smartivCode sebagai identifier unik sesuai skema prisma Anda
  const property = await prisma.property.upsert({
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
  console.log(`✅ Property Check: ${property.name}`);

  console.log('🚀 Seeding Finished Safely!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
