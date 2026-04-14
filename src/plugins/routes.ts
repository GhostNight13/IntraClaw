import { Router, Request, Response } from 'express';
import { getAllPlugins } from './registry';

export const pluginsRouter = Router();

pluginsRouter.get('/', (_req: Request, res: Response) => {
  try {
    const records = getAllPlugins();
    res.json({
      plugins: records.map(r => ({
        id:          r.plugin.id,
        name:        r.plugin.name,
        version:     r.plugin.version,
        description: r.plugin.description,
        status:      r.status,
        loadedAt:    r.loadedAt,
        error:       r.error,
      })),
      total: records.length,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
