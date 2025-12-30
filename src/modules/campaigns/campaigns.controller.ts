import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { Roles } from '../../common/decorators/roles/roles.decorator';
import { Role } from '@prisma/client';
import type { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user/current-user.decorator';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CampaignQueryDto } from './dto/campaign-query.dto';
import { ReviewCampaignDto } from './dto/review-campaign.dto';

@ApiTags('Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @Roles(Role.ADVERTISER)
  @ApiOperation({ summary: 'Create a new campaign draft' })
  create(@CurrentUser() user: User, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(user, dto);
  }

  @Get()
  @Roles(Role.ADVERTISER, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get list of campaigns' })
  findAll(@CurrentUser() user: User, @Query() query: CampaignQueryDto) {
    return this.campaignsService.findAll(user, query);
  }

  @Get('pending')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get pending campaigns for review' })
  findPending(@CurrentUser() user: User, @Query() query: CampaignQueryDto) {
    query.status = 'PENDING_REVIEW' as any;
    return this.campaignsService.findAll(user, query);
  }

  @Get(':id')
  @Roles(Role.ADVERTISER, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get campaign details' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.campaignsService.findOne(id, user);
  }

  // [NEW ENDPOINT]
  @Patch(':id/cancel')
  @Roles(Role.ADVERTISER)
  @ApiOperation({
    summary: 'Cancel a campaign',
    description:
      'Cancels campaign. If status is PENDING_REVIEW, balance is refunded automatically.',
  })
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.campaignsService.cancel(id, user);
  }

  @Patch(':id/review')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve or Reject campaign (Admin)' })
  review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewCampaignDto,
    @CurrentUser() admin: User,
  ) {
    return this.campaignsService.review(id, dto, admin.id);
  }
}
