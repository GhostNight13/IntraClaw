/**
 * INTRACLAW — Vision Tool Types
 */

export type VisionMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export interface VisionInput {
  imageBase64: string;
  mediaType: VisionMediaType;
  prompt: string;
}

export interface VisionResult {
  description: string;
  text: string;
  objects: string[];
  confidence: number;
  rawResponse: string;
}
