import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Get,
  HttpStatus,
  ParseFilePipeBuilder,
  Patch,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiTags,
  ApiOperation,
} from '@nestjs/swagger';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles/roles.guard';
import { Roles } from '../../common/decorators/roles/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user/current-user.decorator';
import { FileSignatureValidatorPipe } from '../../common/pipes/file-signature.pipe';
import { ReviewMediaDto } from './dto/review-media.dto';
import { Role } from '@prisma/client';
import type { User } from '@prisma/client';

@ApiTags('Media (Upload & Moderation)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @Roles(Role.ADVERTISER, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Upload Image or Video (Max 200MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 200 * 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
      new FileSignatureValidatorPipe(),
    )
    file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return this.mediaService.uploadMedia(file, user);
  }

  @Get()
  @Roles(Role.ADVERTISER, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List My Media (Advertiser) or All (Admin)' })
  findAll(@CurrentUser() user: User) {
    return this.mediaService.findAll(user);
  }

  @Get('pending')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Get Pending Media Queue' })
  getPendingMedia() {
    return this.mediaService.getPendingMedia();
  }

  // [NEW] Get Detail Media
  @Get(':id')
  @Roles(Role.ADVERTISER, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get Media Detail by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.mediaService.findOne(id);
  }

  @Patch(':id/review')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: '[Admin] Approve or Reject Media' })
  reviewMedia(
    @Param('id', ParseIntPipe) id: number,
    @Body() reviewDto: ReviewMediaDto,
    @CurrentUser() admin: User,
  ) {
    return this.mediaService.reviewMedia(id, reviewDto, admin.id);
  }
}
