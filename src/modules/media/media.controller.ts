import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Body,
  UseGuards,
  Delete,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardErrors } from '../../common/decorators/api-errors.decorator';
import { UploadMediaDto } from './dto/upload-media.dto';
import { FileSignatureValidatorPipe } from '../../common/pipes/file-signature.pipe';
import { JwtAuthGuard } from '../../common/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { Roles } from '../../common/decorators/roles/roles.decorator';
import { Role } from '@prisma/client';
import type { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user/current-user.decorator';
import { ReviewMediaDto } from './dto/review-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';

@ApiTags('Media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @Roles(Role.ADVERTISER)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload Media (Image/Video)',
    description:
      'Uploads a media file (image or video). Supports optional tags (comma-separated). Video files are automatically queued for HLS transcoding.',
  })
  @ApiResponse({
    status: 201,
    description: 'Media uploaded and queued for processing.',
  })
  @ApiStandardErrors({
    badRequest: 'No file attached or invalid file type/signature.',
    notFound: false,
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile(FileSignatureValidatorPipe) file: Express.Multer.File,
    @Body() dto: UploadMediaDto,
    @CurrentUser() user: User,
  ) {
    return this.mediaService.upload(file, user, dto);
  }

  @Get()
  @Roles(Role.ADVERTISER, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get all media (with optional tag search)',
    description:
      'Returns media assets owned by the user (Advertiser) or all assets (Admin). Filter by tag name using the `search` query parameter.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by tag name (e.g., "promo", "food")',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of media objects with presigned URLs.',
  })
  @ApiStandardErrors({ badRequest: false, notFound: false })
  findAll(@CurrentUser() user: User, @Query('search') search?: string) {
    return this.mediaService.findAll(user, search);
  }

  @Get('pending')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get all pending media (Admin)',
    description: 'Returns media awaiting admin review/approval.',
  })
  @ApiResponse({ status: 200, description: 'Array of pending media objects.' })
  @ApiStandardErrors({ badRequest: false, notFound: false })
  findPending() {
    return this.mediaService.findPending();
  }

  // [Phase 10 Step 4] Tags Autocomplete endpoint
  @Get('tags')
  @Roles(Role.ADVERTISER, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get all media tags (for autocomplete)',
    description:
      'Returns all unique tag names. Use for autocomplete/suggestions in the upload form.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of tag objects with id and name.',
  })
  @ApiStandardErrors({ badRequest: false, notFound: false })
  findAllTags() {
    return this.mediaService.findAllTags();
  }

  @Get(':id')
  @Roles(Role.ADVERTISER, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get media detail',
    description:
      'Returns full media data including presigned URLs for file, HLS stream, thumbnail, and GIF preview.',
  })
  @ApiResponse({
    status: 200,
    description: 'Media detail object with presigned URLs.',
  })
  @ApiStandardErrors({
    badRequest: false,
    notFound: 'Media with specified ID not found.',
  })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.mediaService.findOne(id, user);
  }

  @Patch(':id/review')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Approve or Reject media (Admin)',
    description:
      'Admin reviews uploaded media. Approved media can be used in campaigns.',
  })
  @ApiResponse({ status: 200, description: 'Media status updated.' })
  @ApiStandardErrors({
    badRequest: 'Invalid review action.',
    notFound: 'Media not found.',
  })
  review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewMediaDto,
    @CurrentUser() admin: User,
  ) {
    return this.mediaService.review(id, dto, admin.id);
  }

  @Patch(':id')
  @Roles(Role.ADVERTISER)
  @ApiOperation({
    summary: 'Update media metadata (Title, Description, ActionURL)',
    description:
      'Allows advertisers to update the metadata of their own media assets.',
  })
  @ApiResponse({ status: 200, description: 'Media metadata updated.' })
  @ApiStandardErrors({
    badRequest: 'Invalid fields.',
    notFound: 'Media not found or not owned by user.',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMediaDto,
    @CurrentUser() user: User,
  ) {
    return this.mediaService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADVERTISER)
  @ApiOperation({
    summary: 'Delete media (Only if not in active campaign)',
    description:
      'Permanently deletes a media asset. Fails if media is used by an active campaign.',
  })
  @ApiResponse({ status: 200, description: 'Media deleted successfully.' })
  @ApiStandardErrors({
    badRequest: 'Media is currently used in an active campaign.',
    notFound: 'Media not found or not owned by user.',
  })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.mediaService.remove(id, user);
  }
}
