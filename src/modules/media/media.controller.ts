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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Upload Media (Image/Video)' })
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile(FileSignatureValidatorPipe) file: Express.Multer.File,
    @Body() dto: UploadMediaDto,
    @CurrentUser() user: User,
  ) {
    return this.mediaService.upload(file, user);
  }

  @Get()
  @Roles(Role.ADVERTISER, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all media uploaded by me' })
  findAll(@CurrentUser() user: User) {
    return this.mediaService.findAll(user);
  }

  @Get('pending')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all pending media (Admin)' })
  findPending() {
    return this.mediaService.findPending();
  }

  @Get(':id')
  @Roles(Role.ADVERTISER, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get media detail' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.mediaService.findOne(id, user);
  }

  @Patch(':id/review')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve or Reject media (Admin)' })
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
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMediaDto,
    @CurrentUser() user: User,
  ) {
    return this.mediaService.update(id, dto, user);
  }

  // [NEW ENDPOINT]
  @Delete(':id')
  @Roles(Role.ADVERTISER)
  @ApiOperation({ summary: 'Delete media (Only if not in active campaign)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.mediaService.remove(id, user);
  }
}
