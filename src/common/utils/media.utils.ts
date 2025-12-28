import Ffmpeg from 'fluent-ffmpeg';

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
