import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Get,
  HttpStatus,
  ParseFilePipeBuilder,
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
// Import validator aman yang baru kita buat
import { FileSignatureValidatorPipe } from '../../common/pipes/file-signature.pipe';

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
      // 1. Validasi Ukuran (Cepat, cek header dulu)
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({
          maxSize: 200 * 1024 * 1024, // 200MB limit
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
      // 2. Validasi Keamanan (Cek isi file / Magic Bytes)
      new FileSignatureValidatorPipe(),
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
