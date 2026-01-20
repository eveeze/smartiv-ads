import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as midtransClient from 'midtrans-client';

// Interface untuk konfigurasi Snap/CoreApi
interface MidtransConfig {
  isProduction: boolean;
  serverKey: string;
  clientKey: string;
}

// Interface untuk respon dari Snap.createTransaction
interface SnapResponse {
  token: string;
  redirect_url: string;
}

// Interface untuk CoreApi yang kita gunakan
interface IMidtransCoreApi {
  transaction: {
    // Input menerima unknown agar fleksibel, output Record
    notification(notificationBody: unknown): Promise<Record<string, unknown>>;
  };
}

@Injectable()
export class MidtransService {
  private snap: midtransClient.Snap;
  // [FIX] Menggunakan Interface spesifik internal
  private coreApi: IMidtransCoreApi;
  private readonly logger = new Logger(MidtransService.name);

  constructor(private configService: ConfigService) {
    const serverKey =
      this.configService.get<string>('midtrans.serverKey') ?? '';
    const clientKey =
      this.configService.get<string>('midtrans.clientKey') ?? '';
    const isProduction =
      this.configService.get<boolean>('midtrans.isProduction') ?? false;

    const config: MidtransConfig = {
      isProduction,
      serverKey,
      clientKey,
    };

    this.snap = new midtransClient.Snap(config);
    // [FIX] Casting ke interface internal
    this.coreApi = new midtransClient.CoreApi(
      config,
    ) as unknown as IMidtransCoreApi;
  }

  async createSnapTransaction(params: {
    orderId: string;
    amount: number;
    customer: {
      firstName: string;
      email: string;
      phone?: string;
    };
  }): Promise<{ token: string; redirectUrl: string }> {
    const parameter = {
      transaction_details: {
        order_id: params.orderId,
        gross_amount: params.amount,
      },
      customer_details: {
        first_name: params.customer.firstName,
        email: params.customer.email,
        phone: params.customer.phone,
      },
      credit_card: {
        secure: true,
      },
    };

    try {
      const transaction = (await this.snap.createTransaction(
        parameter,
      )) as SnapResponse;

      return {
        token: transaction.token,
        redirectUrl: transaction.redirect_url,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Midtrans Create Error: ${errorMessage}`);
      throw error;
    }
  }

  // [FIX] Menggunakan input 'unknown' untuk mengakomodasi request body dari controller
  // [FIX] Menggunakan return 'Promise<unknown>' agar consumer service bisa melakukan casting ke Interface DTO dengan aman
  async verifyNotification(notificationBody: unknown): Promise<unknown> {
    try {
      return await this.coreApi.transaction.notification(notificationBody);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Midtrans Notification Error: ${errorMessage}`);
      throw error;
    }
  }
}
