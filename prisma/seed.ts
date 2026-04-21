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
  TransactionType,
  TransactionStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ============================================================
// WORKING MEDIA URLs (tested 2026)
// ============================================================
//
// ✅ VIDEO HLS (.m3u8) — Apple official test stream, always up:
const HLS_VIDEO_URL =
  'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8';

// ✅ VIDEO MP4 direct — Google CDN, no CORS issue, no HLS needed:
const MP4_VIDEO_BBB =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
const MP4_VIDEO_ELEPHANTS =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';
const MP4_VIDEO_SUNFLOWER =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4';

// ✅ IMAGE — placehold.co (via.placeholder.com is dead as of 2024):
const IMG_HD_LANDSCAPE =
  'https://placehold.co/1920x1080/1a1a2e/FFD700/png?text=SmartIV+Ads+HD';
const IMG_WIDE_BANNER =
  'https://placehold.co/1920x480/0f3460/e94560/png?text=Banner+Promosi';
const IMG_HEALTH_INFO =
  'https://placehold.co/1920x1080/16213e/00d4ff/png?text=Health+Info+Siloam';
const IMG_HOTEL_PROMO =
  'https://placehold.co/1920x1080/2d1b69/ff6b6b/png?text=Hotel+Savoy+Promo';
const IMG_WELCOME =
  'https://placehold.co/1920x1080/1a1a2e/4ade80/png?text=Selamat+Datang';

// ✅ Thumbnail via picsum — reliable image service:
const THUMB_VIDEO =
  'https://picsum.photos/seed/smartiv-video/320/180';
const THUMB_IMAGE =
  'https://picsum.photos/seed/smartiv-image/320/180';

async function main() {
  console.log('🌱 Starting SmartIV E2E Seed (Full Coverage)...');
  console.log(
    '📋 Covers: Auth, Inventory, Player, Telemetry, Analytics, Dashboard',
  );

  // ==========================================
  // 0. CLEANUP — drop existing playground data
  //    (media uses createMany so we need to clean)
  // ==========================================
  console.log('\n🧹 Cleaning up old seed data...');
  await prisma.impressionLog.deleteMany({});
  await prisma.publisherLedger.deleteMany({});
  await prisma.campaignItem.deleteMany({});
  await prisma.campaign.deleteMany({});
  await prisma.media.deleteMany({});
  await prisma.rateCard.deleteMany({});
  await prisma.screen.deleteMany({});
  await prisma.property.deleteMany({});
  await prisma.wallet.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.adPlacement.deleteMany({});
  await prisma.industryCategory.deleteMany({});
  console.log('✅ Cleanup done.\n');

  // ==========================================
  // A. USERS (Admin, Advertisers, Operators)
  // ==========================================
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync('password123', salt);

  console.log('👤 Creating users...');

  const admin = await prisma.user.create({
    data: {
      email: 'admin@smartiv.com',
      password: hashedPassword,
      name: 'Super Admin',
      role: Role.SUPER_ADMIN,
      isActive: true,
      wallet: { create: { balance: 0 } },
    },
  });

  const advertiser1 = await prisma.user.create({
    data: {
      email: 'client@grandbrand.com',
      password: hashedPassword,
      name: 'Grand Brand Co.',
      phone: '081234567890',
      role: Role.ADVERTISER,
      isActive: true,
      wallet: { create: { balance: 500_000_000 } },
    },
  });

  const advertiser2 = await prisma.user.create({
    data: {
      email: 'client@umkm.com',
      password: hashedPassword,
      name: 'UMKM Maju Jaya',
      phone: '089876543210',
      role: Role.ADVERTISER,
      isActive: true,
      wallet: { create: { balance: 5_000_000 } },
    },
  });

  console.log('✅ Users: admin, 2 advertisers created');

  // ==========================================
  // B. AD PLACEMENTS
  // ==========================================
  console.log('📐 Creating ad placements...');
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
    await prisma.adPlacement.create({ data: placement });
  }
  console.log('✅ Ad Placements created');

  // ==========================================
  // C. INDUSTRY CATEGORIES
  // ==========================================
  console.log('🏷️  Creating industry categories...');
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

  const categories: Record<string, { id: number }> = {};
  for (const cat of categoriesData) {
    const c = await prisma.industryCategory.create({ data: cat });
    categories[cat.code] = c;
  }
  console.log('✅ Industry Categories created');

  // ==========================================
  // D. PROPERTIES + SCREENS + RATE CARDS
  // ==========================================
  console.log('🏢 Creating properties and screens...');

  // ----- Property 1: Grand Indonesia Mall (Jakarta) -----
  const grandIndo = await prisma.property.create({
    data: {
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
        AdSlot.LEISURE_CULINARY,
      ],
    },
  });

  // Rate Cards for GI
  for (const slot of [
    AdSlot.SCREENSAVER,
    AdSlot.INFO_SLIDER,
    AdSlot.APP_PROMOTION,
    AdSlot.LEISURE_CULINARY,
  ]) {
    await prisma.rateCard.create({
      data: {
        propertyId: grandIndo.id,
        targetSlot: slot,
        pricePerDay: 150_000,
        pricePerWeek: 945_000,
        pricePerMonth: 3_600_000,
        isActive: true,
      },
    });
  }

  // Screens for GI (15 screens)
  const giScreens = await prisma.screen.createMany({
    data: Array.from({ length: 15 }).map((_, i) => ({
      propertyId: grandIndo.id,
      name: `TV Mall GI ${i + 1}`,
      code: `GI-JKT-SCR-${i + 1}`,
      resolution: '1920x1080',
      orientation:
        i % 5 === 0 ? ScreenOrientation.PORTRAIT : ScreenOrientation.LANDSCAPE,
      status: ScreenStatus.ONLINE,
      roomCategory: i < 5 ? RoomCategory.LOBBY : RoomCategory.STANDARD,
    })),
    skipDuplicates: true,
  });
  console.log(`  ✅ ${giScreens.count} screens @ Grand Indonesia`);

  // Operator for GI
  await prisma.user.create({
    data: {
      email: 'operator@grandindonesia.com',
      password: hashedPassword,
      name: 'Grand Indonesia Operator',
      role: Role.PROPERTY_OPERATOR,
      isActive: true,
      propertyId: grandIndo.id,
    },
  });

  // ----- Property 2: Siloam Hospitals Bali -----
  const siloamBali = await prisma.property.create({
    data: {
      name: 'Siloam Hospitals Bali',
      type: PropertyType.HOSPITAL,
      classification: PropertyClass.PREMIUM,
      city: 'Denpasar',
      address: 'Jl. Sunset Road No. 818',
      timezone: 'Asia/Makassar',
      region: 'Bali & Nusa Tenggara',
      smartivCode: 'SH-BALI',
      revenueSharePercentage: 0.25,
      enabledSlots: [
        AdSlot.SCREENSAVER,
        AdSlot.INFO_SLIDER,
        AdSlot.LEISURE_CULINARY,
      ],
    },
  });

  for (const slot of [
    AdSlot.SCREENSAVER,
    AdSlot.INFO_SLIDER,
    AdSlot.LEISURE_CULINARY,
  ]) {
    await prisma.rateCard.create({
      data: {
        propertyId: siloamBali.id,
        targetSlot: slot,
        pricePerDay: 100_000,
        pricePerWeek: 630_000,
        pricePerMonth: 2_400_000,
        isActive: true,
      },
    });
  }

  const shScreens = await prisma.screen.createMany({
    data: Array.from({ length: 10 }).map((_, i) => ({
      propertyId: siloamBali.id,
      name: `TV Hospital Bali ${i + 1}`,
      code: `SH-BALI-SCR-${i + 1}`,
      resolution: '1920x1080',
      orientation: ScreenOrientation.LANDSCAPE,
      status: ScreenStatus.ONLINE,
      roomCategory:
        i < 3 ? RoomCategory.LOBBY : i < 6 ? RoomCategory.WAITING_ROOM : RoomCategory.POLYCLINIC,
    })),
    skipDuplicates: true,
  });
  console.log(`  ✅ ${shScreens.count} screens @ Siloam Bali`);

  await prisma.user.create({
    data: {
      email: 'operator@siloambali.com',
      password: hashedPassword,
      name: 'Siloam Bali Operator',
      role: Role.PROPERTY_OPERATOR,
      isActive: true,
      propertyId: siloamBali.id,
    },
  });

  // ----- Property 3: Hotel Savoy Homann -----
  const hotelSavoy = await prisma.property.create({
    data: {
      name: 'Hotel Savoy Homann',
      type: PropertyType.HOTEL,
      classification: PropertyClass.STANDARD,
      city: 'Bandung',
      address: 'Jl. Asia Afrika No. 112',
      timezone: 'Asia/Jakarta',
      region: 'Jawa Barat',
      smartivCode: 'HSH-BDG',
      revenueSharePercentage: 0.2,
      enabledSlots: [
        AdSlot.SCREENSAVER,
        AdSlot.WELCOME_GREETING,
        AdSlot.LEISURE_TOURISM,
      ],
    },
  });

  for (const slot of [
    AdSlot.SCREENSAVER,
    AdSlot.WELCOME_GREETING,
    AdSlot.LEISURE_TOURISM,
  ]) {
    await prisma.rateCard.create({
      data: {
        propertyId: hotelSavoy.id,
        targetSlot: slot,
        pricePerDay: 75_000,
        pricePerWeek: 472_500,
        pricePerMonth: 1_800_000,
        isActive: true,
      },
    });
  }

  const hshScreens = await prisma.screen.createMany({
    data: Array.from({ length: 10 }).map((_, i) => ({
      propertyId: hotelSavoy.id,
      name: `TV Hotel Savoy ${i + 1}`,
      code: `HSH-BDG-SCR-${i + 1}`,
      resolution: '1920x1080',
      orientation:
        i < 2 ? ScreenOrientation.PORTRAIT : ScreenOrientation.LANDSCAPE,
      status: i < 8 ? ScreenStatus.ONLINE : ScreenStatus.OFFLINE,
      roomCategory:
        i === 0
          ? RoomCategory.LOBBY
          : i < 5
            ? RoomCategory.STANDARD
            : RoomCategory.DELUXE,
    })),
    skipDuplicates: true,
  });
  console.log(`  ✅ ${hshScreens.count} screens @ Hotel Savoy (2 OFFLINE for dashboard test)`);

  await prisma.user.create({
    data: {
      email: 'operator@savoyhomann.com',
      password: hashedPassword,
      name: 'Savoy Homann Operator',
      role: Role.PROPERTY_OPERATOR,
      isActive: true,
      propertyId: hotelSavoy.id,
    },
  });

  // ==========================================
  // E. MEDIA ASSETS (Working URLs!)
  // ==========================================
  console.log('\n🎬 Creating media assets with working URLs...');

  // --- Video Assets ---
  const mediaVideoHLS = await prisma.media.create({
    data: {
      uploaderId: advertiser1.id,
      filename: 'promo-lebaran-hls.m3u8',
      originalName: 'Promo Lebaran 2026 (HLS).m3u8',
      mimeType: 'application/x-mpegURL',
      size: 0, // Stream, no fixed size
      type: MediaType.VIDEO,
      title: 'Promo Lebaran 2026 — HLS Stream',
      url: HLS_VIDEO_URL, // ✅ Apple official HLS test stream
      thumbnailUrl: THUMB_VIDEO,
      hlsUrl: HLS_VIDEO_URL,
      actionUrl: 'https://grandbrand.com/promo-lebaran',
      status: ApprovalStatus.APPROVED,
      isTranscoded: true,
    },
  });

  const mediaVideoMP4 = await prisma.media.create({
    data: {
      uploaderId: advertiser1.id,
      filename: 'big-buck-bunny.mp4',
      originalName: 'Big Buck Bunny (MP4).mp4',
      mimeType: 'video/mp4',
      size: 158_008_374,
      type: MediaType.VIDEO,
      title: 'Promo Grand Brand — Video MP4',
      url: MP4_VIDEO_BBB, // ✅ Google CDN, always up
      thumbnailUrl: THUMB_VIDEO,
      actionUrl: 'https://grandbrand.com/campaign',
      status: ApprovalStatus.APPROVED,
      isTranscoded: true,
    },
  });

  const mediaVideoElephants = await prisma.media.create({
    data: {
      uploaderId: advertiser1.id,
      filename: 'elephants-dream.mp4',
      originalName: 'Elephants Dream (MP4).mp4',
      mimeType: 'video/mp4',
      size: 68_000_000,
      type: MediaType.VIDEO,
      title: 'Iklan Info Slot — MP4',
      url: MP4_VIDEO_ELEPHANTS, // ✅ Google CDN
      thumbnailUrl: THUMB_VIDEO,
      status: ApprovalStatus.APPROVED,
      isTranscoded: true,
    },
  });

  const mediaVideoHotel = await prisma.media.create({
    data: {
      uploaderId: advertiser2.id,
      filename: 'hotel-promo.mp4',
      originalName: 'Hotel Welcome Video (MP4).mp4',
      mimeType: 'video/mp4',
      size: 45_000_000,
      type: MediaType.VIDEO,
      title: 'Video Sambutan Hotel Savoy',
      url: MP4_VIDEO_SUNFLOWER, // ✅ Google CDN
      thumbnailUrl: THUMB_VIDEO,
      actionUrl: 'https://savoyhomann.com',
      status: ApprovalStatus.APPROVED,
      isTranscoded: true,
    },
  });

  // --- Image Assets ---
  const mediaImageBanner = await prisma.media.create({
    data: {
      uploaderId: advertiser1.id,
      filename: 'banner-diskon-hd.jpg',
      originalName: 'Banner Diskon 50%.jpg',
      mimeType: 'image/jpeg',
      size: 500_000,
      type: MediaType.IMAGE,
      title: 'Banner Diskon 50%',
      url: IMG_HD_LANDSCAPE, // ✅ placehold.co (via.placeholder.com is dead)
      thumbnailUrl: THUMB_IMAGE,
      status: ApprovalStatus.APPROVED,
    },
  });

  const mediaImageHealth = await prisma.media.create({
    data: {
      uploaderId: advertiser1.id,
      filename: 'health-info-siloam.jpg',
      originalName: 'Health Info Siloam.jpg',
      mimeType: 'image/jpeg',
      size: 480_000,
      type: MediaType.IMAGE,
      title: 'Health Info Siloam Bali',
      url: IMG_HEALTH_INFO, // ✅ placehold.co
      thumbnailUrl: THUMB_IMAGE,
      status: ApprovalStatus.APPROVED,
    },
  });

  const mediaImageHotel = await prisma.media.create({
    data: {
      uploaderId: advertiser2.id,
      filename: 'hotel-savoy-promo.jpg',
      originalName: 'Hotel Savoy Promo.jpg',
      mimeType: 'image/jpeg',
      size: 350_000,
      type: MediaType.IMAGE,
      title: 'Hotel Savoy Promo Image',
      url: IMG_HOTEL_PROMO, // ✅ placehold.co
      thumbnailUrl: THUMB_IMAGE,
      actionUrl: 'https://savoyhomann.com/promo',
      status: ApprovalStatus.APPROVED,
    },
  });

  const mediaImageWelcome = await prisma.media.create({
    data: {
      uploaderId: advertiser1.id,
      filename: 'welcome-banner.jpg',
      originalName: 'Welcome Banner.jpg',
      mimeType: 'image/jpeg',
      size: 310_000,
      type: MediaType.IMAGE,
      title: 'Selamat Datang Banner',
      url: IMG_WELCOME, // ✅ placehold.co
      thumbnailUrl: THUMB_IMAGE,
      status: ApprovalStatus.APPROVED,
    },
  });

  const mediaImageBannerWide = await prisma.media.create({
    data: {
      uploaderId: advertiser2.id,
      filename: 'banner-footer-wide.jpg',
      originalName: 'Banner Footer Wide.jpg',
      mimeType: 'image/jpeg',
      size: 250_000,
      type: MediaType.IMAGE,
      title: 'Banner Footer Promo',
      url: IMG_WIDE_BANNER, // ✅ placehold.co
      thumbnailUrl: THUMB_IMAGE,
      status: ApprovalStatus.APPROVED,
    },
  });

  console.log('✅ 9 media assets created (4 video + 5 image, all working URLs)');

  // ==========================================
  // F. CAMPAIGNS (Multi-slot, Multi-property)
  // ==========================================
  console.log('\n📢 Creating campaigns...');

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  const nextMonth = new Date(today);
  nextMonth.setDate(today.getDate() + 30);

  // Load screens for each property
  const allGiScreens = await prisma.screen.findMany({
    where: { propertyId: grandIndo.id },
  });
  const allShScreens = await prisma.screen.findMany({
    where: { propertyId: siloamBali.id },
  });
  const allHshScreens = await prisma.screen.findMany({
    where: { propertyId: hotelSavoy.id, status: ScreenStatus.ONLINE },
  });

  // ── Campaign 1: Grand Indonesia — SCREENSAVER (HLS + Image)
  //    Tests: HLS video playback + image fallback
  const campaign1 = await prisma.campaign.create({
    data: {
      advertiserId: advertiser1.id,
      propertyId: grandIndo.id,
      name: '[ACTIVE] Campaign Lebaran GI',
      status: CampaignStatus.ACTIVE,
      startDate: yesterday,
      endDate: nextWeek,
      targetSlot: AdSlot.SCREENSAVER,
      durationPackage: DurationPackage.WEEKLY,
      totalCost: 10_500_000,
      categoryId: categories['FNB'].id,
      screens: { connect: allGiScreens.map((s) => ({ id: s.id })) },
      items: {
        create: [
          {
            mediaId: mediaVideoHLS.id,
            durationSec: 30,
            targetSlot: AdSlot.SCREENSAVER,
            actionUrl: 'https://qr.promo.com/lebaran',
          },
          {
            mediaId: mediaImageBanner.id,
            durationSec: 15,
            targetSlot: AdSlot.SCREENSAVER,
          },
        ],
      },
    },
  });
  console.log(`  ✅ ${campaign1.name} (GI screensaver, HLS+Image)`);

  // ── Campaign 2: Grand Indonesia — INFO_SLIDER (MP4 Video)
  //    Tests: MP4 video playback for INFO_SLIDER slot
  const campaign2 = await prisma.campaign.create({
    data: {
      advertiserId: advertiser1.id,
      propertyId: grandIndo.id,
      name: '[ACTIVE] Info Slider GI',
      status: CampaignStatus.ACTIVE,
      startDate: yesterday,
      endDate: nextMonth,
      targetSlot: AdSlot.INFO_SLIDER,
      durationPackage: DurationPackage.MONTHLY,
      totalCost: 5_000_000,
      categoryId: categories['ENTERTAINMENT'].id,
      screens: {
        connect: allGiScreens.slice(0, 5).map((s) => ({ id: s.id })),
      },
      items: {
        create: [
          {
            mediaId: mediaVideoMP4.id,
            durationSec: 20,
            targetSlot: AdSlot.INFO_SLIDER,
          },
          {
            mediaId: mediaImageBannerWide.id,
            durationSec: 10,
            targetSlot: AdSlot.INFO_SLIDER,
          },
        ],
      },
    },
  });
  console.log(`  ✅ ${campaign2.name} (GI info_slider, MP4)`);

  // ── Campaign 3: Siloam Bali — SCREENSAVER (Image only)
  //    Tests: Image-only campaign, PREMIUM hospital property
  const campaign3 = await prisma.campaign.create({
    data: {
      advertiserId: advertiser1.id,
      propertyId: siloamBali.id,
      name: '[ACTIVE] Health Info Bali',
      status: CampaignStatus.ACTIVE,
      startDate: yesterday,
      endDate: nextMonth,
      targetSlot: AdSlot.SCREENSAVER,
      durationPackage: DurationPackage.MONTHLY,
      totalCost: 25_000_000,
      categoryId: categories['HEALTHCARE'].id,
      screens: { connect: allShScreens.map((s) => ({ id: s.id })) },
      items: {
        create: [
          {
            mediaId: mediaImageHealth.id,
            durationSec: 10,
            targetSlot: AdSlot.SCREENSAVER,
          },
        ],
      },
    },
  });
  console.log(`  ✅ ${campaign3.name} (Siloam, image-only)`);

  // ── Campaign 4: Siloam Bali — INFO_SLIDER (MP4 video)
  //    Tests: Multi-slot on same property
  const campaign4 = await prisma.campaign.create({
    data: {
      advertiserId: advertiser1.id,
      propertyId: siloamBali.id,
      name: '[ACTIVE] Hospital Info Slider',
      status: CampaignStatus.ACTIVE,
      startDate: yesterday,
      endDate: nextMonth,
      targetSlot: AdSlot.INFO_SLIDER,
      durationPackage: DurationPackage.MONTHLY,
      totalCost: 8_000_000,
      categoryId: categories['HEALTHCARE'].id,
      screens: {
        connect: allShScreens.slice(0, 5).map((s) => ({ id: s.id })),
      },
      items: {
        create: [
          {
            mediaId: mediaVideoElephants.id,
            durationSec: 25,
            targetSlot: AdSlot.INFO_SLIDER,
          },
        ],
      },
    },
  });
  console.log(`  ✅ ${campaign4.name} (Siloam, info_slider, MP4)`);

  // ── Campaign 5: Hotel Savoy — SCREENSAVER (MP4)
  //    Tests: STANDARD hotel, OFFLINE screens mixed
  const campaign5 = await prisma.campaign.create({
    data: {
      advertiserId: advertiser2.id,
      propertyId: hotelSavoy.id,
      name: '[ACTIVE] Savoy Hotel Promo',
      status: CampaignStatus.ACTIVE,
      startDate: yesterday,
      endDate: nextWeek,
      targetSlot: AdSlot.SCREENSAVER,
      durationPackage: DurationPackage.WEEKLY,
      totalCost: 3_150_000,
      categoryId: categories['TRAVEL'].id,
      screens: { connect: allHshScreens.map((s) => ({ id: s.id })) },
      items: {
        create: [
          {
            mediaId: mediaVideoHotel.id,
            durationSec: 20,
            targetSlot: AdSlot.SCREENSAVER,
            actionUrl: 'https://savoyhomann.com',
          },
          {
            mediaId: mediaImageHotel.id,
            durationSec: 10,
            targetSlot: AdSlot.SCREENSAVER,
          },
        ],
      },
    },
  });
  console.log(`  ✅ ${campaign5.name} (Hotel Savoy, MP4+Image)`);

  // ── Campaign 6: Hotel Savoy — WELCOME_GREETING (Image only)
  //    Tests: WELCOME_GREETING slot
  const campaign6 = await prisma.campaign.create({
    data: {
      advertiserId: advertiser2.id,
      propertyId: hotelSavoy.id,
      name: '[ACTIVE] Welcome Greeting Savoy',
      status: CampaignStatus.ACTIVE,
      startDate: yesterday,
      endDate: nextMonth,
      targetSlot: AdSlot.WELCOME_GREETING,
      durationPackage: DurationPackage.MONTHLY,
      totalCost: 2_250_000,
      screens: { connect: allHshScreens.slice(0, 3).map((s) => ({ id: s.id })) },
      items: {
        create: [
          {
            mediaId: mediaImageWelcome.id,
            durationSec: 5,
            targetSlot: AdSlot.WELCOME_GREETING,
          },
        ],
      },
    },
  });
  console.log(`  ✅ ${campaign6.name} (Hotel Savoy, welcome_greeting)`);

  // ── Campaign 7: PENDING — GI (test non-active campaign filter)
  const campaign7 = await prisma.campaign.create({
    data: {
      advertiserId: advertiser2.id,
      propertyId: grandIndo.id,
      name: '[PENDING] UMKM Flash Sale GI',
      status: CampaignStatus.PENDING_REVIEW,
      startDate: nextWeek,
      endDate: nextMonth,
      targetSlot: AdSlot.APP_PROMOTION,
      durationPackage: DurationPackage.MONTHLY,
      totalCost: 1_800_000,
      items: {
        create: [
          {
            mediaId: mediaImageBannerWide.id,
            durationSec: 8,
            targetSlot: AdSlot.APP_PROMOTION,
          },
        ],
      },
    },
  });
  console.log(`  ✅ ${campaign7.name} (PENDING, not in playlist)`);

  // ── Campaign 8: COMPLETED — for analytics history
  const campaign8 = await prisma.campaign.create({
    data: {
      advertiserId: advertiser1.id,
      propertyId: grandIndo.id,
      name: '[COMPLETED] New Year Campaign GI',
      status: CampaignStatus.COMPLETED,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-07'),
      targetSlot: AdSlot.SCREENSAVER,
      durationPackage: DurationPackage.WEEKLY,
      totalCost: 10_500_000,
    },
  });
  console.log(`  ✅ ${campaign8.name} (COMPLETED, for analytics history)`);

  // ==========================================
  // G. IMPRESSION LOGS (Pre-seed analytics data)
  //    Simulates past playback so analytics
  //    endpoints return non-zero data
  // ==========================================
  console.log('\n📊 Seeding impression logs for analytics...');

  const giScreen1 = await prisma.screen.findUnique({
    where: { code: 'GI-JKT-SCR-1' },
  });
  const giScreen2 = await prisma.screen.findUnique({
    where: { code: 'GI-JKT-SCR-2' },
  });
  const shScreen1 = await prisma.screen.findUnique({
    where: { code: 'SH-BALI-SCR-1' },
  });
  const hshScreen1 = await prisma.screen.findUnique({
    where: { code: 'HSH-BDG-SCR-1' },
  });

  // Generate impression logs for the past 7 days
  const impressionData: Array<{
    screenId: number;
    campaignId: number;
    timestamp: Date;
    duration: number;
  }> = [];

  for (let day = 6; day >= 0; day--) {
    const baseDate = new Date(today);
    baseDate.setDate(today.getDate() - day);
    baseDate.setHours(8, 0, 0, 0);

    // GI Screen 1: campaign1 (HLS) plays 20x/day
    if (giScreen1) {
      for (let j = 0; j < 20; j++) {
        const ts = new Date(baseDate.getTime() + j * 30 * 60 * 1000);
        impressionData.push({
          screenId: giScreen1.id,
          campaignId: campaign1.id,
          timestamp: ts,
          duration: 30,
        });
      }
    }

    // GI Screen 2: campaign2 (MP4 info slider) plays 15x/day
    if (giScreen2) {
      for (let j = 0; j < 15; j++) {
        const ts = new Date(baseDate.getTime() + j * 40 * 60 * 1000);
        impressionData.push({
          screenId: giScreen2.id,
          campaignId: campaign2.id,
          timestamp: ts,
          duration: 20,
        });
      }
    }

    // SH Bali Screen 1: campaign3 (health image) plays 30x/day
    if (shScreen1) {
      for (let j = 0; j < 30; j++) {
        const ts = new Date(baseDate.getTime() + j * 20 * 60 * 1000);
        impressionData.push({
          screenId: shScreen1.id,
          campaignId: campaign3.id,
          timestamp: ts,
          duration: 10,
        });
      }
    }

    // HSH Hotel Screen 1: campaign5 (hotel promo) plays 10x/day
    if (hshScreen1) {
      for (let j = 0; j < 10; j++) {
        const ts = new Date(baseDate.getTime() + j * 60 * 60 * 1000);
        impressionData.push({
          screenId: hshScreen1.id,
          campaignId: campaign5.id,
          timestamp: ts,
          duration: 20,
        });
      }
    }
  }

  // Batch insert impressions
  const chunkSize = 100;
  for (let i = 0; i < impressionData.length; i += chunkSize) {
    await prisma.impressionLog.createMany({
      data: impressionData.slice(i, i + chunkSize),
      skipDuplicates: true,
    });
  }
  console.log(`  ✅ ${impressionData.length} impression logs seeded (7 days history)`);

  // ==========================================
  // H. PUBLISHER LEDGER (Pre-seed revenue data)
  //    Simulates revenue attribution per property
  // ==========================================
  console.log('\n💰 Seeding publisher ledger...');

  for (let day = 6; day >= 0; day--) {
    const ledgerDate = new Date(today);
    ledgerDate.setDate(today.getDate() - day);
    ledgerDate.setHours(0, 0, 0, 0);

    // Grand Indonesia: 35 impressions/day (20 + 15), revenue = 35 * pricePerImpression * 30%
    await prisma.publisherLedger.create({
      data: {
        propertyId: grandIndo.id,
        date: ledgerDate,
        totalImpressions: 35,
        totalRevenue: BigInt(35 * 1000 * 30) / 100n, // ~10,500 IDR/day (demo)
      },
    });

    // Siloam Bali: 30 impressions/day
    await prisma.publisherLedger.create({
      data: {
        propertyId: siloamBali.id,
        date: ledgerDate,
        totalImpressions: 30,
        totalRevenue: BigInt(30 * 1000 * 25) / 100n,
      },
    });

    // Hotel Savoy: 10 impressions/day
    await prisma.publisherLedger.create({
      data: {
        propertyId: hotelSavoy.id,
        date: ledgerDate,
        totalImpressions: 10,
        totalRevenue: BigInt(10 * 1000 * 20) / 100n,
      },
    });
  }
  console.log('  ✅ Publisher ledger seeded (7 days, 3 properties)');

  // ==========================================
  // FINAL SUMMARY
  // ==========================================
  const userCount = await prisma.user.count();
  const propertyCount = await prisma.property.count();
  const screenCount = await prisma.screen.count();
  const campaignCount = await prisma.campaign.count();
  const mediaCount = await prisma.media.count();
  const impressionCount = await prisma.impressionLog.count();

  console.log('\n🚀 ═══════════════════════════════════════════');
  console.log('   SmartIV E2E Seed — COMPLETE!');
  console.log('═══════════════════════════════════════════');
  console.log(`   👤 Users          : ${userCount}`);
  console.log(`   🏢 Properties     : ${propertyCount}`);
  console.log(`   📺 Screens        : ${screenCount} (25 ONLINE, 2 OFFLINE for HSH)`);
  console.log(`   📢 Campaigns      : ${campaignCount} (6 ACTIVE, 1 PENDING, 1 COMPLETED)`);
  console.log(`   🎬 Media Assets   : ${mediaCount} (4 video ✅, 5 image ✅)`);
  console.log(`   📊 Impression Logs: ${impressionCount} (7 days history)`);
  console.log('');
  console.log('   📋 Test Accounts:');
  console.log('   ┌─────────────────────────────────────────┐');
  console.log('   │ admin@smartiv.com        → SUPER_ADMIN  │');
  console.log('   │ client@grandbrand.com    → ADVERTISER   │');
  console.log('   │ client@umkm.com          → ADVERTISER   │');
  console.log('   │ operator@grandindonesia  → OP (GI-JKT)  │');
  console.log('   │ operator@siloambali.com  → OP (SH-BALI) │');
  console.log('   │ operator@savoyhomann.com → OP (HSH-BDG) │');
  console.log('   │ password: password123                   │');
  console.log('   └─────────────────────────────────────────┘');
  console.log('');
  console.log('   📺 Screen Codes for X-Device-ID:');
  console.log('   GI-JKT-SCR-1..15  | SH-BALI-SCR-1..10 | HSH-BDG-SCR-1..10');
  console.log('');
  console.log('   🎬 Media URLs (all working):');
  console.log(`   HLS : ${HLS_VIDEO_URL.substring(0, 60)}...`);
  console.log(`   MP4 : ${MP4_VIDEO_BBB.substring(0, 60)}...`);
  console.log(`   IMG : ${IMG_HD_LANDSCAPE.substring(0, 60)}...`);
  console.log('═══════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
