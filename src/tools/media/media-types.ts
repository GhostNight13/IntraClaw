export interface ImageResult {
  url:       string;
  localPath: string;
  prompt:    string;
  model:     string;
  width:     number;
  height:    number;
}

export interface VideoResult {
  url:       string;
  localPath: string;
  prompt:    string;
  model:     string;
}

export interface AudioResult {
  localPath: string;
  text:      string;
  language:  string;
  engine:    'elevenlabs' | 'edge-tts';
}

export type MediaType = 'image' | 'video' | 'audio';
