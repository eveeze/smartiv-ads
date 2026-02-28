import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardErrors } from '../../common/decorators/api-errors.decorator';
import {
  OperatorDashboardDto,
  ScheduleEntryDto,
  PropertyResponseDto,
} from '../../common/dto/api-response.dto';
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
    description:
      'Returns key metrics for the property operator: estimated revenue this month, total impressions today, active campaigns count, and screen online/offline summary.',
  })
  @ApiResponse({
    status: 200,
    description: 'Operator dashboard summary object.',
    type: OperatorDashboardDto,
  })
  @ApiStandardErrors({
    badRequest: 'Operator not assigned to any property.',
    notFound: false,
  })
  getOperatorDashboard(@CurrentUser() user: User) {
    return this.dashboardService.getOperatorDashboard(user);
  }

  @Get('schedule/property')
  @Roles(Role.PROPERTY_OPERATOR)
  @ApiOperation({
    summary: 'Get schedule view (Calendar format of active campaigns)',
    description:
      'Returns a calendar-style view of all active campaigns at the operator property. Organized by date with campaign name, slot, and time range.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of schedule entries grouped by date.',
    type: [ScheduleEntryDto],
  })
  @ApiStandardErrors({
    badRequest: 'Operator not assigned to any property.',
    notFound: false,
  })
  getPropertySchedule(@CurrentUser() user: User) {
    return this.dashboardService.getPropertySchedule(user);
  }

  @Get('properties/my-profile')
  @Roles(Role.PROPERTY_OPERATOR)
  @ApiOperation({
    summary: 'Get property profile (Read-only mirror of property data)',
    description:
      'Returns property details (name, address, classification, logo) for the operator. This is read-only — property data is managed by SmartIV Core.',
  })
  @ApiResponse({
    status: 200,
    description: 'Property profile object.',
    type: PropertyResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Operator not assigned to any property.',
    notFound: false,
  })
  getMyPropertyProfile(@CurrentUser() user: User) {
    return this.dashboardService.getMyPropertyProfile(user);
  }
}
