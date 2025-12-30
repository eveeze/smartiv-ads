import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand, // [FIX] Import ini wajib ada
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.getOrThrow<string>('minio.bucket');

    // FIX 1: Ambil host dan port terpisah, lalu gabungkan jadi URL lengkap
    const minioHost = this.configService.getOrThrow<string>('minio.endpoint');
    const minioPort = this.configService.getOrThrow<number>('minio.port');
    const fullS3Endpoint = `http://${minioHost}:${minioPort}`; // Hasil: http://minio:9000

    this.s3Client = new S3Client({
      region: 'us-east-1',
      endpoint: fullS3Endpoint, // Gunakan URL lengkap di sini
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('minio.accessKey'),
        secretAccessKey:
          this.configService.getOrThrow<string>('minio.secretKey'),
      },
    });
  }

  async uploadFile(
    key: string,
    fileBuffer: Buffer | fs.ReadStream,
    mimeType: string,
  ) {
    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: fileBuffer,
          ContentType: mimeType,
        }),
      );
      return this.getFileUrl(key);
    } catch (error) {
      this.logger.error(`Upload failed for ${key}: ${error.message}`);
      throw error;
    }
  }

  // [NEW] Method Delete yang sebelumnya hilang
  async delete(key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
      this.logger.log(`File deleted successfully from storage: ${key}`);
    } catch (error) {
      this.logger.error(`Delete failed for ${key}: ${error.message}`);
      // Kita throw error agar service pemanggil tahu kalau gagal hapus fisik
      throw error;
    }
  }

  getFileUrl(key: string): string {
    // FIX 2: Generate URL Publik
    // 'minio' hanya bisa diakses internal docker. Untuk browser (client), gunakan localhost.
    // Idealnya ini menggunakan ENV terpisah seperti PUBLIC_STORAGE_URL untuk production.
    return `http://localhost:9000/${this.bucketName}/${key}`;
  }

  // Helper: Download file dari S3 ke folder lokal (untuk diproses FFmpeg)
  async downloadToLocal(key: string, destinationPath: string): Promise<void> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    const stream = response.Body as Readable;

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destinationPath);
      stream.pipe(file);
      stream.on('error', reject);
      file.on('finish', resolve);
    });
  }
}
