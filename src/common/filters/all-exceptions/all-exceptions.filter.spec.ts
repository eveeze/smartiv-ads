import { AllExceptionsFilter } from './all-exceptions.filter';
import {
  HttpException,
  HttpStatus,
  Logger,
  ArgumentsHost,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';

// Mock Response Object
const mockResponseObject = { headersSent: false };

// Mock Object untuk ArgumentsHost
const mockArgumentsHost = {
  switchToHttp: jest.fn(),
  getRequest: jest.fn(),
  getResponse: jest.fn(),
};

// Mock Object untuk HttpAdapter
const mockHttpAdapter = {
  getRequestUrl: jest.fn().mockReturnValue('/test-url'),
  reply: jest.fn(),
};

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(async () => {
    // [FIX] Bungkam Logger agar tidak print error ke console saat test dijalankan
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AllExceptionsFilter,
        {
          provide: HttpAdapterHost,
          useValue: { httpAdapter: mockHttpAdapter },
        },
      ],
    }).compile();

    filter = module.get<AllExceptionsFilter>(AllExceptionsFilter);

    jest.clearAllMocks();

    // Setup Mock agar getResponse me-return object
    mockArgumentsHost.switchToHttp.mockReturnValue({
      getRequest: jest.fn(),
      getResponse: jest.fn().mockReturnValue(mockResponseObject),
    });
  });

  it('should catch HttpException and return correct structure', () => {
    const exception = new HttpException(
      'Forbidden Access',
      HttpStatus.FORBIDDEN,
    );

    filter.catch(exception, mockArgumentsHost as unknown as ArgumentsHost);

    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        statusCode: 403,
        success: false,
        message: 'Forbidden Access',
        path: '/test-url',
      }),
      403,
    );
  });

  it('should catch Prisma P2002 (Duplicate Entry)', () => {
    const exception = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '6.0.0', meta: { target: ['email'] } },
    );

    filter.catch(exception, mockArgumentsHost as unknown as ArgumentsHost);

    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        statusCode: 400,
        success: false,
        message: 'Duplicate entry: email already exists',
        error: 'Conflict Error',
      }),
      400,
    );
  });

  it('should catch Unknown Error and return 500', () => {
    const exception = new Error('Something exploded');

    // [INFO] Logger.error akan dipanggil di sini, tapi karena sudah di-mock, console akan tetap bersih.
    filter.catch(exception, mockArgumentsHost as unknown as ArgumentsHost);

    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        statusCode: 500,
        success: false,
        message: 'Internal server error',
      }),
      500,
    );
  });
});
