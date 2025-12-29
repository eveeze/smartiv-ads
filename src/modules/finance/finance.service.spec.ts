import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from './finance.service';
import { PrismaService } from '../../providers/prisma/prisma.service';
import { MidtransService } from '../../providers/payment/midtrans.service';
import { TransactionType, TransactionStatus, User, Role } from '@prisma/client';

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
  },
  withdrawalRequest: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  // [FIX] Handle Array (Sequential) OR Function (Interactive)
  $transaction: jest.fn((arg) => {
    if (Array.isArray(arg)) {
      // Jika input array (Sequential Transaction), resolve semua promise
      return Promise.all(arg);
    }
    // Jika input function (Interactive Transaction), eksekusi dengan mockPrisma
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
};

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

      // Mock update returns agar Promise.all tidak error
      mockPrisma.transaction.update.mockResolvedValue({});
      mockPrisma.wallet.update.mockResolvedValue({});

      await service.handleMidtransNotification({});

      // Pastikan fungsi update dipanggil dengan argumen yang benar
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
