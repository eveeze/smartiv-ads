import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { Roles } from '../../common/decorators/roles/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user/current-user.decorator';
import { AdvertiserSummaryDto, AdminSummaryDto } from './dto/summary.dto';
// [FIX] Pisahkan import value (Role) dan type (User)
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
  @ApiOperation({ summary: 'Get summary for Advertiser Dashboard' })
  @ApiOkResponse({ type: AdvertiserSummaryDto })
  async getAdvertiserSummary(@CurrentUser() user: User) {
    return this.analyticsService.getAdvertiserSummary(user.id);
  }

  @Get('admin/summary')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get summary for Super Admin Dashboard' })
  @ApiOkResponse({ type: AdminSummaryDto })
  async getAdminSummary() {
    return this.analyticsService.getAdminSummary();
  }
}
