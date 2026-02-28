import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Standard API Success Response Wrapper.
 * All successful responses are automatically wrapped by TransformInterceptor.
 *
 * Frontend should always expect this shape for 2xx responses:
 * ```json
 * {
 *   "statusCode": 200,
 *   "success": true,
 *   "message": "Operation successful",
 *   "data": { ... }
 * }
 * ```
 */
export class ApiSuccessResponseDto {
  @ApiProperty({ example: 200, description: 'HTTP status code' })
  statusCode: number;

  @ApiProperty({ example: true, description: 'Always true for success' })
  success: boolean;

  @ApiProperty({
    example: 'Operation successful',
    description: 'Human-readable message',
  })
  message: string;

  @ApiProperty({
    description: 'Response payload (varies per endpoint)',
    example: {},
  })
  data: unknown;
}

/**
 * Standard API Error Response.
 * All error responses (4xx/5xx) follow this shape from AllExceptionsFilter.
 *
 * Frontend should always expect this shape for error responses:
 * ```json
 * {
 *   "statusCode": 400,
 *   "success": false,
 *   "message": "Validation failed",
 *   "error": "Bad Request",
 *   "timestamp": "2026-01-01T00:00:00.000Z",
 *   "path": "/api/auth/login"
 * }
 * ```
 */
export class ApiErrorResponseDto {
  @ApiProperty({ example: 400, description: 'HTTP status code' })
  statusCode: number;

  @ApiProperty({ example: false, description: 'Always false for errors' })
  success: boolean;

  @ApiProperty({
    example: 'Validation failed',
    description: 'Human-readable error message',
  })
  message: string;

  @ApiProperty({
    example: 'Bad Request',
    description:
      'Error type category (e.g., Bad Request, Not Found, Forbidden)',
    nullable: true,
  })
  error: string | null;

  @ApiProperty({
    example: '2026-01-01T00:00:00.000Z',
    description: 'ISO timestamp of error occurrence',
  })
  timestamp: string;

  @ApiProperty({
    example: '/api/auth/login',
    description: 'The request path that caused the error',
  })
  path: string;
}

/**
 * Standard message-only response (e.g., for delete, password change).
 */
export class MessageResponseDto {
  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;
}

/**
 * Auth login response data.
 */
export class LoginDataDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description:
      'JWT Bearer token. Include this in the Authorization header as: Bearer <token>',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Authenticated user info',
    example: {
      id: 1,
      email: 'admin@smartiv.com',
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
    },
  })
  user: Record<string, unknown>;
}

/**
 * Simple ID response (after create/delete operations).
 */
export class IdResponseDto {
  @ApiProperty({ example: 42 })
  id: number;
}

/**
 * Wallet top-up response with Midtrans payment info.
 */
export class TopupResponseDto {
  @ApiProperty({
    example: 'TRX-ADV-1-1709312000000',
    description: 'Unique transaction reference code',
  })
  referenceCode: string;

  @ApiPropertyOptional({
    example: 'abc-snaptoken-xyz',
    description: 'Midtrans Snap token for popup payment',
  })
  snapToken?: string;

  @ApiPropertyOptional({
    example: 'https://app.midtrans.com/snap/v4/redirect/abc',
    description: 'Midtrans redirect URL for payment',
  })
  redirectUrl?: string;

  @ApiPropertyOptional({
    example: 'data:image/png;base64,...',
    description: 'QRIS QR Code image (base64) for QRIS payment',
  })
  qrisUrl?: string;
}

/**
 * Wallet detail response.
 */
export class WalletDetailDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 500000, description: 'Current balance (IDR)' })
  balance: number;

  @ApiProperty({
    example: 100000,
    description: 'Balance frozen for pending campaigns',
  })
  frozenBalance: number;

  @ApiProperty({
    description: 'Recent transactions',
    type: 'array',
    example: [],
  })
  transactions: unknown[];
}

/**
 * Cost calculation response.
 */
export class CalculateCostResponseDto {
  @ApiProperty({ example: 750000, description: 'Total estimated cost in IDR' })
  totalCost: number;

  @ApiProperty({ example: 10000, description: 'CPM Rate used' })
  cpmRate: number;

  @ApiProperty({ example: 75, description: 'Estimated impressions' })
  estimatedImpressions: number;
}

/**
 * Campaign preview URL response.
 */
export class PreviewUrlResponseDto {
  @ApiProperty({
    example:
      'https://minio.example.com/smartiv-media/hls/55/preview.gif?X-Amz-Signature=...',
    description: 'Temporary presigned URL (expires in 1 hour)',
  })
  previewUrl: string;
}

/**
 * Property detail response.
 */
export class PropertyResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'smartiv-001' })
  smartivId: string;

  @ApiProperty({ example: 'SMT-GIM' })
  smartivCode: string;

  @ApiProperty({ example: 'Grand Indonesia Mall' })
  name: string;

  @ApiProperty({ example: 'Jl. MH Thamrin No.1' })
  address: string;

  @ApiProperty({ example: 'PREMIUM' })
  classification: string;

  @ApiProperty({ example: 'MALL' })
  type: string;

  @ApiPropertyOptional({ example: 'Asia/Jakarta' })
  timezone?: string;

  @ApiProperty({ example: 0.3, description: 'Revenue share percentage (0-1)' })
  revenueSharePercentage: number;
}

/**
 * Screen detail response.
 */
export class ScreenResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'SCR-GIM-001' })
  code: string;

  @ApiProperty({ example: 'Lobby Main Screen' })
  name: string;

  @ApiProperty({ example: 'LANDSCAPE' })
  orientation: string;

  @ApiProperty({ example: 'ONLINE' })
  status: string;

  @ApiPropertyOptional()
  lastPing?: Date;

  @ApiProperty({ example: 1 })
  propertyId: number;
}

/**
 * Media detail response.
 */
export class MediaResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Promo Ramadhan' })
  displayName: string;

  @ApiProperty({ example: 'VIDEO' })
  type: string;

  @ApiProperty({ example: 'APPROVED' })
  status: string;

  @ApiProperty({ example: 15, description: 'Duration in seconds (for video)' })
  duration: number;

  @ApiPropertyOptional({
    example: 'https://minio.../media.mp4?signature=...',
    description: 'Presigned URL for original file',
  })
  fileUrl?: string;

  @ApiPropertyOptional({
    example: 'https://minio.../hls/1/master.m3u8?signature=...',
    description: 'Presigned HLS streaming URL',
  })
  hlsUrl?: string;

  @ApiPropertyOptional({
    example: 'https://minio.../hls/1/thumb.jpg?signature=...',
    description: 'Presigned thumbnail URL',
  })
  thumbnailUrl?: string;

  @ApiPropertyOptional({
    example: 'https://minio.../hls/1/preview.gif?signature=...',
    description: 'Presigned GIF preview URL',
  })
  previewUrl?: string;

  @ApiPropertyOptional({
    type: 'array',
    example: [
      { id: 1, name: 'promo' },
      { id: 2, name: 'food' },
    ],
    description: 'Associated tags',
  })
  tags?: unknown[];
}

/**
 * Rate card response.
 */
export class RateCardResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 10000, description: 'Cost Per Mille (CPM) in IDR' })
  cpmPrice: number;

  @ApiProperty({ example: 'SCREENSAVER' })
  targetSlot: string;

  @ApiProperty({ example: 'ONE_WEEK' })
  duration: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 1 })
  propertyId: number;
}

/**
 * Campaign response.
 */
export class CampaignResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Ramadhan Promo Campaign' })
  name: string;

  @ApiProperty({ example: 'ACTIVE' })
  status: string;

  @ApiProperty({ example: '2026-01-15T00:00:00.000Z' })
  startDate: Date;

  @ApiProperty({ example: '2026-01-22T00:00:00.000Z' })
  endDate: Date;

  @ApiProperty({ example: 750000, description: 'Total cost in IDR' })
  totalCost: number;

  @ApiProperty({ example: 1, description: 'Advertiser user ID' })
  advertiserId: number;

  @ApiProperty({ example: 1, description: 'Target property ID' })
  propertyId: number;
}

/**
 * Dashboard operator summary.
 */
export class OperatorDashboardDto {
  @ApiProperty({
    example: '150000',
    description: 'Revenue estimate this month (IDR string)',
  })
  revenueCurrentMonth: string;

  @ApiProperty({ example: 1250, description: 'Total impressions today' })
  totalImpressions: number;

  @ApiProperty({ example: 3, description: 'Active campaign count' })
  activeCampaigns: number;

  @ApiProperty({
    example: { online: 8, offline: 2 },
    description: 'Screen online/offline summary',
  })
  screenSummary: Record<string, number>;
}

/**
 * Schedule entry.
 */
export class ScheduleEntryDto {
  @ApiProperty({ example: '2026-01-20' })
  date: string;

  @ApiProperty({
    example: [{ name: 'Iklan Sirup', slot: 'SCREENSAVER' }],
    description: 'Campaigns running on this date',
  })
  campaigns: unknown[];
}

/**
 * Category response.
 */
export class CategoryResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'FOOD_BEVERAGE' })
  code: string;

  @ApiProperty({ example: 'Food & Beverage' })
  name: string;
}

/**
 * Media tag response.
 */
export class MediaTagResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'promo' })
  name: string;
}

/**
 * Withdrawal request response.
 */
export class WithdrawalResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 500000 })
  amount: number;

  @ApiProperty({ example: 'PENDING' })
  status: string;

  @ApiProperty()
  createdAt: Date;
}

/**
 * Publisher revenue report.
 */
export class PublisherReportDto {
  @ApiProperty({
    example: '450000',
    description: 'Total earnings (IDR string)',
  })
  totalEarning: string;

  @ApiProperty({
    example: [
      { date: '2026-01-15', amount: '50000' },
      { date: '2026-01-16', amount: '75000' },
    ],
    description: 'Daily earnings breakdown',
  })
  dailyBreakdown: unknown[];
}

/**
 * Transaction record response.
 */
export class TransactionResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'TRX-ADV-1-1709312000000' })
  referenceCode: string;

  @ApiProperty({ example: 'TOPUP' })
  type: string;

  @ApiProperty({ example: 500000 })
  amount: number;

  @ApiProperty({ example: 'COMPLETED' })
  status: string;

  @ApiProperty()
  createdAt: Date;
}
