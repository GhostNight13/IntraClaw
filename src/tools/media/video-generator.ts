import { VideoResult } from './media-types';
import { downloadToLocal } from './media-store';
import { logger } from '../../utils/logger';

export async function generateVideo(prompt: string): Promise<VideoResult> {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }

  const Replicate = (await import('replicate')).default;
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  logger.info('MediaGen', `Generating video: ${prompt.slice(0, 50)}...`);

  const output = await replicate.run(
    'lucataco/ltx-video:8756c1f9c93f9ba4de2b0aa3e6498ce9d4cc0a50e6db0c46af0e44791706a41f',
    { input: { prompt, num_frames: 48, fps: 8 } }
  ) as string;

  const url = Array.isArray(output) ? output[0] : output;
  const filename = `video-${Date.now()}.mp4`;
  const localPath = await downloadToLocal(url, filename);

  logger.info('MediaGen', `Video saved: ${localPath}`);
  return { url, localPath, prompt, model: 'ltx-video' };
}
