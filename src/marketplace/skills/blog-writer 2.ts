/**
 * Generic Skill: Blog Writer
 * Generates an SEO-optimized blog post and saves draft to a user-configured Notion DB.
 */
import { Client } from '@notionhq/client';
import { GenericSkill, SkillContext, SkillResult } from '../types';
import { ask } from '../../ai';
import { logger } from '../../utils/logger';

interface BlogWriterConfig {
  notionDatabaseId?: string;   // user-provided: target Notion DB (must have a Title property)
  titleProperty?:    string;   // default 'Name'
  defaultTone?:      'informative' | 'persuasive' | 'casual';
  language?:         'en' | 'fr' | 'es';
}

interface BlogWriterInput {
  topic:     string;
  keywords?: string[];
  wordCount?: number;
}

export const blogWriter: GenericSkill = {
  id:          'blog-writer',
  name:        'Blog Writer',
  description: 'Generates an SEO-friendly blog post from a topic + keywords and saves it as a Notion draft.',
  icon:        'PenSquare',
  tier:        'pro',
  requires:    ['notion'],

  async execute(ctx: SkillContext, input: Record<string, unknown>): Promise<SkillResult> {
    const cfg = ctx.config as BlogWriterConfig;
    const { topic, keywords = [], wordCount = 800 } = input as unknown as BlogWriterInput;

    if (!topic) return { ok: false, error: 'Missing input: topic' };
    const dbId = cfg.notionDatabaseId;
    if (!dbId) return { ok: false, error: 'Missing config: notionDatabaseId' };

    const apiKey = process.env.NOTION_API_KEY;
    if (!apiKey) return { ok: false, error: 'NOTION_API_KEY not set' };

    try {
      const tone = cfg.defaultTone ?? 'informative';
      const lang = cfg.language    ?? 'en';

      const prompt = [
        `Write an SEO-optimized blog post in ${lang}.`,
        `Topic: ${topic}`,
        keywords.length ? `Target keywords: ${keywords.join(', ')}` : '',
        `Tone: ${tone}. Length: ~${wordCount} words.`,
        `Format: Markdown. Start with an H1 title, then intro, 3-5 H2 sections, and a conclusion.`,
        `Naturally include the keywords without stuffing.`,
      ].filter(Boolean).join('\n');

      const response = await ask({
        messages: [{ role: 'user', content: prompt }],
        modelTier: 'balanced',
        maxTokens: Math.min(4000, wordCount * 4),
      });
      const markdown = response.content.trim();

      // Extract first H1 as title
      const h1 = markdown.match(/^#\s+(.+)$/m);
      const title = h1 ? h1[1].trim() : topic;
      const titleProp = cfg.titleProperty ?? 'Name';

      const notion = new Client({ auth: apiKey });

      // Split markdown into paragraphs, max ~2000 chars per block
      const paragraphs = markdown.split(/\n\n+/).filter(Boolean);
      const children = paragraphs.slice(0, 90).map((p) => ({
        object: 'block' as const,
        type: 'paragraph' as const,
        paragraph: {
          rich_text: [{ type: 'text' as const, text: { content: p.slice(0, 1900) } }],
        },
      }));

      const page = await notion.pages.create({
        parent: { database_id: dbId },
        properties: {
          [titleProp]: { title: [{ text: { content: title.slice(0, 100) } }] },
        },
        children,
      });

      return {
        ok: true,
        message: `Blog draft "${title}" saved to Notion.`,
        data: { pageId: page.id, title, wordCount: markdown.split(/\s+/).length },
      };
    } catch (err) {
      logger.error('Skill:blog-writer', err instanceof Error ? err.message : String(err));
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
