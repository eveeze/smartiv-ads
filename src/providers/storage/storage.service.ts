import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import * as fs from 'fs';

/** Default signed URL expiry: 1 hour */
const DEFAULT_PRESIGN_EXPIRY_SECONDS = 3600;

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.getOrThrow<string>('minio.bucket');

    const minioHost = this.configService.getOrThrow<string>('minio.endpoint');
    const minioPort = this.configService.getOrThrow<number>('minio.port');
    const fullS3Endpoint = `http://${minioHost}:${minioPort}`;

    this.s3Client = new S3Client({
      region: 'us-east-1',
      endpoint: fullS3Endpoint,
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
  ): Promise<string> {
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
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Upload failed for ${key}: ${msg}`);
      throw error;
    }
  }

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
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Delete failed for ${key}: ${msg}`);
      throw error;
    }
  }

  // [Phase 10 Step 3] Generate Presigned URL for secure content access
  async getPresignedUrl(
    key: string,
    expirySeconds: number = DEFAULT_PRESIGN_EXPIRY_SECONDS,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: expirySeconds,
    });
  }

  getFileUrl(key: string): string {
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
