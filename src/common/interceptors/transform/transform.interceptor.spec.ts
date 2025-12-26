import { TransformInterceptor } from './transform.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('should wrap response data successfully', (done) => {
    // 1. Mock Data dari Controller
    const mockData = { id: 1, name: 'Test' };

    // 2. Mock ExecutionContext (Simulasi HTTP Context)
    const mockContext = {
      switchToHttp: () => ({
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;

    // 3. Mock CallHandler (Handler selanjutnya)
    const mockCallHandler: CallHandler = {
      handle: () => of(mockData), // 'of' membuat Observable
    };

    // 4. Jalankan Interceptor
    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (response) => {
        // 5. Assert (Cek Hasil)
        expect(response).toEqual({
          statusCode: 200,
          success: true,
          message: 'Operation successful',
          data: mockData,
        });
        done();
      },
      error: (err) => done(err),
    });
  });
});
