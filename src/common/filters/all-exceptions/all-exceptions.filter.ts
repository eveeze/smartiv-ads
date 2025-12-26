import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string | null;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    const { statusCode, message, error } = this.handleError(exception);

    const responseBody = {
      statusCode,
      success: false,
      message: Array.isArray(message) ? message[0] : message,
      error,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, statusCode);
  }

  private handleError(exception: unknown): ErrorResponse {
    if (exception instanceof HttpException) {
      return this.handleHttpException(exception);
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaException(exception);
    }
    return this.handleUnknownException(exception);
  }

  private handleHttpException(exception: HttpException): ErrorResponse {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();

    let message: string | string[] = exception.message;
    let error: string | null = null;

    if (typeof response === 'string') {
      message = response;
    } else if (typeof response === 'object' && response !== null) {
      const body = response as { message?: string | string[]; error?: string };
      message = body.message || exception.message;
      error = body.error || null;
    }

    return { statusCode, message, error };
  }

  private handlePrismaException(
    exception: Prisma.PrismaClientKnownRequestError,
  ): ErrorResponse {
    if (exception.code === 'P2002') {
      const meta = exception.meta as { target?: string[] | string } | undefined;
      const target = meta?.target;
      const targetStr = Array.isArray(target) ? target.join(', ') : target;

      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: `Duplicate entry: ${targetStr || 'Record'} already exists`,
        error: 'Conflict Error',
      };
    }

    return {
      statusCode: HttpStatus.BAD_REQUEST,
      message: `Database error: ${exception.message}`,
      error: 'Database Error',
    };
  }

  private handleUnknownException(exception: unknown): ErrorResponse {
    this.logger.error('Unhandled Exception:', exception);

    // Force return generic message agar sesuai Test dan aman untuk Production
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }
}
