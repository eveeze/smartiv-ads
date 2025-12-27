import {
  PrismaClient,
  Role,
  PropertyType,
  PropertyClass,
  ScreenOrientation,
  AdSlot, // FIX: Menggunakan AdSlot bukan AdZone
  RoomCategory,
  ScreenStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Create Super Admin
  const hashedPassword = await bcrypt.hash('password123', 10);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@smartiv.com' },
    update: {},
    create: {
      email: 'admin@smartiv.com',
      password: hashedPassword,
      name: 'Super Admin',
      role: Role.SUPER_ADMIN,
      wallet: {
        create: {
          balance: 1000000000, // 1 Miliar
        },
      },
    },
  });
  console.log('✅ Super Admin created:', superAdmin.email);

  // 2. Create Advertiser
  const advertiser = await prisma.user.upsert({
    where: { email: 'ads@brand.com' },
    update: {},
    create: {
      email: 'ads@brand.com',
      password: hashedPassword,
      name: 'Brand Manager',
      role: Role.ADVERTISER,
      wallet: {
        create: {
          balance: 50000000, // 50 Juta
        },
      },
    },
  });
  console.log('✅ Advertiser created:', advertiser.email);

  // 3. Create Property (Hotel)
  // Kita gunakan ID SmartIV (212) sebagai unique constraint di logic seed ini
  const propertyCheck = await prisma.property.findUnique({
    where: { smartivId: 212 },
  });

  let property;
  if (!propertyCheck) {
    property = await prisma.property.create({
      data: {
        name: 'Hotel Tentrem Yogyakarta',
        type: PropertyType.HOTEL,
        classification: PropertyClass.LUXURY,
        smartivId: 212,
        smartivCode: '0Q1MHI',
        address: 'Jl. P. Mangkubumi No.72A',
        city: 'Yogyakarta',
        // FIX: Update Enum AdSlot
        enabledSlots: [
          AdSlot.SCREENSAVER,
          AdSlot.INFO_SLIDER,
          AdSlot.WELCOME_GREETING,
        ],
        // Rate Cards
        rateCards: {
          create: [
            {
              pricePerDay: 150000,
              targetSlot: AdSlot.SCREENSAVER, // FIX: targetSlot & AdSlot
              isActive: true,
            },
            {
              pricePerDay: 100000,
              targetSlot: AdSlot.INFO_SLIDER, // FIX: targetSlot & AdSlot
              isActive: true,
            },
          ],
        },
      },
    });
    console.log('✅ Property created:', property.name);
  } else {
    property = propertyCheck;
    console.log('ℹ️ Property already exists:', property.name);
  }

  // 4. Create Screens
  const screen1Code = 'AA:BB:CC:DD:EE:01';
  const screen1 = await prisma.screen.upsert({
    where: { code: screen1Code }, // FIX: Menggunakan code (pengganti macAddress)
    update: {},
    create: {
      propertyId: property.id,
      name: 'Lobby Utama TV',
      code: screen1Code, // FIX: code
      resolution: '1920x1080',
      orientation: ScreenOrientation.LANDSCAPE,
      status: ScreenStatus.ONLINE,
      ipAddress: '192.168.1.101',
      roomCategory: RoomCategory.LOBBY,
    },
  });

  const screen2Code = 'AA:BB:CC:DD:EE:02';
  const screen2 = await prisma.screen.upsert({
    where: { code: screen2Code }, // FIX: Menggunakan code
    update: {},
    create: {
      propertyId: property.id,
      name: 'Restoran TV',
      code: screen2Code, // FIX: code
      resolution: '1920x1080',
      orientation: ScreenOrientation.LANDSCAPE,
      status: ScreenStatus.ONLINE,
      ipAddress: '192.168.1.102',
      roomCategory: RoomCategory.RESTAURANT,
    },
  });

  console.log('✅ Screens created');
  console.log('🚀 Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
