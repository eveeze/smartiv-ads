import Ffmpeg from 'fluent-ffmpeg';

// 1. Helper Logic (Digunakan oleh TranscodeProcessor)
export const MediaUtils = {
  async hasAudioStream(filePath: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      Ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return reject(err);
        const hasAudio = metadata.streams.some(
          (stream) => stream.codec_type === 'audio',
        );
        resolve(hasAudio);
      });
    });
  },
};

// 2. Helper URL (Digunakan oleh MediaService & Processor)
export function getHlsUrl(mediaId: number): string {
  // URL Default jika ENV tidak ada (untuk local development)
  const publicUrl =
    process.env.MINIO_PUBLIC_URL || 'http://localhost:9000/smartiv-ads-public';

  return `${publicUrl}/hls/${mediaId}/master.m3u8`;
}

export function getThumbnailUrl(mediaId: number): string {
  const publicUrl =
    process.env.MINIO_PUBLIC_URL || 'http://localhost:9000/smartiv-ads-public';

  return `${publicUrl}/thumbnails/${mediaId}.jpg`;
}
