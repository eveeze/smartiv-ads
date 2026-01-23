import {
  PrismaClient,
  Role,
  AdSlot,
  PropertyType,
  PropertyClass,
  ScreenOrientation,
  ScreenStatus,
  DurationPackage,
  ApprovalStatus,
  CampaignStatus,
  MediaType,
  RoomCategory,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Robust Seeding...');

  // 1. Setup Password
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync('password123', salt);

  // ==========================================
  // A. USERS (Admin & Advertisers)
  // ==========================================
  const admin = await prisma.user.upsert({
    where: { email: 'admin@smartiv.com' },
    update: {},
    create: {
      email: 'admin@smartiv.com',
      password: hashedPassword,
      name: 'Super Admin',
      role: Role.SUPER_ADMIN,
      isActive: true,
      wallet: { create: { balance: 0 } },
    },
  });

  const advertiser1 = await prisma.user.upsert({
    where: { email: 'client@grandbrand.com' },
    update: {},
    create: {
      email: 'client@grandbrand.com',
      password: hashedPassword,
      name: 'Grand Brand Co.',
      phone: '081234567890',
      role: Role.ADVERTISER,
      isActive: true,
      wallet: { create: { balance: 500000000 } }, // 500 Juta
    },
  });

  const advertiser2 = await prisma.user.upsert({
    where: { email: 'client@umkm.com' },
    update: {},
    create: {
      email: 'client@umkm.com',
      password: hashedPassword,
      name: 'UMKM Maju Jaya',
      phone: '089876543210',
      role: Role.ADVERTISER,
      isActive: true,
      wallet: { create: { balance: 5000000 } }, // 5 Juta
    },
  });

  console.log('✅ Users Created');

  // ==========================================
  // B. PROPERTIES (Diverse Types & Locations)
  // ==========================================
  const propertiesData = [
    {
      name: 'Grand Indonesia Mall',
      type: PropertyType.MALL,
      classification: PropertyClass.LUXURY,
      city: 'Jakarta',
      address: 'Jl. MH Thamrin No. 1',
      timezone: 'Asia/Jakarta', // WIB
      region: 'Jabodetabek',
      smartivCode: 'GI-JKT',
      enabledSlots: [
        AdSlot.SCREENSAVER,
        AdSlot.INFO_SLIDER,
        AdSlot.APP_PROMOTION,
      ],
      screenCount: 15, // Buat 15 Layar
    },
    {
      name: 'Siloam Hospitals Bali',
      type: PropertyType.HOSPITAL,
      classification: PropertyClass.PREMIUM,
      city: 'Denpasar',
      address: 'Jl. Sunset Road No. 818',
      timezone: 'Asia/Makassar', // WITA (Penting untuk test Timezone)
      region: 'Bali & Nusa Tenggara',
      smartivCode: 'SH-BALI',
      enabledSlots: [AdSlot.SCREENSAVER, AdSlot.LEISURE_CULINARY],
      screenCount: 10,
    },
    {
      name: 'Hotel Savoy Homann',
      type: PropertyType.HOTEL,
      classification: PropertyClass.STANDARD,
      city: 'Bandung',
      address: 'Jl. Asia Afrika No. 112',
      timezone: 'Asia/Jakarta',
      region: 'Jawa Barat',
      smartivCode: 'HSH-BDG',
      enabledSlots: [AdSlot.SCREENSAVER],
      screenCount: 10,
    },
  ];

  for (const propData of propertiesData) {
    const { screenCount, ...data } = propData;

    // 1. Create Property
    const property = await prisma.property.upsert({
      where: { smartivCode: data.smartivCode },
      update: {},
      create: data,
    });

    // 2. Create Rate Card (Harga dinamis)
    const basePrice =
      propData.classification === PropertyClass.LUXURY ? 150000 : 75000;

    for (const slot of data.enabledSlots) {
      await prisma.rateCard.create({
        data: {
          propertyId: property.id,
          targetSlot: slot,
          pricePerDay: basePrice,
          pricePerWeek: basePrice * 7 * 0.9, // Diskon 10%
          pricePerMonth: basePrice * 30 * 0.8, // Diskon 20%
          isActive: true,
        },
      });
    }

    // 3. Create Bulk Screens
    const screens = Array.from({ length: screenCount }).map((_, i) => ({
      propertyId: property.id,
      name: `TV ${propData.type} ${i + 1}`,
      code: `${data.smartivCode}-SCR-${i + 1}`.toUpperCase(),
      resolution: '1920x1080',
      orientation:
        i % 5 === 0 ? ScreenOrientation.PORTRAIT : ScreenOrientation.LANDSCAPE, // Tiap 5 layar ada 1 portrait
      status: ScreenStatus.ONLINE,
      roomCategory: i < 5 ? RoomCategory.LOBBY : RoomCategory.STANDARD,
    }));

    // Skip duplicate creation check for screens to keep seed simple (delete many before create usually better, but upsert hard for bulk)
    // Here we just ignore if fails or assume clean DB usually
    const createdScreens = await prisma.screen.createMany({
      data: screens,
      skipDuplicates: true,
    });

    console.log(
      `✅ Property ${property.name}: ${createdScreens.count} screens created.`,
    );
  }

  // ==========================================
  // C. MEDIA & CAMPAIGNS (Real Logic Simulation)
  // ==========================================

  // 1. Upload Media Dummy
  const media1 = await prisma.media.create({
    data: {
      uploaderId: advertiser1.id,
      filename: 'dummy-video-1.mp4',
      originalName: 'Iklan Sepatu Lebaran.mp4',
      mimeType: 'video/mp4',
      size: 15000000,
      type: MediaType.VIDEO,
      title: 'Promo Lebaran 2026',
      url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', // HLS Sample
      thumbnailUrl:
        'https://via.placeholder.com/300x200.png?text=Thumbnail+Video',
      actionUrl: 'https://grandbrand.com/promo',
      status: ApprovalStatus.APPROVED,
      isTranscoded: true,
    },
  });

  const media2 = await prisma.media.create({
    data: {
      uploaderId: advertiser1.id, // Advertiser yang sama
      filename: 'dummy-image-1.jpg',
      originalName: 'Banner Diskon.jpg',
      mimeType: 'image/jpeg',
      size: 500000,
      type: MediaType.IMAGE,
      title: 'Banner Diskon 50%',
      url: 'https://via.placeholder.com/1920x1080.png?text=Iklan+Gambar+HD',
      status: ApprovalStatus.APPROVED,
    },
  });

  // 2. Create Active Campaign (Grand Indonesia - Screensaver)
  // Target: Semua screen di Grand Indo
  const grandIndo = await prisma.property.findFirst({
    where: { smartivCode: 'GI-JKT' },
  });

  if (grandIndo) {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    // Ambil screen untuk dikonekkan
    const giScreens = await prisma.screen.findMany({
      where: { propertyId: grandIndo.id },
    });

    await prisma.campaign.create({
      data: {
        advertiserId: advertiser1.id,
        propertyId: grandIndo.id,
        name: '[ACTIVE] Campaign Lebaran GI',
        status: CampaignStatus.ACTIVE,
        startDate: today,
        endDate: nextWeek,
        targetSlot: AdSlot.SCREENSAVER,
        durationPackage: DurationPackage.WEEKLY,
        totalCost: 10500000, // Dummy cost
        screens: {
          connect: giScreens.map((s) => ({ id: s.id })),
        },
        items: {
          create: [
            {
              mediaId: media1.id,
              durationSec: 30,
              targetSlot: AdSlot.SCREENSAVER,
              actionUrl: 'https://qr.promo.com/123',
            },
            {
              mediaId: media2.id,
              durationSec: 15,
              targetSlot: AdSlot.SCREENSAVER,
            },
          ],
        },
      },
    });
    console.log('✅ Active Campaign Created at Grand Indonesia');
  }

  // 3. Create Active Campaign (Siloam Bali - Timezone Test)
  const siloamBali = await prisma.property.findFirst({
    where: { smartivCode: 'SH-BALI' },
  });

  if (siloamBali) {
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setDate(today.getDate() + 30);
    const screens = await prisma.screen.findMany({
      where: { propertyId: siloamBali.id },
    });

    await prisma.campaign.create({
      data: {
        advertiserId: advertiser1.id,
        propertyId: siloamBali.id,
        name: '[ACTIVE] Health Info Bali',
        status: CampaignStatus.ACTIVE,
        startDate: today,
        endDate: nextMonth,
        targetSlot: AdSlot.SCREENSAVER, // Menggunakan screensaver juga
        durationPackage: DurationPackage.MONTHLY,
        totalCost: 25000000,
        screens: { connect: screens.map((s) => ({ id: s.id })) },
        items: {
          create: {
            mediaId: media2.id, // Pakai gambar
            durationSec: 10,
            targetSlot: AdSlot.SCREENSAVER,
          },
        },
      },
    });
    console.log(
      '✅ Active Campaign Created at Siloam Bali (Check Timezone logic!)',
    );
  }

  console.log('🚀 Seeding Finished Successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
