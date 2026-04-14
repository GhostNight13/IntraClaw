/**
 * TTS — Text-to-Speech
 * ElevenLabs (voix premium) avec fallback macOS say (gratuit)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

const AUDIO_DIR = path.resolve(process.cwd(), 'data', 'audio');

function ensureAudioDir(): void {
  if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

// ─── ElevenLabs ───────────────────────────────────────────────────────────────

const ELEVENLABS_API_KEY  = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? 'EXAVITQu4vr4xnSDxMaL'; // Sarah - British

export async function elevenLabsTTS(text: string): Promise<Buffer | null> {
  if (!ELEVENLABS_API_KEY) return null;

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key':   ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          // JARVIS settings: high stability (calm/controlled), high similarity (consistent tone),
          // low style (no expressiveness — cold & precise like JARVIS Iron Man)
          voice_settings: { stability: 0.85, similarity_boost: 0.90, style: 0.0, use_speaker_boost: true },
        }),
      }
    );

    if (!res.ok) {
      logger.warn('TTS', `ElevenLabs error: ${res.status}`);
      return null;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    logger.info('TTS', `ElevenLabs: ${buf.length} bytes`);
    return buf;
  } catch (err) {
    logger.warn('TTS', 'ElevenLabs failed', err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── macOS say (fallback) ─────────────────────────────────────────────────────

export async function macOsSay(text: string, outputPath: string): Promise<boolean> {
  try {
    const voiceId = process.env.MACOS_VOICE_ID ?? 'com.apple.voice.enhanced.fr-FR.Thomas';
    const aiffPath = outputPath.replace(/\.mp3$/, '.aiff');
    const safeText = text.replace(/"/g, '\\"').slice(0, 500);

    // Use say with -o to get audio file, with voice identifier
    await execAsync(`/usr/bin/say --voice="${voiceId}" -o "${aiffPath}" --data-format=aiff "${safeText}"`);

    // Convert aiff → m4a/mp3
    await execAsync(`/usr/bin/afconvert -f mp4f -d aac "${aiffPath}" "${outputPath}" 2>/dev/null || cp "${aiffPath}" "${outputPath}"`);

    try { fs.unlinkSync(aiffPath); } catch { /* ok */ }

    logger.info('TTS', `macOS TTS (Enhanced): ${outputPath}`);
    return true;
  } catch (err) {
    // Fallback to basic say
    try {
      const safeText = text.replace(/"/g, '\\"').slice(0, 500);
      const aiffPath = outputPath.replace(/\.mp3$/, '.aiff');
      await execAsync(`/usr/bin/say -v "Thomas (Enhanced)" -o "${aiffPath}" "${safeText}" 2>/dev/null || /usr/bin/say -v Thomas -o "${aiffPath}" "${safeText}"`);
      await execAsync(`/usr/bin/afconvert -f mp4f -d aac "${aiffPath}" "${outputPath}" 2>/dev/null || cp "${aiffPath}" "${outputPath}"`);
      try { fs.unlinkSync(aiffPath); } catch { /* ok */ }
      return true;
    } catch (err2) {
      logger.warn('TTS', 'macOS TTS failed', err2 instanceof Error ? err2.message : err2);
      return false;
    }
  }
}

// ─── Main synthesize ──────────────────────────────────────────────────────────

export interface TTSResult {
  success: boolean;
  audioBuffer?: Buffer;   // raw mp3 bytes (for streaming)
  filePath?: string;      // saved file path
  provider: 'elevenlabs' | 'macos' | 'none';
  durationEstimate?: number; // ms
}

export async function synthesize(text: string): Promise<TTSResult> {
  ensureAudioDir();
  const filename = `tts-${Date.now()}.mp3`;
  const filePath = path.join(AUDIO_DIR, filename);

  // Try ElevenLabs first
  const elBuf = await elevenLabsTTS(text);
  if (elBuf) {
    fs.writeFileSync(filePath, elBuf);
    return {
      success: true,
      audioBuffer: elBuf,
      filePath,
      provider: 'elevenlabs',
      durationEstimate: Math.round((text.length / 15) * 1000), // ~15 chars/s
    };
  }

  // Fallback: macOS say
  const ok = await macOsSay(text, filePath);
  if (ok && fs.existsSync(filePath)) {
    const buf = fs.readFileSync(filePath);
    return {
      success: true,
      audioBuffer: buf,
      filePath,
      provider: 'macos',
      durationEstimate: Math.round((text.length / 12) * 1000),
    };
  }

  return { success: false, provider: 'none' };
}

// ─── Speak directly on Mac (no file, instant) ────────────────────────────────

export async function speakNow(text: string): Promise<void> {
  try {
    const voiceId = process.env.MACOS_VOICE_ID ?? 'com.apple.voice.enhanced.fr-FR.Thomas';
    const safeText = text.replace(/"/g, '\\"').slice(0, 300);
    await execAsync(`/usr/bin/say --voice="${voiceId}" "${safeText}" 2>/dev/null || /usr/bin/say -v "Thomas (Enhanced)" "${safeText}"`);
  } catch { /* non-blocking */ }
}
