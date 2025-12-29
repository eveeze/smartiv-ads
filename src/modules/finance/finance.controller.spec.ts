import { Test, TestingModule } from '@nestjs/testing';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { CreateTopupDto } from './dto/create-topup.dto';
import { WithdrawalRequestDto } from './dto/withdrawal-request.dto';
import { ReviewWithdrawalDto } from './dto/review-withdrawal.dto';
import { User, Role } from '@prisma/client';

describe('FinanceController', () => {
  let controller: FinanceController;
  let service: FinanceService;

  // Mock Data User
  const mockUser: User = {
    id: 1,
    email: 'user@test.com',
    name: 'Test User',
    password: 'hashedpassword',
    role: Role.ADVERTISER,
    phone: '08123456789',
    propertyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAdmin: User = {
    ...mockUser,
    id: 99,
    role: Role.SUPER_ADMIN,
  };

  // Mock FinanceService
  const mockFinanceService = {
    getMyWallet: jest.fn(),
    requestTopup: jest.fn(),
    requestWithdrawal: jest.fn(),
    handleMidtransNotification: jest.fn(),
    getPendingWithdrawals: jest.fn(),
    reviewWithdrawal: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinanceController],
      providers: [
        {
          provide: FinanceService,
          useValue: mockFinanceService,
        },
      ],
    }).compile();

    controller = module.get<FinanceController>(FinanceController);
    service = module.get<FinanceService>(FinanceService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // --- ADVERTISER TESTS ---

  describe('getMyWallet', () => {
    it('should return user wallet details', async () => {
      const mockWallet = { id: 1, balance: 50000, frozenBalance: 0 };
      mockFinanceService.getMyWallet.mockResolvedValue(mockWallet);

      const result = await controller.getMyWallet(mockUser);

      expect(service.getMyWallet).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockWallet);
    });
  });

  describe('requestTopup', () => {
    it('should return topup transaction info', async () => {
      const dto: CreateTopupDto = { amount: 100000 };
      const mockResponse = {
        transactionId: 1,
        token: 'snap-token',
        redirectUrl: 'http://midtrans.com',
      };
      mockFinanceService.requestTopup.mockResolvedValue(mockResponse);

      const result = await controller.requestTopup(mockUser, dto);

      expect(service.requestTopup).toHaveBeenCalledWith(mockUser, dto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('requestWithdrawal', () => {
    it('should create withdrawal request', async () => {
      const dto: WithdrawalRequestDto = {
        amount: 50000,
        bankName: 'BCA',
        accountNo: '123456',
        accountName: 'User Name',
      };
      const mockResponse = { id: 1, status: 'PENDING' };
      mockFinanceService.requestWithdrawal.mockResolvedValue(mockResponse);

      const result = await controller.requestWithdrawal(mockUser, dto);

      expect(service.requestWithdrawal).toHaveBeenCalledWith(mockUser, dto);
      expect(result).toEqual(mockResponse);
    });
  });

  // --- PUBLIC WEBHOOK TEST ---

  describe('handleMidtransWebhook', () => {
    it('should process notification', async () => {
      const mockNotification = {
        order_id: 'TOPUP-1',
        transaction_status: 'settlement',
      };
      mockFinanceService.handleMidtransNotification.mockResolvedValue({
        status: 'ok',
      });

      const result = await controller.handleMidtransWebhook(mockNotification);

      expect(service.handleMidtransNotification).toHaveBeenCalledWith(
        mockNotification,
      );
      expect(result).toEqual({ status: 'ok' });
    });
  });

  // --- ADMIN TESTS ---

  describe('getPendingWithdrawals', () => {
    it('should return list of pending withdrawals', async () => {
      const mockList = [{ id: 1, amount: 50000 }];
      mockFinanceService.getPendingWithdrawals.mockResolvedValue(mockList);

      const result = await controller.getPendingWithdrawals();

      expect(service.getPendingWithdrawals).toHaveBeenCalled();
      expect(result).toEqual(mockList);
    });
  });

  describe('reviewWithdrawal', () => {
    it('should process review approval', async () => {
      const dto: ReviewWithdrawalDto = { approved: true, adminNote: 'Done' };
      const mockResponse = { id: 1, status: 'APPROVED' };
      mockFinanceService.reviewWithdrawal.mockResolvedValue(mockResponse);

      const result = await controller.reviewWithdrawal(1, dto, mockAdmin);

      expect(service.reviewWithdrawal).toHaveBeenCalledWith(
        1,
        dto,
        mockAdmin.id,
      );
      expect(result).toEqual(mockResponse);
    });
  });
});
