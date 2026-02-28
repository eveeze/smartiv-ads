import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * [Phase 15] API Key Guard for Machine-to-Machine authentication.
 * Reads the `X-Integration-Key` header and compares against env `INTEGRATION_API_KEY`.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('INTEGRATION_API_KEY') ?? '';
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.apiKey) {
      throw new UnauthorizedException(
        'Integration API key is not configured on the server',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.headers['x-integration-key'];

    if (!providedKey || providedKey !== this.apiKey) {
      throw new UnauthorizedException('Invalid or missing integration API key');
    }

    return true;
  }
}
