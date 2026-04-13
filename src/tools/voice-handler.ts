/**
 * Voice Handler — Traite les commandes vocales et retourne audio + texte
 * Flux : texte transcrit → Claude Haiku → TTS → Buffer audio
 */

import { logger } from '../utils/logger';
import { ask } from '../ai';
import { buildSystemPrompt } from '../memory/core';
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

const JARVIS_SYSTEM = `Tu es IntraClaw, l'assistant IA personnel d'Ayman Idamre.
Tu réponds en voix — sois concis, naturel, direct. Max 2-3 phrases.
Pas de markdown, pas de listes, pas d'emojis. Du texte pur parlé.
Tu es confiant, efficace, légèrement british. Comme JARVIS.
Tu connais l'agence web d'Ayman à Bruxelles et sa plateforme HaiSkills.`;

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function handleVoiceCommand(req: VoiceRequest): Promise<VoiceResponse> {
  const start = Date.now();
  logger.info('Voice', `Received: "${req.transcript.slice(0, 80)}"`);

  try {
    // 1. Claude Haiku — réponse rapide
    const aiResponse = await ask({
      messages: [
        { role: 'system', content: JARVIS_SYSTEM + '\n\n' + buildSystemPrompt() },
        { role: 'user',   content: req.transcript },
      ],
      maxTokens:   150,
      temperature: 0.7,
      task: AgentTask.MORNING_BRIEF, // reuse existing task type
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
