import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardErrors } from '../../common/decorators/api-errors.decorator';
import {
  CampaignResponseDto,
  MessageResponseDto,
  PreviewUrlResponseDto,
} from '../../common/dto/api-response.dto';
import { CampaignsService } from './campaigns.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { Roles } from '../../common/decorators/roles/roles.decorator';
import { Role } from '@prisma/client';
import type { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user/current-user.decorator';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
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
  @ApiOperation({
    summary: 'Create a new campaign',
    description:
      'Creates a campaign with media items. Use saveAsDraft=true to save without freezing wallet balance. Validates media compatibility with target placement.',
  })
  @ApiResponse({
    status: 201,
    description: 'Campaign created successfully.',
    type: CampaignResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Missing required fields or media incompatible with placement.',
    notFound: 'Referenced media, property, or placement not found.',
  })
  create(@CurrentUser() user: User, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(user, dto);
  }

  @Get()
  @Roles(Role.ADVERTISER, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get list of campaigns',
    description:
      'Returns campaigns based on user role. Advertisers see their own campaigns; Admins see all. Supports status and pagination filters.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of campaigns.',
    type: [CampaignResponseDto],
  })
  @ApiStandardErrors({ badRequest: false, notFound: false })
  findAll(@CurrentUser() user: User, @Query() query: CampaignQueryDto) {
    return this.campaignsService.findAll(user, query);
  }

  @Get('pending')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get pending campaigns for review',
    description:
      'Returns campaigns with PENDING_REVIEW status awaiting admin approval.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of pending campaigns.',
    type: [CampaignResponseDto],
  })
  @ApiStandardErrors({ badRequest: false, notFound: false })
  findPending(@CurrentUser() user: User, @Query() query: CampaignQueryDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    query.status = 'PENDING_REVIEW' as any;
    return this.campaignsService.findAll(user, query);
  }

  @Get(':id')
  @Roles(Role.ADVERTISER, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get campaign details',
    description:
      'Returns full campaign data including items, screens, and financial details.',
  })
  @ApiResponse({
    status: 200,
    description: 'Campaign detail object.',
    type: CampaignResponseDto,
  })
  @ApiStandardErrors({
    badRequest: false,
    notFound: 'Campaign not found or not owned by user.',
  })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.campaignsService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(Role.ADVERTISER)
  @ApiOperation({
    summary: 'Update campaign (Only if Status = DRAFT)',
    description:
      'Allows editing campaign details. Only drafts can be modified.',
  })
  @ApiResponse({
    status: 200,
    description: 'Campaign updated.',
    type: CampaignResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Campaign is not in DRAFT status.',
    notFound: 'Campaign not found.',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(id, user.id, dto);
  }

  @Patch(':id/submit')
  @Roles(Role.ADVERTISER)
  @ApiOperation({
    summary: 'Submit Draft Campaign',
    description:
      'Changes status from DRAFT to PENDING_REVIEW and freezes the campaign cost from wallet balance.',
  })
  @ApiResponse({
    status: 200,
    description: 'Campaign submitted for review. Wallet balance frozen.',
    type: CampaignResponseDto,
  })
  @ApiStandardErrors({
    badRequest:
      'Campaign is not in DRAFT status or insufficient wallet balance.',
    notFound: 'Campaign not found.',
  })
  submit(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.campaignsService.submit(id, user.id);
  }

  @Delete(':id')
  @Roles(Role.ADVERTISER)
  @ApiOperation({
    summary: 'Delete campaign (Only if Status = DRAFT)',
    description:
      'Permanently removes a draft campaign. Non-draft campaigns cannot be deleted.',
  })
  @ApiResponse({
    status: 200,
    description: 'Campaign deleted.',
    type: MessageResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Campaign is not in DRAFT status.',
    notFound: 'Campaign not found.',
  })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.campaignsService.remove(id, user.id);
  }

  @Patch(':id/cancel')
  @Roles(Role.ADVERTISER)
  @ApiOperation({
    summary: 'Cancel a campaign',
    description:
      'Cancels campaign. If status is PENDING_REVIEW, frozen balance is refunded automatically. Active campaigns are stopped without refund.',
  })
  @ApiResponse({
    status: 200,
    description: 'Campaign cancelled. Refund applied if applicable.',
    type: CampaignResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Campaign cannot be cancelled in its current status.',
    notFound: 'Campaign not found.',
  })
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.campaignsService.cancel(id, user);
  }

  @Patch(':id/review')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Approve or Reject campaign (Admin)',
    description:
      'Admin reviews a PENDING_REVIEW campaign. Approved campaigns become ACTIVE. Rejected campaigns refund the frozen balance.',
  })
  @ApiResponse({
    status: 200,
    description: 'Campaign reviewed (approved or rejected).',
    type: CampaignResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Campaign is not in PENDING_REVIEW status.',
    notFound: 'Campaign not found.',
  })
  review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewCampaignDto,
  ) {
    return this.campaignsService.review(id, dto);
  }

  // [Phase 14] Campaign Preview for Sales Tools
  @Get(':id/preview-url')
  @Roles(Role.ADVERTISER, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get campaign preview URL (for sharing/presentation)',
    description:
      'Generates a temporary presigned URL for previewing campaign media. Useful for sales presentations.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns presigned preview URL.',
    type: PreviewUrlResponseDto,
  })
  @ApiStandardErrors({ badRequest: false, notFound: 'Campaign not found.' })
  getPreviewUrl(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.campaignsService.getPreviewUrl(id, user);
  }
}
