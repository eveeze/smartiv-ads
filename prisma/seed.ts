import {
  PrismaClient,
  Role,
  PropertyType,
  PropertyClass,
  AdZone,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seeding...');

  // 1. Create Super Admin
  const adminPassword = await bcrypt.hash('password123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@smartiv.id' },
    update: {},
    create: {
      email: 'admin@smartiv.id',
      name: 'Super Admin',
      password: adminPassword,
      role: Role.SUPER_ADMIN,
      wallet: {
        create: { balance: BigInt(0) }, // Saldo Unlimited (Logic di code nanti)
      },
    },
  });
  console.log('✅ Super Admin created:', admin.email);

  // 2. Create Advertiser Dummy
  const advertiserPassword = await bcrypt.hash('advertiser123', 10);
  const advertiser = await prisma.user.upsert({
    where: { email: 'client@brand.com' },
    update: {},
    create: {
      email: 'client@brand.com',
      name: 'Brand Client A',
      password: advertiserPassword,
      role: Role.ADVERTISER,
      wallet: {
        create: { balance: BigInt(5000000) }, // Saldo awal 5 Juta
      },
    },
  });
  console.log('✅ Advertiser created:', advertiser.email);

  // 3. Create Property (Hotel Bintang 5)
  const hotel = await prisma.property.create({
    data: {
      name: 'Grand SmartIV Hotel',
      type: PropertyType.HOTEL,
      classification: PropertyClass.LUXURY, // Bintang 5
      city: 'Jakarta',
      address: 'Jl. Sudirman Kav 1',
      rateCards: {
        create: [
          {
            pricePerDay: BigInt(100000), // 100rb per hari
            targetZone: AdZone.SCREENSAVER, // Khusus Screensaver
          },
          {
            pricePerDay: BigInt(250000), // 250rb per hari
            targetZone: AdZone.BACKGROUND, // Khusus Background
          },
        ],
      },
    },
  });
  console.log('✅ Property 1 Created:', hotel.name);

  // 4. Create Property (Rumah Sakit)
  const hospital = await prisma.property.create({
    data: {
      name: 'RS Sehat Sentosa',
      type: PropertyType.HOSPITAL,
      classification: PropertyClass.PREMIUM, // Kelas A/VIP
      city: 'Surabaya',
      address: 'Jl. Darmo No 10',
      rateCards: {
        create: {
          pricePerDay: BigInt(150000),
          // Rate Global (tanpa spesifik zone)
        },
      },
    },
  });
  console.log('✅ Property 2 Created:', hospital.name);

  // 5. Create Screens for Hotel
  await prisma.screen.createMany({
    data: [
      {
        propertyId: hotel.id,
        name: 'Lobby Utama TV',
        macAddress: 'AA:BB:CC:DD:EE:01',
        zone: AdZone.INFORMATION, // TV Informasi
      },
      {
        propertyId: hotel.id,
        name: 'Kamar 101 TV',
        macAddress: 'AA:BB:CC:DD:EE:02',
        zone: AdZone.SCREENSAVER, // TV Kamar
      },
    ],
  });
  console.log('✅ Screens created for Hotel');

  console.log('🏁 Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
