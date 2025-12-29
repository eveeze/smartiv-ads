import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as midtransClient from 'midtrans-client';

@Injectable()
export class MidtransService {
  private snap: midtransClient.Snap;
  private coreApi: any;
  private readonly logger = new Logger(MidtransService.name);

  constructor(private configService: ConfigService) {
    // [FIX] Gunakan ?? '' untuk handle undefined agar sesuai tipe data library
    const serverKey =
      this.configService.get<string>('midtrans.serverKey') ?? '';
    const clientKey =
      this.configService.get<string>('midtrans.clientKey') ?? '';
    const isProduction =
      this.configService.get<boolean>('midtrans.isProduction') ?? false;

    const config = {
      isProduction,
      serverKey,
      clientKey,
    };

    this.snap = new midtransClient.Snap(config);
    this.coreApi = new midtransClient.CoreApi(config);
  }

  async createSnapTransaction(params: {
    orderId: string;
    amount: number;
    customer: {
      firstName: string;
      email: string;
      phone?: string;
    };
  }) {
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
      const transaction = await this.snap.createTransaction(parameter);
      return {
        token: transaction.token,
        redirectUrl: transaction.redirect_url,
      };
    } catch (error) {
      this.logger.error(`Midtrans Create Error: ${error.message}`);
      throw error;
    }
  }

  async verifyNotification(notificationBody: any) {
    try {
      return await this.coreApi.transaction.notification(notificationBody);
    } catch (error) {
      this.logger.error(`Midtrans Notification Error: ${error.message}`);
      throw error;
    }
  }
}
