import { Router, Request, Response } from 'express';
import { listSkills, getSkillBySlug, publishSkill, rateSkill, getMySkills } from './registry';
import { downloadAndInstallSkill } from './installer';
import { validateSkillYaml } from './validator';

export const marketplaceRouter = Router();

// GET /api/marketplace/skills
marketplaceRouter.get('/skills', (req: Request, res: Response) => {
  try {
    const { tags, sort, limit, offset } = req.query as Record<string, string>;
    const skills = listSkills({
      tags,
      sort: sort as 'rating' | 'downloads' | 'newest',
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    res.json({ skills, total: skills.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /api/marketplace/skills/:slug
marketplaceRouter.get('/skills/:slug', (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug);
    const skill = getSkillBySlug(slug);
    if (!skill) { res.status(404).json({ error: 'Skill not found' }); return; }
    res.json({ skill });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /api/marketplace/skills
marketplaceRouter.post('/skills', (req: Request, res: Response) => {
  try {
    const { name, slug, description, version, content, tags } = req.body as Record<string, unknown>;

    if (!name || !slug || !description || !version || !content) {
      res.status(400).json({ error: 'Missing required fields: name, slug, description, version, content' });
      return;
    }

    const validation = validateSkillYaml(content as string);
    if (!validation.valid) {
      res.status(400).json({ error: 'Invalid skill YAML', details: validation.errors });
      return;
    }

    // Use userId from auth or default to anonymous
    const authorId   = (req as Request & { userId?: string }).userId   ?? 'anonymous';
    const authorName = (req as Request & { userName?: string }).userName ?? 'Anonymous';

    const skill = publishSkill(authorId, authorName, {
      name:        name as string,
      slug:        slug as string,
      description: description as string,
      version:     version as string,
      content:     content as string,
      tags:        Array.isArray(tags) ? (tags as string[]) : [],
    });

    res.status(201).json({ skill });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE')) {
      res.status(409).json({ error: 'Slug already exists' });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

// POST /api/marketplace/skills/:slug/rate
marketplaceRouter.post('/skills/:slug/rate', (req: Request, res: Response) => {
  try {
    const skill = getSkillBySlug(String(req.params.slug));
    if (!skill) { res.status(404).json({ error: 'Skill not found' }); return; }

    const { score, comment } = req.body as { score: number; comment?: string };
    if (!score || score < 1 || score > 5) {
      res.status(400).json({ error: 'score must be 1-5' });
      return;
    }

    const userId = (req as Request & { userId?: string }).userId ?? `anon-${req.ip}`;
    rateSkill(skill.id, userId, score, comment);

    res.json({ ok: true, slug: String(req.params.slug) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /api/marketplace/skills/:slug/install
marketplaceRouter.post('/skills/:slug/install', async (req: Request, res: Response) => {
  try {
    const filePath = await downloadAndInstallSkill(String(req.params.slug));
    res.json({ ok: true, installedAt: filePath });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /api/marketplace/my-skills
marketplaceRouter.get('/my-skills', (req: Request, res: Response) => {
  try {
    const authorId = (req as Request & { userId?: string }).userId ?? 'anonymous';
    const skills = getMySkills(authorId);
    res.json({ skills, total: skills.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
