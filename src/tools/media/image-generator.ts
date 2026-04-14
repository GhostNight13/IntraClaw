import { ImageResult } from './media-types';
import { downloadToLocal } from './media-store';
import { logger } from '../../utils/logger';

export async function generateImage(prompt: string, options?: {
  width?: number; height?: number;
}): Promise<ImageResult> {
  const { width = 1024, height = 1024 } = options ?? {};

  if (!process.env.FAL_KEY) {
    throw new Error('FAL_KEY not configured');
  }

  // Dynamic import to avoid startup errors if not installed
  const fal = await import('@fal-ai/serverless-client');
  fal.config({ credentials: process.env.FAL_KEY });

  logger.info('MediaGen', `Generating image: ${prompt.slice(0, 50)}...`);

  const result = await fal.subscribe('fal-ai/flux/schnell', {
    input: {
      prompt,
      image_size: { width, height },
      num_images: 1,
      num_inference_steps: 4,
    },
    logs: false,
  }) as any;

  const imageUrl = result.images[0].url;
  const filename = `image-${Date.now()}.jpg`;
  const localPath = await downloadToLocal(imageUrl, filename);

  logger.info('MediaGen', `Image saved: ${localPath}`);
  return { url: imageUrl, localPath, prompt, model: 'fal-ai/flux/schnell', width, height };
}

export async function generateImageWithFallback(prompt: string, options?: {
  width?: number; height?: number;
}): Promise<ImageResult> {
  try {
    return await generateImage(prompt, options);
  } catch (err) {
    logger.warn('MediaGen', 'fal.ai failed, trying DALL-E fallback', err);

    if (!process.env.OPENAI_API_KEY) throw err;

    const { width = 1024, height = 1024 } = options ?? {};
    const size = `${width}x${height}` as '1024x1024' | '1792x1024' | '1024x1792';

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size }),
    });

    const data = await response.json() as any;
    const imageUrl = data.data[0].url;
    const filename = `image-dalle-${Date.now()}.png`;
    const localPath = await downloadToLocal(imageUrl, filename);

    return { url: imageUrl, localPath, prompt, model: 'dall-e-3', width, height };
  }
}
