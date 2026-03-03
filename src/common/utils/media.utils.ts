import Ffmpeg from 'fluent-ffmpeg';

export class MediaUtils {
  // =================================================================
  // Static Config: Set once at bootstrap from ConfigService
  // =================================================================
  private static _publicUrl: string | null = null;

  /**
   * Initialize MediaUtils with config values.
   * Call this once in main.ts after NestFactory.create().
   */
  static configure(publicUrl: string): void {
    MediaUtils._publicUrl = publicUrl.replace(/\/$/, '');
  }

  private static getPublicUrl(): string {
    if (MediaUtils._publicUrl) return MediaUtils._publicUrl;
    // Fallback to process.env only if not configured via configure()
    return (
      process.env.MINIO_PUBLIC_URL || 'http://localhost:9000/smartiv-media'
    ).replace(/\/$/, '');
  }

  // =================================================================
  // 1. Helper Logic: Cek Audio Stream (Untuk TranscodeProcessor)
  // =================================================================
  static async hasAudioStream(filePath: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      Ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err)
          return reject(err instanceof Error ? err : new Error(String(err)));

        const streams = metadata?.streams || [];
        const hasAudio = streams.some(
          (stream) => stream.codec_type === 'audio',
        );
        resolve(hasAudio);
      });
    });
  }

  // =================================================================
  // 2. Helper: Get Media Dimensions via ffprobe
  // =================================================================
  static async getMediaDimensions(
    filePath: string,
  ): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      Ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err)
          return reject(err instanceof Error ? err : new Error(String(err)));

        const videoStream = metadata?.streams?.find(
          (s) => s.codec_type === 'video',
        );
        if (!videoStream?.width || !videoStream?.height) {
          return reject(new Error('Could not determine media dimensions'));
        }

        resolve({
          width: videoStream.width,
          height: videoStream.height,
        });
      });
    });
  }

  // =================================================================
  // 3. Helper URL: Generate Full URL
  // =================================================================
  static getFullUrl(relativePath: string | null): string | null {
    if (!relativePath) return null;

    // Jika path sudah berupa URL lengkap, kembalikan langsung
    if (relativePath.startsWith('http')) return relativePath;

    const baseUrl = MediaUtils.getPublicUrl();

    const cleanPath = relativePath.startsWith('/')
      ? relativePath
      : `/${relativePath}`;

    return `${baseUrl}${cleanPath}`;
  }

  private static getBucket(): string {
    return process.env.MINIO_BUCKET || 'smartiv-media';
  }

  static getHlsUrl(mediaId: number): string {
    return (
      this.getFullUrl(`${this.getBucket()}/hls/${mediaId}/master.m3u8`) ?? ''
    );
  }

  static getThumbnailUrl(mediaId: number): string {
    return (
      this.getFullUrl(`${this.getBucket()}/hls/${mediaId}/thumbnail.jpg`) ?? ''
    );
  }

  // [Phase 10 Step 2] GIF Preview URL
  static getPreviewUrl(mediaId: number): string {
    return (
      this.getFullUrl(`${this.getBucket()}/hls/${mediaId}/preview.gif`) ?? ''
    );
  }

  // =================================================================
  // 4. Storage Key Helpers (for Signed URL generation)
  // =================================================================
  static getHlsKey(mediaId: number): string {
    return `hls/${mediaId}/master.m3u8`;
  }

  static getThumbnailKey(mediaId: number): string {
    return `hls/${mediaId}/thumbnail.jpg`;
  }

  static getPreviewKey(mediaId: number): string {
    return `hls/${mediaId}/preview.gif`;
  }
}
