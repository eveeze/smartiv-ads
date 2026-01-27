import {
  Injectable,
  PipeTransform,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { fromBuffer, fromFile } from 'file-type';
import * as fs from 'fs';

@Injectable()
export class FileSignatureValidatorPipe implements PipeTransform {
  private readonly allowedExtensions = [
    'jpg',
    'png',
    'jpeg',
    'mp4',
    'mov',
    'quicktime',
  ];

  async transform(value: Express.Multer.File) {
    if (!value) {
      throw new BadRequestException('File is required');
    }

    let type;

    // SKENARIO 1: Memory Storage (Buffer tersedia)
    if (value.buffer) {
      type = await fromBuffer(value.buffer);
    }
    // SKENARIO 2: Disk Storage (Buffer kosong, baca dari path)
    else if (value.path) {
      // fromFile jauh lebih hemat memori karena hanya membaca header file
      type = await fromFile(value.path);
    }

    // Jika file type tidak terdeteksi atau tidak diizinkan
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    if (!type || !this.allowedExtensions.includes(type.ext)) {
      // Hapus file sampah jika sudah terlanjur tersimpan di disk agar tidak menuh-menuhin server
      if (value.path && fs.existsSync(value.path)) {
        fs.unlinkSync(value.path);
      }

      throw new UnprocessableEntityException(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Validation failed. Detected file type: ${type?.ext || 'unknown'}. Allowed: ${this.allowedExtensions.join(', ')}`,
      );
    }

    return value;
  }
}
