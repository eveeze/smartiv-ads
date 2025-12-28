import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../providers/prisma/prisma.service';
import { StorageService } from '../../../providers/storage/storage.service';
import {
  TRANSCODE_QUEUE,
  JOB_TRANSCODE_VIDEO,
} from '../../../providers/queue/queue.service';
import Ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Processor(TRANSCODE_QUEUE)
export class TranscodeProcessor extends WorkerHost {
  private readonly logger = new Logger(TranscodeProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<{ mediaId: number }>): Promise<void> {
    if (job.name !== JOB_TRANSCODE_VIDEO) return;

    const { mediaId } = job.data;
    this.logger.log(`🎬 Processing Media ID: ${mediaId}`);

    // 1. Ambil Data Media
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });
    if (!media || !media.url) throw new Error('Media not found or URL invalid');

    // 2. Setup Temp Folder Unik
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), `smartiv-${mediaId}-`),
    );
    const inputPath = path.join(tempDir, 'input.mp4');
    const outputPath = path.join(tempDir, 'hls');

    if (!fs.existsSync(outputPath)) fs.mkdirSync(outputPath);

    try {
      // 3. Download Video Mentah dari MinIO
      // Asumsi URL: http://minio:9000/bucket/raw/video.mp4 -> Key: raw/video.mp4
      // Kita ambil Key relatifnya dari URL
      const urlObj = new URL(media.url);
      // Remove first slash from pathname usually "/bucket/key" -> "key"
      // Sesuaikan logic ini dengan format URL MinIO kamu
      const key = decodeURIComponent(
        urlObj.pathname.split('/').slice(2).join('/'),
      );

      this.logger.debug(`Downloading key: ${key}`);
      await this.storage.downloadToLocal(key, inputPath);

      // 4. Generate Thumbnail (Screenshot detik ke-1)
      const thumbFilename = 'thumbnail.jpg';
      await new Promise<void>((resolve, reject) => {
        Ffmpeg(inputPath)
          .screenshots({
            count: 1,
            timestamps: ['1'],
            filename: thumbFilename,
            folder: tempDir,
            size: '480x?', // Lebar 480px, tinggi auto
          })
          .on('end', () => resolve())
          .on('error', (err) => reject(err));
      });

      // 5. Transcoding HLS (Multi-bitrate)
      this.logger.debug('Starting HLS Transcoding...');
      await new Promise<void>((resolve, reject) => {
        Ffmpeg(inputPath)
          .output(`${outputPath}/master.m3u8`)
          .addOptions([
            '-preset veryfast',
            '-g 48',
            '-sc_threshold 0',
            '-map 0:v:0',
            '-map 0:v:0', // 2 varian saja utk MVP (360p, 720p)
            '-map 0:a:0',
            '-map 0:a:0',

            // 360p
            '-s:v:0 640x360',
            '-c:v:0 libx264',
            '-b:v:0 800k',
            '-c:a:0 aac',
            '-b:a:0 96k',

            // 720p
            '-s:v:1 1280x720',
            '-c:v:1 libx264',
            '-b:v:1 2800k',
            '-c:a:1 aac',
            '-b:a:1 128k',

            // HLS Config
            '-f hls',
            '-var_stream_map v:0,a:0,name:360p v:1,a:1,name:720p',
            '-master_pl_name master.m3u8',
            '-hls_time 6',
            '-hls_playlist_type vod',
            `-hls_segment_filename ${outputPath}/%v/segment_%03d.ts`,
          ])
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      });

      // 6. Upload Hasil ke MinIO (Recursive)
      const s3BaseKey = `hls/${mediaId}`;

      // A. Upload Thumbnail
      const thumbBuffer = fs.readFileSync(path.join(tempDir, thumbFilename));
      const thumbUrl = await this.storage.uploadFile(
        `${s3BaseKey}/thumbnail.jpg`,
        thumbBuffer,
        'image/jpeg',
      );

      // B. Upload HLS Files
      const uploadRecursive = async (dir: string, baseKey: string) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          if (fs.statSync(fullPath).isDirectory()) {
            await uploadRecursive(fullPath, `${baseKey}/${file}`);
          } else {
            const buffer = fs.readFileSync(fullPath);
            const mime = file.endsWith('.m3u8')
              ? 'application/x-mpegURL'
              : 'video/MP2T';
            await this.storage.uploadFile(`${baseKey}/${file}`, buffer, mime);
          }
        }
      };
      await uploadRecursive(outputPath, s3BaseKey);

      // 7. Update Database
      await this.prisma.media.update({
        where: { id: mediaId },
        data: {
          isTranscoded: true,
          hlsUrl: this.storage.getFileUrl(`${s3BaseKey}/master.m3u8`),
          thumbnailUrl: thumbUrl,
        },
      });

      this.logger.log(`✅ Media ${mediaId} Transcoded Successfully!`);
    } catch (err) {
      this.logger.error(`❌ Transcode Failed: ${err.message}`);
      throw err; // Lempar error agar BullMQ tau ini gagal
    } finally {
      // 8. Cleanup Temp Files (Penting!)
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        this.logger.warn(`Failed to clean temp dir: ${tempDir}`);
      }
    }
  }
}
