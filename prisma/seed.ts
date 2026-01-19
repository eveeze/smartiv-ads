import { PrismaClient, Role, AdSlot } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Seeding...');

  // 1. Clean All Data (Urutan Penting: Child -> Parent)
  await prisma.transaction.deleteMany();
  await prisma.impressionLog.deleteMany();
  await prisma.campaignItem.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.media.deleteMany();
  await prisma.rateCard.deleteMany();
  await prisma.screen.deleteMany();
  await prisma.property.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Database cleaned.');

  // 2. Create Super Admin (Credentials cocok dengan Postman)
  const adminPassword = await bcrypt.hash('password123', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@smartiv.com',
      password: adminPassword,
      name: 'Super Admin',
      role: Role.SUPER_ADMIN,
      wallet: { create: { balance: 0 } },
    },
  });
  console.log(`✅ Admin Created: ${admin.email}`);

  // 3. Create Advertiser (Credentials cocok dengan Postman)
  const advertiserPassword = await bcrypt.hash('password123', 10);
  const advertiser = await prisma.user.create({
    data: {
      email: 'advertiser@test.com',
      password: advertiserPassword,
      name: 'PT Maju Mundur',
      phone: '081234567890',
      role: Role.ADVERTISER,
      wallet: { create: { balance: 10000000 } }, // Saldo awal 10 Juta
    },
  });
  console.log(`✅ Advertiser Created: ${advertiser.email}`);

  // 4. (Optional) Create 1 Dummy Property
  const property = await prisma.property.create({
    data: {
      name: 'Hotel Mulia Senayan',
      type: 'HOTEL',
      classification: 'LUXURY',
      city: 'Jakarta',
      smartivCode: 'HMS-001',
      enabledSlots: [AdSlot.SCREENSAVER, AdSlot.INFO_SLIDER],
    },
  });
  console.log(`✅ Property Created: ${property.name}`);

  console.log('🚀 Seeding Finished!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
