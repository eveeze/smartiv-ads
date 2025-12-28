import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Get,
  ParseFilePipeBuilder,
  HttpStatus,
  FileValidator, // Import FileValidator
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
import { CurrentUser } from '../../common/decorators/current-user/current-user.decorator';
import type { User } from '@prisma/client';

// --- CUSTOM VALIDATOR ---
// Kita buat validator sendiri agar kontrol logic regex-nya 100% di tangan kita
export class CustomMimeTypeValidator extends FileValidator<{
  fileType: RegExp;
}> {
  isValid(file: any): boolean {
    // Pastikan mimetype ada
    if (!file.mimetype) return false;
    // Test regex manual
    return this.validationOptions.fileType.test(file.mimetype);
  }

  buildErrorMessage(file: any): string {
    return `Validation failed. Type '${file.mimetype}' is not supported.`;
  }
}
// ------------------------

@ApiTags('Media (Upload)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload Image or Video (Max 200MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile(
      new ParseFilePipeBuilder()
        // Ganti addFileTypeValidator bawaan dengan addValidator custom kita
        .addValidator(
          new CustomMimeTypeValidator({
            // Regex: String diawali dengan "image/" atau "video/"
            fileType: /^(image|video)\//,
          }),
        )
        .addMaxSizeValidator({
          maxSize: 200 * 1024 * 1024, // 200MB limit
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return this.mediaService.uploadMedia(file, user);
  }

  @Get()
  @ApiOperation({ summary: 'List My Media' })
  findAll(@CurrentUser() user: User) {
    return this.mediaService.findAll(user.id);
  }
}
