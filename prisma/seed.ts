import { PrismaClient, Role, AdSlot } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Idempotent Seeding...');

  // [BARU] Paksa salt prefix $2a$ agar pasti kompatibel dengan bcryptjs di container
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync('password123', salt);

  // 1. Upsert Super Admin
  await prisma.user.upsert({
    where: { email: 'admin@smartiv.com' },
    update: {
      // [BARU] Paksa update password & status setiap kali seed jalan
      // Ini memastikan jika ada sisa hash $2b$ akan tertimpa $2a$
      password: hashedPassword,
      isActive: true,
    },
    create: {
      email: 'admin@smartiv.com',
      password: hashedPassword,
      name: 'Super Admin',
      role: Role.SUPER_ADMIN,
      isActive: true,
      wallet: { create: { balance: 0 } },
    },
  });
  console.log('✅ Admin Check & Updated: admin@smartiv.com');

  // 2. Upsert Advertiser
  await prisma.user.upsert({
    where: { email: 'advertiser@test.com' },
    update: {
      password: hashedPassword,
      isActive: true,
    },
    create: {
      email: 'advertiser@test.com',
      password: hashedPassword,
      name: 'PT Maju Mundur',
      phone: '081234567890',
      role: Role.ADVERTISER,
      isActive: true,
      wallet: { create: { balance: 10000000 } },
    },
  });
  console.log('✅ Advertiser Check & Updated: advertiser@test.com');

  // 3. Upsert Property
  await prisma.property.upsert({
    where: { smartivCode: 'HMS-001' },
    update: {}, // Property tidak perlu paksa update
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
    console.error('❌ Seeding Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
