/**
 * Voice Handler — Traite les commandes vocales et retourne audio + texte
 * Flux : texte transcrit → Claude Haiku → TTS → Buffer audio
 */

import { logger } from '../utils/logger';
import { ask } from '../ai';
import { buildCompressedPrompt } from '../memory/core';
import { synthesize, TTSResult } from './tts';
import { AgentTask } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VoiceRequest {
  transcript: string;
  sessionId?: string;
}

export interface VoiceResponse {
  success: boolean;
  transcript: string;  // ce que l'user a dit
  reply: string;       // réponse texte
  audio?: Buffer;      // audio mp3
  audioBase64?: string;
  provider: string;
  durationMs: number;
  model: string;
}

// ─── System prompt JARVIS ─────────────────────────────────────────────────────

import { userContextPrompt } from '../config/profile';

const USER_CTX = userContextPrompt();
const JARVIS_SYSTEM = `You are IntraClaw, a personal AI assistant.${USER_CTX ? ' ' + USER_CTX : ''}
You speak exactly like JARVIS from Iron Man (the film). Your tone is:
- Calm, controlled, measured — never excited or emotional
- Slightly formal British English or formal French depending on input language
- Dry wit when appropriate, but always understated
- Maximum 1-2 short sentences. No more.
- Start responses with "Sir," occasionally, as JARVIS does. Not every time.
- Never use markdown, lists, emojis, or filler words.
- Be direct. Be precise. Sound intelligent.
Examples:
User: "What time is it?" → "It's half past nine, Sir. Shall I adjust your schedule?"
User: "Comment ça va?" → "Opérationnel à cent pour cent, comme d'habitude."
User: "What's the weather?" → "Clear skies over Brussels, 14 degrees. A pleasant day, relatively speaking."
Pure spoken text only. No formatting whatsoever.`;

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function handleVoiceCommand(req: VoiceRequest): Promise<VoiceResponse> {
  const start = Date.now();
  logger.info('Voice', `Received: "${req.transcript.slice(0, 80)}"`);

  try {
    // 1. Claude Haiku — réponse rapide
    const aiResponse = await ask({
      messages: [
        { role: 'system', content: JARVIS_SYSTEM + '\n\n' + buildCompressedPrompt() },
        { role: 'user',   content: req.transcript },
      ],
      maxTokens:   150,
      temperature: 0.7,
      task: AgentTask.MORNING_BRIEF,
      modelTier:   'fast',  // Voice responses need speed over depth
    });

    const reply = aiResponse.content.trim();
    logger.info('Voice', `Reply: "${reply.slice(0, 80)}"`);

    // 2. TTS
    const tts: TTSResult = await synthesize(reply);

    const response: VoiceResponse = {
      success:    true,
      transcript: req.transcript,
      reply,
      provider:   tts.provider,
      durationMs: Date.now() - start,
      model:      aiResponse.model,
    };

    if (tts.audioBuffer) {
      response.audio      = tts.audioBuffer;
      response.audioBase64 = tts.audioBuffer.toString('base64');
    }

    logger.info('Voice', `Done in ${response.durationMs}ms — TTS: ${tts.provider}`);
    return response;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('Voice', 'handleVoiceCommand failed', error);
    return {
      success:    false,
      transcript: req.transcript,
      reply:      'Désolé, une erreur est survenue.',
      provider:   'none',
      durationMs: Date.now() - start,
      model:      'none',
    };
  }
}
