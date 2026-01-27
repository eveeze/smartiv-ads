import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from './finance.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { MidtransService } from '../../providers/payment/midtrans.service';
import {
  TransactionStatus,
  User,
  Role,
  DurationPackage,
  AdSlot,
  PropertyClass,
} from '@prisma/client';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { CalculateCostDto } from './dto/calculate-cost.dto';

// ==========================================
// 1. DEFINISI TYPE-SAFE MOCK INTERFACES
// ==========================================

// --- MOCK DEFINITIONS ---

// --- MOCK DEFINITIONS ---

type MockFn = jest.Mock<any, any>;

interface MockPrismaService {
  wallet: {
    findUnique: MockFn;
    create: MockFn;
    update: MockFn;
  };
  transaction: {
    create: MockFn;
    update: MockFn;
    findUnique: MockFn;
    findMany: MockFn;
    count: MockFn;
  };
  withdrawalRequest: {
    create: MockFn;
    findMany: MockFn;
    findUnique: MockFn;
    update: MockFn;
  };
  screen: {
    findMany: MockFn;
  };
  property: {
    findUnique: MockFn;
  };
  rateCard: {
    findMany: MockFn;
  };
  $transaction: MockFn;
}

const mockPrisma: MockPrismaService = {
  wallet: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  transaction: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  withdrawalRequest: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  screen: {
    findMany: jest.fn(),
  },
  property: {
    findUnique: jest.fn(),
  },
  rateCard: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn((arg) => {
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return arg(mockPrisma);
  }),
};

const mockMidtrans = {
  createSnapTransaction: jest.fn(),
  verifyNotification: jest.fn(),
};

const mockUser: User = {
  id: 1,
  email: 'test@user.com',
  name: 'Test',
  password: 'pw',
  role: Role.ADVERTISER,
  phone: '081',
  propertyId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  isActive: true,
  passwordResetToken: null,
  passwordResetExpires: null,
};

// --- TEST SUITE ---

describe('FinanceService', () => {
  let service: FinanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MidtransService, useValue: mockMidtrans },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
    jest.clearAllMocks();
  });

  // 1. TEST CALCULATE COST (Rate Card Engine)
  describe('calculateCampaignCost', () => {
    // [FIX] Test Case disesuaikan dengan logic baru (DurationPackage + RateCard)
    it('should calculate cost correctly for WEEKLY package', async () => {
      const dto: CalculateCostDto = {
        propertyId: 1,
        targetSlot: AdSlot.SCREENSAVER,
        durationPackage: DurationPackage.WEEKLY,
        startDate: '2026-05-01',
      };

      // Mock Property & Inventory Count
      mockPrisma.property.findUnique.mockResolvedValue({
        id: 1,
        name: 'Grand Hotel',
        classification: PropertyClass.PREMIUM,
        _count: { screens: 5 }, // 5 Screen Aktif
      });

      // Mock Rate Card (Harga Mingguan)
      mockPrisma.rateCard.findMany.mockResolvedValue([
        {
          id: 1,
          propertyId: 1,
          targetSlot: AdSlot.SCREENSAVER,
          pricePerDay: BigInt(100000),
          pricePerWeek: BigInt(600000), // Ada harga spesial paket
        },
      ]);

      const result = await service.calculateCampaignCost(dto);

      // Rumus: Harga Paket (600.000) x Jumlah Screen (5) = 3.000.000
      expect(result.totalCost).toBe(3000000);
      expect(result.durationDays).toBe(7);
      expect(result.screenCount).toBe(5);
    });

    it('should calculate cost correctly for CUSTOM duration (Daily Rate)', async () => {
      const dto: CalculateCostDto = {
        propertyId: 2,
        targetSlot: AdSlot.INFO_SLIDER,
        durationPackage: DurationPackage.CUSTOM,
        startDate: '2026-05-01',
        endDate: '2026-05-03', // 2 Hari
      };

      mockPrisma.property.findUnique.mockResolvedValue({
        id: 2,
        name: 'Mall A',
        classification: PropertyClass.STANDARD,
        _count: { screens: 10 },
      });

      mockPrisma.rateCard.findMany.mockResolvedValue([
        {
          id: 2,
          propertyId: 2,
          pricePerDay: BigInt(50000),
        },
      ]);

      const result = await service.calculateCampaignCost(dto);

      // Rumus: (Harga Harian 50.000 x 2 Hari) x 10 Screen = 1.000.000
      expect(result.totalCost).toBe(1000000);
      expect(result.durationDays).toBe(2);
    });
  });

  // 2. TEST ADMIN DASHBOARD
  describe('getAllTransactions', () => {
    it('should return paginated transactions', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([
        { id: 1, amount: BigInt(50000) },
      ]);
      mockPrisma.transaction.count.mockResolvedValue(1);

      // Gunakan Type Assertion (unknown -> Dto) untuk memuaskan TypeScript
      const query = { page: 1, take: 10 } as unknown as TransactionQueryDto;

      const result = await service.getAllTransactions(query);

      expect(result.data[0].amount).toBe(50000);
      expect(result.meta.itemCount).toBe(1);
      expect(mockPrisma.transaction.findMany).toHaveBeenCalled();
    });
  });

  // 3. TEST TOPUP
  describe('requestTopup', () => {
    it('should create pending transaction and return midtrans token', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({ id: 1, userId: 1 });
      mockPrisma.transaction.create.mockResolvedValue({ id: 100 });
      mockMidtrans.createSnapTransaction.mockResolvedValue({
        token: 'snap-token',
        redirectUrl: 'http://url',
      });

      const res = await service.requestTopup(mockUser, { amount: 50000 });

      expect(mockPrisma.transaction.create).toHaveBeenCalled();
      expect(mockMidtrans.createSnapTransaction).toHaveBeenCalled();
      expect(res).toHaveProperty('token', 'snap-token');
    });
  });

  // 4. TEST WEBHOOK
  describe('handleMidtransNotification', () => {
    it('should update transaction to SUCCESS on settlement', async () => {
      mockMidtrans.verifyNotification.mockResolvedValue({
        order_id: 'TOPUP-1',
        transaction_status: 'settlement',
        fraud_status: 'accept',
      });

      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 100,
        walletId: 1,
        amount: BigInt(50000),
        status: TransactionStatus.PENDING,
      });

      // Mock update agar Promise.all tidak error
      mockPrisma.transaction.update.mockResolvedValue({});
      mockPrisma.wallet.update.mockResolvedValue({});

      await service.handleMidtransNotification({});

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 100 },
          data: { status: TransactionStatus.SUCCESS },
        }),
      );

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { balance: { increment: BigInt(50000) } },
        }),
      );
    });
  });
});
