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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { Roles } from '../../common/decorators/roles/roles.decorator';
import { Role } from '@prisma/client';
// [FIX] Gunakan 'import type' untuk User dari Prisma Client
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
  create(@CurrentUser() user: User, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: User, @Query() query: CampaignQueryDto) {
    return this.campaignsService.findAll(user, query);
  }

  // Khusus Admin: Shortcut untuk melihat yang pending
  @Get('pending')
  @Roles(Role.SUPER_ADMIN)
  findPending(@CurrentUser() user: User, @Query() query: CampaignQueryDto) {
    // Override status query
    query.status = 'PENDING_REVIEW' as any;
    return this.campaignsService.findAll(user, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.campaignsService.findOne(id, user);
  }

  @Patch(':id/review')
  @Roles(Role.SUPER_ADMIN)
  review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewCampaignDto,
    @CurrentUser() admin: User,
  ) {
    return this.campaignsService.review(id, dto, admin.id);
  }
}
