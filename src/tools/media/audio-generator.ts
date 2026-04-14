import * as fs from 'fs';
import { AudioResult } from './media-types';
import { getMediaPath } from './media-store';
import { logger } from '../../utils/logger';

const VOICE_MAP: Record<string, string> = {
  fr: 'fr-FR-DeniseNeural',
  en: 'en-US-JennyNeural',
  nl: 'nl-NL-ColetteNeural',
  es: 'es-ES-ElviraNeural',
  de: 'de-DE-KatjaNeural',
  ar: 'ar-SA-ZariyahNeural',
  pt: 'pt-PT-RaquelNeural',
  it: 'it-IT-ElsaNeural',
  zh: 'zh-CN-XiaoxiaoNeural',
  ja: 'ja-JP-NanamiNeural',
};

export async function textToSpeech(text: string, language = 'fr'): Promise<AudioResult> {
  // ElevenLabs if configured
  if (process.env.ELEVENLABS_API_KEY) {
    logger.info('MediaGen', 'Using ElevenLabs TTS');
    try {
      const voiceId = process.env.ELEVENLABS_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM';
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.8 },
        }),
      });

      if (!response.ok) throw new Error(`ElevenLabs error: ${response.statusText}`);

      const buffer = await response.arrayBuffer();
      const outPath = getMediaPath(`tts-${Date.now()}.mp3`);
      fs.writeFileSync(outPath, Buffer.from(buffer));
      logger.info('MediaGen', `Audio (ElevenLabs) saved: ${outPath}`);
      return { localPath: outPath, text, language, engine: 'elevenlabs' };
    } catch (err) {
      logger.warn('MediaGen', 'ElevenLabs failed, falling back to edge-tts', err);
    }
  }

  // Fallback: edge-tts (Microsoft)
  const { execSync } = await import('child_process');
  const voice = VOICE_MAP[language] ?? VOICE_MAP['en'];
  const outPath = getMediaPath(`tts-${Date.now()}.mp3`);
  const safeText = text.replace(/"/g, '\\"').replace(/\n/g, ' ');

  try {
    execSync(`edge-tts --voice "${voice}" --text "${safeText}" --write-media "${outPath}"`, {
      timeout: 30000,
    });
    logger.info('MediaGen', `Audio (edge-tts) saved: ${outPath}`);
    return { localPath: outPath, text, language, engine: 'edge-tts' };
  } catch {
    throw new Error('edge-tts not available. Install: pip install edge-tts');
  }
}
