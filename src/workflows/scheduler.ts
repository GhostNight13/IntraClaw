import cron, { ScheduledTask } from 'node-cron';
import { logger } from '../utils/logger';
import { listWorkflows } from './store';
import { runWorkflow } from './runner';
import type { WorkflowDefinition } from './types';

// Map of workflowId → scheduled task
const scheduledTasks = new Map<string, ScheduledTask>();

function scheduleWorkflow(workflow: WorkflowDefinition): void {
  // Find the trigger_cron node
  const triggerNode = workflow.nodes.find(n => n.type === 'trigger_cron');
  if (!triggerNode) return;

  const expression = String(triggerNode.config.expression ?? '');
  if (!expression) {
    logger.warn('Scheduler', `Workflow "${workflow.name}" has trigger_cron but no cron expression`);
    return;
  }

  if (!cron.validate(expression)) {
    logger.warn('Scheduler', `Invalid cron expression for workflow "${workflow.name}": "${expression}"`);
    return;
  }

  // Cancel existing task if any
  unscheduleWorkflow(workflow.id);

  const task = cron.schedule(expression, () => {
    logger.info('Scheduler', `Cron firing workflow "${workflow.name}" (${workflow.id})`);
    runWorkflow(workflow.id, { triggeredBy: 'cron', triggeredAt: new Date().toISOString() })
      .catch(err =>
        logger.error('Scheduler', `Workflow "${workflow.name}" cron run failed`, err instanceof Error ? err.message : err),
      );
  });

  scheduledTasks.set(workflow.id, task);
  logger.info('Scheduler', `Scheduled workflow "${workflow.name}" — cron: "${expression}"`);
}

function unscheduleWorkflow(workflowId: string): void {
  const existing = scheduledTasks.get(workflowId);
  if (existing) {
    existing.stop();
    scheduledTasks.delete(workflowId);
  }
}

/**
 * Reschedules a single workflow.
 * Call this after a workflow is created, updated, enabled, or disabled.
 */
export function rescheduleWorkflow(workflowId: string): void {
  const workflows = listWorkflows();
  const workflow  = workflows.find(w => w.id === workflowId);

  if (!workflow || !workflow.enabled) {
    unscheduleWorkflow(workflowId);
    return;
  }

  scheduleWorkflow(workflow);
}

/**
 * Load all enabled workflows with trigger_cron nodes and schedule them.
 * Called once at startup.
 */
export async function initWorkflowScheduler(): Promise<void> {
  logger.info('Scheduler', 'Initializing workflow scheduler...');

  const workflows = listWorkflows();
  let count = 0;

  for (const wf of workflows) {
    if (!wf.enabled) continue;
    const hasCronTrigger = wf.nodes.some(n => n.type === 'trigger_cron');
    if (!hasCronTrigger) continue;

    scheduleWorkflow(wf);
    count++;
  }

  logger.info('Scheduler', `Workflow scheduler ready — ${count} cron workflow(s) scheduled`);
}
