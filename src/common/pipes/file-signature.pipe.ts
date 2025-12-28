import {
  Injectable,
  PipeTransform,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
// FIX: Gunakan 'fromBuffer' untuk file-type versi 14/16
import { fromBuffer } from 'file-type';

@Injectable()
export class FileSignatureValidatorPipe implements PipeTransform {
  // Daftar ekstensi yang diizinkan (berdasarkan isi file, bukan nama file)
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

    // Cek Magic Bytes (Isi Biner File)
    const type = await fromBuffer(value.buffer);

    // Jika file tidak dikenali atau ekstensinya tidak ada di daftar putih
    if (!type || !this.allowedExtensions.includes(type.ext)) {
      throw new UnprocessableEntityException(
        `Validation failed. Detected file type: ${type?.ext || 'unknown'}. Allowed: ${this.allowedExtensions.join(', ')}`,
      );
    }

    return value;
  }
}
