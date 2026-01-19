import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from './finance.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { MidtransService } from '../../providers/payment/midtrans.service';
import { TransactionStatus, User, Role } from '@prisma/client';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { CalculateCostDto } from './dto/calculate-cost.dto';

// ==========================================
// 1. DEFINISI TYPE-SAFE MOCK INTERFACES
// ==========================================

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
  $transaction: MockFn;
}

interface MockMidtransService {
  createSnapTransaction: MockFn;
  verifyNotification: MockFn;
}

// --- MOCK DEFINITIONS ---

const mockPrisma = {
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
  // Handle Sequential (Array) & Interactive (Callback) Transactions
  $transaction: jest.fn((arg) => {
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    // Jika arg berupa function (interactive transaction), eksekusi dengan mockPrisma
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return arg(mockPrisma);
  }),
} as unknown as MockPrismaService;

const mockMidtrans = {
  createSnapTransaction: jest.fn(),
  verifyNotification: jest.fn(),
} as unknown as MockMidtransService;

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
  isActive: true, // [FIX] Added missing field
  passwordResetToken: null, // [FIX] Added missing field
  passwordResetExpires: null, // [FIX] Added missing field
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
    it('should calculate cost correctly with override price', async () => {
      // Mock data Screen dengan Override Price
      mockPrisma.screen.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Screen 1',
          priceOverride: BigInt(100000), // Override harga
          property: {
            rateCards: [],
          },
        },
      ]);

      const dto: CalculateCostDto = {
        screenIds: [1],
        startDate: '2025-01-01',
        endDate: '2025-01-02', // 1 hari
      };

      const result = await service.calculateCampaignCost(dto);

      expect(result.totalCost).toBe(100000);
      expect(result.durationDays).toBe(1);
    });

    it('should calculate cost correctly with rate card property', async () => {
      // Mock data Screen tanpa Override, pakai Rate Card Property
      mockPrisma.screen.findMany.mockResolvedValue([
        {
          id: 2,
          name: 'Screen 2',
          priceOverride: null, // Tidak ada override
          property: {
            classification: 'PREMIUM',
            rateCards: [
              {
                isActive: true,
                classification: 'PREMIUM',
                pricePerDay: BigInt(75000), // Harga Rate Card
              },
            ],
          },
        },
      ]);

      const dto: CalculateCostDto = {
        screenIds: [2],
        startDate: '2025-01-01',
        endDate: '2025-01-03', // 2 hari
      };

      const result = await service.calculateCampaignCost(dto);

      // Hitungan: 75.000 x 2 hari = 150.000
      expect(result.totalCost).toBe(150000);
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
      // karena kita passing object literal yang tidak memiliki getter 'skip'
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
