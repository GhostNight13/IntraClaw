import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import {
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  getRunLogs,
} from './store';
import { runWorkflow } from './runner';
import { rescheduleWorkflow } from './scheduler';

export const workflowsRouter = Router();

// ─── GET /api/workflows ───────────────────────────────────────────────────────

workflowsRouter.get('/', (_req: Request, res: Response) => {
  try {
    const userId = _req.query['userId'] as string | undefined;
    const workflows = listWorkflows(userId);
    res.json({ workflows });
  } catch (err) {
    logger.error('WorkflowRoutes', 'listWorkflows error', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to list workflows' });
  }
});

// ─── GET /api/workflows/:id ───────────────────────────────────────────────────

workflowsRouter.get('/:id', (req: Request<{ id: string }>, res: Response) => {
  try {
    const workflow = getWorkflow(req.params.id);
    if (!workflow) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }
    res.json(workflow);
  } catch (err) {
    logger.error('WorkflowRoutes', 'getWorkflow error', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to get workflow' });
  }
});

// ─── POST /api/workflows ──────────────────────────────────────────────────────

workflowsRouter.post('/', (req: Request, res: Response) => {
  try {
    const { userId, name, description, nodes, enabled } = req.body as {
      userId?:      string;
      name?:        string;
      description?: string;
      nodes?:       unknown[];
      enabled?:     boolean;
    };

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    if (!Array.isArray(nodes)) {
      res.status(400).json({ error: 'nodes must be an array' });
      return;
    }

    const workflow = createWorkflow({
      userId:      userId ?? 'default',
      name,
      description,
      nodes:       nodes as never,
      enabled:     enabled ?? false,
    });

    rescheduleWorkflow(workflow.id);

    logger.info('WorkflowRoutes', `Created workflow "${workflow.name}" (${workflow.id})`);
    res.status(201).json(workflow);
  } catch (err) {
    logger.error('WorkflowRoutes', 'createWorkflow error', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

// ─── PATCH /api/workflows/:id ─────────────────────────────────────────────────

workflowsRouter.patch('/:id', (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const existing = getWorkflow(id);
    if (!existing) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }

    const updated = updateWorkflow(id, req.body as never);

    rescheduleWorkflow(id);

    logger.info('WorkflowRoutes', `Updated workflow "${updated.name}" (${id})`);
    res.json(updated);
  } catch (err) {
    logger.error('WorkflowRoutes', 'updateWorkflow error', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

// ─── DELETE /api/workflows/:id ────────────────────────────────────────────────

workflowsRouter.delete('/:id', (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const existing = getWorkflow(id);
    if (!existing) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }

    rescheduleWorkflow(id);
    deleteWorkflow(id);

    logger.info('WorkflowRoutes', `Deleted workflow ${id}`);
    res.status(204).send();
  } catch (err) {
    logger.error('WorkflowRoutes', 'deleteWorkflow error', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

// ─── POST /api/workflows/:id/run ─────────────────────────────────────────────

workflowsRouter.post('/:id/run', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const existing = getWorkflow(id);
    if (!existing) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }

    const triggerVars = (req.body?.variables as Record<string, unknown>) ?? {};

    logger.info('WorkflowRoutes', `Manual run triggered for workflow "${existing.name}" (${id})`);
    const runLog = await runWorkflow(id, { triggeredBy: 'manual', ...triggerVars });

    res.json(runLog);
  } catch (err) {
    logger.error('WorkflowRoutes', 'runWorkflow error', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to run workflow' });
  }
});

// ─── GET /api/workflows/:id/runs ─────────────────────────────────────────────

workflowsRouter.get('/:id/runs', (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const existing = getWorkflow(id);
    if (!existing) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }

    const limit = Math.min(Number(req.query['limit'] ?? 20), 100);
    const runs  = getRunLogs(id, limit);

    res.json({ runs });
  } catch (err) {
    logger.error('WorkflowRoutes', 'getRunLogs error', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to get run logs' });
  }
});
