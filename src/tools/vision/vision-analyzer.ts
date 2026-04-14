/**
 * INTRACLAW — Vision Analyzer
 * Multimodal image analysis using Claude's vision capabilities
 */
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import type { VisionMediaType, VisionResult } from './types';
import { logger } from '../../utils/logger';

function getClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function analyzeImage(
  imageBase64: string,
  mediaType: VisionMediaType,
  prompt: string
): Promise<VisionResult> {
  const client = getClient();

  logger.info('Vision', `Analyzing image (${mediaType}), prompt: ${prompt.slice(0, 60)}...`);

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: imageBase64 },
        },
        { type: 'text', text: prompt },
      ],
    }],
  });

  const rawResponse = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('\n');

  // Extract objects mentioned (simple heuristic)
  const objectPattern = /\b(person|people|text|document|chart|table|code|image|logo|icon|button|form|menu)\b/gi;
  const objects = [...new Set((rawResponse.match(objectPattern) || []).map(o => o.toLowerCase()))];

  return {
    description: rawResponse,
    text: extractText(rawResponse),
    objects,
    confidence: 0.9,
    rawResponse,
  };
}

export async function analyzeScreenshot(screenshotPath: string, question: string): Promise<string> {
  const absolutePath = path.resolve(screenshotPath);
  if (!fs.existsSync(absolutePath)) throw new Error(`Screenshot not found: absolutePath`);

  const imageBuffer = fs.readFileSync(absolutePath);
  const imageBase64 = imageBuffer.toString('base64');
  const ext = path.extname(absolutePath).toLowerCase();
  const mediaType: VisionMediaType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';

  const result = await analyzeImage(imageBase64, mediaType, question);
  return result.description;
}

export async function extractTextFromImage(imageBase64: string, mediaType: VisionMediaType = 'image/png'): Promise<string> {
  const result = await analyzeImage(imageBase64, mediaType, 'Extract all text visible in this image. Return only the text content, preserving structure.');
  return result.text || result.description;
}

export async function describeImage(imageBase64: string, mediaType: VisionMediaType = 'image/png'): Promise<string> {
  const result = await analyzeImage(imageBase64, mediaType, 'Describe this image in detail. What do you see?');
  return result.description;
}

function extractText(response: string): string {
  // Extract lines that look like text content (not descriptions)
  const lines = response.split('\n');
  const textLines = lines.filter(line => {
    const l = line.trim();
    return l.length > 0 && !l.startsWith('The image') && !l.startsWith('This image') && !l.startsWith('I can see');
  });
  return textLines.join('\n').trim();
}
