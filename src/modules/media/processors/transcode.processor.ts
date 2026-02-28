import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../providers/prisma/prisma.service';
import { StorageService } from '../../../providers/storage/storage.service';
import {
  TRANSCODE_QUEUE,
  JOB_TRANSCODE_VIDEO,
} from '../../../providers/queue/queue.service';
import { MediaUtils } from '../../../common/utils/media.utils';
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

    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
    });
    if (!media || !media.url) throw new Error('Media not found or URL invalid');

    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), `smartiv-${mediaId}-`),
    );
    const inputPath = path.join(tempDir, 'input.mp4');
    const outputPath = path.join(tempDir, 'hls');

    if (!fs.existsSync(outputPath)) fs.mkdirSync(outputPath);

    try {
      // 1. Download Video
      const urlObj = new URL(media.url);
      const key = decodeURIComponent(
        urlObj.pathname.split('/').slice(2).join('/'),
      );

      this.logger.debug(`Downloading key: ${key}`);
      await this.storage.downloadToLocal(key, inputPath);

      // 2. Cek Audio Stream
      const hasAudio = await MediaUtils.hasAudioStream(inputPath);
      this.logger.debug(`Audio detected: ${hasAudio}`);

      // 3. Generate Thumbnail
      const thumbFilename = 'thumbnail.jpg';
      await this.generateThumbnail(inputPath, tempDir, thumbFilename);

      // 4. [Phase 10 Step 2] Generate GIF Preview (3s, 5fps, 320px wide)
      const previewFilename = 'preview.gif';
      await this.generateGifPreview(inputPath, tempDir, previewFilename);

      // 5. Transcoding HLS (240p, 360p, 480p, 720p)
      this.logger.debug('Starting HLS Transcoding (4 Qualities)...');
      await this.transcodeToHls(inputPath, outputPath, hasAudio);

      // 6. Upload Results
      const s3BaseKey = `hls/${mediaId}`;

      // Upload Thumbnail
      const thumbBuffer = fs.readFileSync(path.join(tempDir, thumbFilename));
      await this.storage.uploadFile(
        `${s3BaseKey}/thumbnail.jpg`,
        thumbBuffer,
        'image/jpeg',
      );

      // Upload GIF Preview
      const previewPath = path.join(tempDir, previewFilename);
      if (fs.existsSync(previewPath)) {
        const previewBuffer = fs.readFileSync(previewPath);
        await this.storage.uploadFile(
          `${s3BaseKey}/preview.gif`,
          previewBuffer,
          'image/gif',
        );
        this.logger.debug(`GIF Preview uploaded for media ${mediaId}`);
      }

      // Upload HLS Files
      await this.uploadDirectory(outputPath, s3BaseKey);

      // 7. Update DB
      await this.prisma.media.update({
        where: { id: mediaId },
        data: {
          isTranscoded: true,
          hlsUrl: MediaUtils.getHlsUrl(mediaId),
          thumbnailUrl: MediaUtils.getThumbnailUrl(mediaId),
          previewUrl: MediaUtils.getPreviewUrl(mediaId),
        },
      });

      this.logger.log(`✅ Media ${mediaId} Transcoded Successfully!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`❌ Transcode Failed: ${msg}`);
      throw err;
    } finally {
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch {
        this.logger.warn(`Failed to clean temp dir: ${tempDir}`);
      }
    }
  }

  // --- Private Helper Methods ---

  private generateThumbnail(
    inputPath: string,
    outputDir: string,
    filename: string,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      Ffmpeg(inputPath)
        .screenshots({
          count: 1,
          timestamps: ['1'],
          filename,
          folder: outputDir,
          size: '480x?',
        })
        .on('end', () => resolve())
        .on('error', reject);
    });
  }

  private generateGifPreview(
    inputPath: string,
    outputDir: string,
    filename: string,
  ): Promise<void> {
    const outputFilePath = path.join(outputDir, filename);
    return new Promise<void>((resolve, reject) => {
      Ffmpeg(inputPath)
        .setStartTime(1)
        .duration(3)
        .outputOptions([
          '-vf',
          'fps=5,scale=320:-1:flags=lanczos',
          '-c:v',
          'gif',
        ])
        .output(outputFilePath)
        .on('end', () => {
          this.logger.debug(`GIF preview generated: ${outputFilePath}`);
          resolve();
        })
        .on('error', (err) => {
          // GIF generation failure is non-critical — log warning and continue
          this.logger.warn(
            `GIF preview generation failed (non-critical): ${err.message}`,
          );
          resolve();
        })
        .run();
    });
  }

  private transcodeToHls(
    inputPath: string,
    outputPath: string,
    hasAudio: boolean,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const command = Ffmpeg(inputPath).output(`${outputPath}/stream_%v.m3u8`);

      const options: string[] = [
        '-preset',
        'veryfast',
        '-g',
        '48',
        '-sc_threshold',
        '0',
        '-map',
        '0:v:0', // 240p
        '-map',
        '0:v:0', // 360p
        '-map',
        '0:v:0', // 480p
        '-map',
        '0:v:0', // 720p
      ];

      // VIDEO SETTINGS
      options.push(
        '-s:v:0',
        '426x240',
        '-c:v:0',
        'libx264',
        '-b:v:0',
        '400k',
        '-s:v:1',
        '640x360',
        '-c:v:1',
        'libx264',
        '-b:v:1',
        '800k',
        '-s:v:2',
        '854x480',
        '-c:v:2',
        'libx264',
        '-b:v:2',
        '1400k',
        '-s:v:3',
        '1280x720',
        '-c:v:3',
        'libx264',
        '-b:v:3',
        '2800k',
      );

      // AUDIO SETTINGS
      let varStreamMap: string;

      if (hasAudio) {
        options.push(
          '-map',
          '0:a:0',
          '-map',
          '0:a:0',
          '-map',
          '0:a:0',
          '-map',
          '0:a:0',
        );
        options.push(
          '-c:a:0',
          'aac',
          '-b:a:0',
          '64k',
          '-c:a:1',
          'aac',
          '-b:a:1',
          '96k',
          '-c:a:2',
          'aac',
          '-b:a:2',
          '128k',
          '-c:a:3',
          'aac',
          '-b:a:3',
          '128k',
        );
        varStreamMap =
          'v:0,a:0,name:240p v:1,a:1,name:360p v:2,a:2,name:480p v:3,a:3,name:720p';
      } else {
        varStreamMap =
          'v:0,name:240p v:1,name:360p v:2,name:480p v:3,name:720p';
      }

      options.push(
        '-f',
        'hls',
        '-var_stream_map',
        varStreamMap,
        '-master_pl_name',
        'master.m3u8',
        '-hls_time',
        '6',
        '-hls_playlist_type',
        'vod',
        '-hls_segment_filename',
        `${outputPath}/stream_%v_data%03d.ts`,
      );

      command
        .addOptions(options)
        .on('end', () => resolve())
        .on('error', (err, _stdout, stderr) => {
          this.logger.error(`FFmpeg Stderr: ${stderr}`);
          reject(err);
        })
        .run();
    });
  }

  private async uploadDirectory(dir: string, baseKey: string): Promise<void> {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        await this.uploadDirectory(fullPath, `${baseKey}/${file}`);
      } else {
        const buffer = fs.readFileSync(fullPath);
        const mime = file.endsWith('.m3u8')
          ? 'application/x-mpegURL'
          : 'video/MP2T';
        await this.storage.uploadFile(`${baseKey}/${file}`, buffer, mime);
      }
    }
  }
}
