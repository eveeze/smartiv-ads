import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
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

    this.s3Client = new S3Client({
      region: 'us-east-1',
      endpoint: this.configService.getOrThrow<string>('minio.endpoint'),
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
          // ACL: 'public-read', // Uncomment jika MinIO bucket policy belum public
        }),
      );
      return this.getFileUrl(key);
    } catch (error) {
      this.logger.error(`Upload failed for ${key}: ${error.message}`);
      throw error;
    }
  }

  getFileUrl(key: string): string {
    // Generate Public URL manual agar stateles
    // Pastikan env MINIO_ENDPOINT bisa diakses dari luar (browser)
    const endpoint = this.configService.get('minio.endpoint');
    return `${endpoint}/${this.bucketName}/${key}`;
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
