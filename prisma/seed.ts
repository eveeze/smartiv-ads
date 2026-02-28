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
  // A. USERS (Admin, Advertisers, Operator)
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
      wallet: { create: { balance: 500000000 } },
    },
  });

  await prisma.user.upsert({
    where: { email: 'client@umkm.com' },
    update: {},
    create: {
      email: 'client@umkm.com',
      password: hashedPassword,
      name: 'UMKM Maju Jaya',
      phone: '089876543210',
      role: Role.ADVERTISER,
      isActive: true,
      wallet: { create: { balance: 5000000 } },
    },
  });

  console.log('✅ Users Created');

  // ==========================================
  // B. AD PLACEMENTS (Phase 11 Seed)
  // ==========================================
  const placementsData = [
    {
      code: 'FULLSCREEN_1080P',
      name: 'Fullscreen 1080p',
      width: 1920,
      height: 1080,
      aspectRatio: '16:9',
      allowedMediaTypes: [MediaType.IMAGE, MediaType.VIDEO],
    },
    {
      code: 'FULLSCREEN_720P',
      name: 'Fullscreen 720p',
      width: 1280,
      height: 720,
      aspectRatio: '16:9',
      allowedMediaTypes: [MediaType.IMAGE, MediaType.VIDEO],
    },
    {
      code: 'BANNER_FOOTER',
      name: 'Banner Footer',
      width: 1920,
      height: 480,
      aspectRatio: '4:1',
      allowedMediaTypes: [MediaType.IMAGE],
    },
    {
      code: 'SIDEBAR_MENU',
      name: 'Sidebar Menu',
      width: 480,
      height: 1080,
      aspectRatio: '4:9',
      allowedMediaTypes: [MediaType.IMAGE],
    },
    {
      code: 'PORTRAIT_FULL',
      name: 'Portrait Fullscreen',
      width: 1080,
      height: 1920,
      aspectRatio: '9:16',
      allowedMediaTypes: [MediaType.IMAGE, MediaType.VIDEO],
    },
  ];

  for (const placement of placementsData) {
    await prisma.adPlacement.upsert({
      where: { code: placement.code },
      update: {},
      create: placement,
    });
  }
  console.log('✅ Ad Placements Seeded');

  // ==========================================
  // C. INDUSTRY CATEGORIES (Phase 12 Seed)
  // ==========================================
  const categoriesData = [
    { code: 'TRAVEL', name: 'Travel & Tourism' },
    { code: 'FNB', name: 'Food & Beverage' },
    { code: 'AUTOMOTIVE', name: 'Automotive' },
    { code: 'ALCOHOL', name: 'Alcohol & Tobacco' },
    { code: 'HEALTHCARE', name: 'Healthcare & Pharma' },
    { code: 'FINANCE', name: 'Finance & Banking' },
    { code: 'TECHNOLOGY', name: 'Technology' },
    { code: 'RETAIL', name: 'Retail & E-Commerce' },
    { code: 'ENTERTAINMENT', name: 'Entertainment' },
    { code: 'GAMBLING', name: 'Gambling & Betting' },
  ];

  for (const cat of categoriesData) {
    await prisma.industryCategory.upsert({
      where: { code: cat.code },
      update: {},
      create: cat,
    });
  }
  console.log('✅ Industry Categories Seeded');

  // ==========================================
  // D. PROPERTIES (Diverse Types & Locations)
  // ==========================================
  const propertiesData = [
    {
      name: 'Grand Indonesia Mall',
      type: PropertyType.MALL,
      classification: PropertyClass.LUXURY,
      city: 'Jakarta',
      address: 'Jl. MH Thamrin No. 1',
      timezone: 'Asia/Jakarta',
      region: 'Jabodetabek',
      smartivCode: 'GI-JKT',
      revenueSharePercentage: 0.3,
      enabledSlots: [
        AdSlot.SCREENSAVER,
        AdSlot.INFO_SLIDER,
        AdSlot.APP_PROMOTION,
      ],
      screenCount: 15,
    },
    {
      name: 'Siloam Hospitals Bali',
      type: PropertyType.HOSPITAL,
      classification: PropertyClass.PREMIUM,
      city: 'Denpasar',
      address: 'Jl. Sunset Road No. 818',
      timezone: 'Asia/Makassar',
      region: 'Bali & Nusa Tenggara',
      smartivCode: 'SH-BALI',
      revenueSharePercentage: 0.25,
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
      revenueSharePercentage: 0.2,
      enabledSlots: [AdSlot.SCREENSAVER],
      screenCount: 10,
    },
  ];

  for (const propData of propertiesData) {
    const { screenCount, ...data } = propData;

    const property = await prisma.property.upsert({
      where: { smartivCode: data.smartivCode },
      update: {},
      create: data,
    });

    // Rate Cards
    const basePrice =
      propData.classification === PropertyClass.LUXURY ? 150000 : 75000;

    for (const slot of data.enabledSlots) {
      await prisma.rateCard.create({
        data: {
          propertyId: property.id,
          targetSlot: slot,
          pricePerDay: basePrice,
          pricePerWeek: basePrice * 7 * 0.9,
          pricePerMonth: basePrice * 30 * 0.8,
          isActive: true,
        },
      });
    }

    // Bulk Screens
    const screens = Array.from({ length: screenCount }).map((_, i) => ({
      propertyId: property.id,
      name: `TV ${propData.type} ${i + 1}`,
      code: `${data.smartivCode}-SCR-${i + 1}`.toUpperCase(),
      resolution: '1920x1080',
      orientation:
        i % 5 === 0 ? ScreenOrientation.PORTRAIT : ScreenOrientation.LANDSCAPE,
      status: ScreenStatus.ONLINE,
      roomCategory: i < 5 ? RoomCategory.LOBBY : RoomCategory.STANDARD,
    }));

    const createdScreens = await prisma.screen.createMany({
      data: screens,
      skipDuplicates: true,
    });

    console.log(
      `✅ Property ${property.name}: ${createdScreens.count} screens created.`,
    );
  }

  // Create Operator user linked to Grand Indonesia
  const grandIndo = await prisma.property.findFirst({
    where: { smartivCode: 'GI-JKT' },
  });

  if (grandIndo) {
    await prisma.user.upsert({
      where: { email: 'operator@grandindonesia.com' },
      update: {},
      create: {
        email: 'operator@grandindonesia.com',
        password: hashedPassword,
        name: 'Grand Indonesia Operator',
        role: Role.PROPERTY_OPERATOR,
        isActive: true,
        propertyId: grandIndo.id,
      },
    });
    console.log('✅ Operator User Created (Grand Indonesia)');
  }

  // ==========================================
  // E. MEDIA & CAMPAIGNS
  // ==========================================
  const media1 = await prisma.media.create({
    data: {
      uploaderId: advertiser1.id,
      filename: 'dummy-video-1.mp4',
      originalName: 'Iklan Sepatu Lebaran.mp4',
      mimeType: 'video/mp4',
      size: 15000000,
      type: MediaType.VIDEO,
      title: 'Promo Lebaran 2026',
      url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      thumbnailUrl:
        'https://via.placeholder.com/300x200.png?text=Thumbnail+Video',
      actionUrl: 'https://grandbrand.com/promo',
      status: ApprovalStatus.APPROVED,
      isTranscoded: true,
    },
  });

  const media2 = await prisma.media.create({
    data: {
      uploaderId: advertiser1.id,
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

  // Campaign at Grand Indonesia
  if (grandIndo) {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    const giScreens = await prisma.screen.findMany({
      where: { propertyId: grandIndo.id },
    });

    // Get FNB category for brand safety demo
    const fnbCategory = await prisma.industryCategory.findUnique({
      where: { code: 'FNB' },
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
        totalCost: 10500000,
        categoryId: fnbCategory?.id,
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

  // Campaign at Siloam Bali
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
        targetSlot: AdSlot.SCREENSAVER,
        durationPackage: DurationPackage.MONTHLY,
        totalCost: 25000000,
        screens: { connect: screens.map((s) => ({ id: s.id })) },
        items: {
          create: {
            mediaId: media2.id,
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
