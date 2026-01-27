import Ffmpeg from 'fluent-ffmpeg';

export class MediaUtils {
  // =================================================================
  // 1. Helper Logic: Cek Audio Stream (Untuk TranscodeProcessor)
  // =================================================================
  static async hasAudioStream(filePath: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      Ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err)
          return reject(err instanceof Error ? err : new Error(String(err)));

        // Best Practice: Optional Chaining & Array Check
        const streams = metadata?.streams || [];
        const hasAudio = streams.some(
          (stream) => stream.codec_type === 'audio',
        );
        resolve(hasAudio);
      });
    });
  }

  // =================================================================
  // 2. Helper URL: Generate Full URL
  // =================================================================
  /**
   * Menggabungkan Domain MinIO dengan Path File
   * @param relativePath Path file (termasuk bucket jika perlu)
   */
  static getFullUrl(relativePath: string | null): string | null {
    if (!relativePath) return null;

    // Jika path sudah berupa URL lengkap (misal dari CDN eksternal), kembalikan langsung
    if (relativePath.startsWith('http')) return relativePath;

    const baseUrl = (
      process.env.MINIO_PUBLIC_URL || 'http://localhost:9000'
    ).replace(/\/$/, '');

    // Pastikan relativePath diawali dengan slash '/'
    const cleanPath = relativePath.startsWith('/')
      ? relativePath
      : `/${relativePath}`;

    return `${baseUrl}${cleanPath}`;
  }

  static getHlsUrl(mediaId: number): string {
    const bucket = process.env.MINIO_BUCKET || 'smartiv-media';

    return this.getFullUrl(`${bucket}/hls/${mediaId}/master.m3u8`) ?? '';
  }

  static getThumbnailUrl(mediaId: number): string {
    const bucket = process.env.MINIO_BUCKET || 'smartiv-media';

    return this.getFullUrl(`${bucket}/hls/${mediaId}/thumbnail.jpg`) ?? '';
  }
}
