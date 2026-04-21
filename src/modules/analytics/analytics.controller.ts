import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ApiStandardErrors } from '../../common/decorators/api-errors.decorator';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { Roles } from '../../common/decorators/roles/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user/current-user.decorator';
import { AdvertiserSummaryDto, AdminSummaryDto } from './dto/summary.dto';
import { Role } from '@prisma/client';
import type { User } from '@prisma/client';

@ApiTags('Analytics & Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('advertiser/summary')
  @Roles(Role.ADVERTISER)
  @ApiOperation({
    summary: 'Get summary for Advertiser Dashboard',
    description:
      'Returns key metrics for the advertiser: active campaigns count, total spend, total impressions, and campaign performance breakdown.',
  })
  @ApiOkResponse({
    type: AdvertiserSummaryDto,
    description: 'Advertiser dashboard summary object.',
  })
  @ApiStandardErrors({ badRequest: false, notFound: false })
  async getAdvertiserSummary(@CurrentUser() user: User) {
    return this.analyticsService.getAdvertiserSummary(user.id);
  }

  @Get('admin/summary')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get summary for Super Admin Dashboard',
    description:
      'Returns platform-wide metrics: total revenue, active campaigns, registered users, and top-performing properties.',
  })
  @ApiOkResponse({
    type: AdminSummaryDto,
    description: 'Admin dashboard summary object.',
  })
  @ApiStandardErrors({ badRequest: false, notFound: false })
  async getAdminSummary() {
    return this.analyticsService.getAdminSummary();
  }
}
