import Ffmpeg from 'fluent-ffmpeg';

export class MediaUtils {
  // 1. Helper Logic: Cek Audio Stream (Untuk TranscodeProcessor)
  static async hasAudioStream(filePath: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      Ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return reject(err);
        const hasAudio = metadata.streams.some(
          (stream) => stream.codec_type === 'audio',
        );
        resolve(hasAudio);
      });
    });
  }

  // 2. Helper URL: Generate Full URL dari Relative Path
  // Digunakan oleh PlayerService & MediaService
  static getFullUrl(relativePath: string | null): string | null {
    if (!relativePath) return null;
    // Jika sudah full URL (misal dari S3 eksternal), kembalikan langsung
    if (relativePath.startsWith('http')) return relativePath;

    // Ambil Base URL dari ENV, fallback ke default local MinIO bucket
    // .replace(/\/$/, '') gunanya membuang trailing slash jika ada, biar aman saat digabung
    const baseUrl = (
      process.env.MINIO_PUBLIC_URL || 'http://localhost:9000/smartiv-media'
    ).replace(/\/$/, '');

    // Pastikan path diawali slash
    const path = relativePath.startsWith('/')
      ? relativePath
      : `/${relativePath}`;

    return `${baseUrl}${path}`;
  }

  // 3. Helper Spesifik (Optional wrappers)
  static getHlsUrl(mediaId: number): string {
    // [FIX] Gunakan '?? ""' untuk menjamin return string (menghilangkan tipe null)
    return this.getFullUrl(`hls/${mediaId}/master.m3u8`) ?? '';
  }

  static getThumbnailUrl(mediaId: number): string {
    // [FIX] Gunakan '?? ""' untuk menjamin return string
    return this.getFullUrl(`thumbnails/${mediaId}.jpg`) ?? '';
  }
}
