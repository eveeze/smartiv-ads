import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';
import { ApiResponse } from '../../interfaces/api-response/api-response.interface';
import { isObjectWithKey } from '../../utils/type-guards.util'; // 👈 Import Utility Modular

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data: T) => {
        const response = context.switchToHttp().getResponse<Response>();
        const statusCode = response.statusCode;

        let message = 'Operation successful';

        if (
          isObjectWithKey(data, 'message') &&
          typeof data.message === 'string'
        ) {
          message = data.message;
        }

        return {
          statusCode,
          success: true,
          message,
          data,
        };
      }),
    );
  }
}
