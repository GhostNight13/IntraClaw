import * as fs from 'fs';
import * as path from 'path';

const MEDIA_DIR = path.join(process.cwd(), 'data', 'generated', 'media');

export function ensureMediaDir(): void {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

export async function downloadToLocal(url: string, filename: string): Promise<string> {
  ensureMediaDir();
  const outPath = path.join(MEDIA_DIR, filename);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(outPath, Buffer.from(buffer));
  return outPath;
}

export function getMediaPath(filename: string): string {
  ensureMediaDir();
  return path.join(MEDIA_DIR, filename);
}

export function listMedia(): { name: string; path: string; size: number; created: string }[] {
  ensureMediaDir();
  return fs.readdirSync(MEDIA_DIR)
    .filter(f => !f.startsWith('.'))
    .map(name => {
      const filePath = path.join(MEDIA_DIR, name);
      const stat = fs.statSync(filePath);
      return { name, path: filePath, size: stat.size, created: stat.birthtime.toISOString() };
    })
    .sort((a, b) => b.created.localeCompare(a.created));
}
