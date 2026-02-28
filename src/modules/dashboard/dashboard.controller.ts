import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { Roles } from '../../common/decorators/roles/roles.decorator';
import { Role } from '@prisma/client';
import type { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user/current-user.decorator';

@ApiTags('Dashboard - Operator')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard/operator')
  @Roles(Role.PROPERTY_OPERATOR)
  @ApiOperation({
    summary: 'Get operator dashboard (Revenue, Impressions, Screen Stats)',
  })
  getOperatorDashboard(@CurrentUser() user: User) {
    return this.dashboardService.getOperatorDashboard(user);
  }

  @Get('schedule/property')
  @Roles(Role.PROPERTY_OPERATOR)
  @ApiOperation({
    summary: 'Get schedule view (Calendar format of active campaigns)',
  })
  getPropertySchedule(@CurrentUser() user: User) {
    return this.dashboardService.getPropertySchedule(user);
  }

  @Get('properties/my-profile')
  @Roles(Role.PROPERTY_OPERATOR)
  @ApiOperation({
    summary: 'Get property profile (Read-only mirror of property data)',
  })
  getMyPropertyProfile(@CurrentUser() user: User) {
    return this.dashboardService.getMyPropertyProfile(user);
  }
}
