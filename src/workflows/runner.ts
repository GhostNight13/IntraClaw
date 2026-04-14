import { logger } from '../utils/logger';
import { getWorkflow, recordRun } from './store';
import { executeTrigger }     from './executor/trigger-exec';
import { executeAgent }       from './executor/agent-exec';
import { executeHttp }        from './executor/http-exec';
import { executeCondition }   from './executor/condition-exec';
import { executeWait }        from './executor/wait-exec';
import { executeSetVariable } from './executor/set-variable-exec';
import { executeEnd }         from './executor/end-exec';
import type { WorkflowNode, WorkflowRunLog } from './types';

const MAX_STEPS = 50;

type ExecResult = { nextId?: string; variables: Record<string, unknown>; output?: unknown };

async function executeNode(
  node: WorkflowNode,
  variables: Record<string, unknown>,
): Promise<ExecResult> {
  switch (node.type) {
    case 'trigger_cron':
    case 'trigger_webhook':
    case 'trigger_event':
      return executeTrigger(node, variables);

    case 'ai_agent':
      return executeAgent(node, variables);

    case 'http_request':
      return executeHttp(node, variables);

    case 'condition':
      return executeCondition(node, variables);

    case 'wait':
      return executeWait(node, variables);

    case 'set_variable':
      return executeSetVariable(node, variables);

    case 'end':
      return executeEnd(node, variables);

    case 'send_email':
    case 'send_message':
    case 'loop_foreach':
      // Not yet implemented — log and pass through
      logger.info('Runner', `Node type "${node.type}" is a no-op stub — skipping`);
      return { nextId: node.nextId, variables, output: { stub: true, type: node.type } };

    default:
      logger.warn('Runner', `Unknown node type: ${(node as WorkflowNode).type}`);
      return { nextId: node.nextId, variables };
  }
}

export async function runWorkflow(
  workflowId: string,
  triggerVariables: Record<string, unknown> = {},
): Promise<WorkflowRunLog> {
  const workflow = getWorkflow(workflowId);
  if (!workflow) throw new Error(`Workflow not found: ${workflowId}`);

  const startedAt = new Date().toISOString();
  logger.info('Runner', `Starting workflow "${workflow.name}" (${workflowId})`);

  const runLog: WorkflowRunLog = {
    workflowId,
    startedAt,
    status:    'running',
    nodeId:    '',
    variables: { ...triggerVariables },
    logs:      [],
  };

  // Build a lookup map for O(1) node resolution
  const nodeMap = new Map<string, WorkflowNode>(workflow.nodes.map(n => [n.id, n]));

  // Start from the first trigger node, or the first node if none found
  let currentNode: WorkflowNode | undefined =
    workflow.nodes.find(n =>
      n.type === 'trigger_cron' ||
      n.type === 'trigger_webhook' ||
      n.type === 'trigger_event',
    ) ?? workflow.nodes[0];

  let steps = 0;

  try {
    while (currentNode && steps < MAX_STEPS) {
      steps++;
      runLog.nodeId = currentNode.id;

      logger.info('Runner', `  Step ${steps}: ${currentNode.type} [${currentNode.id}] "${currentNode.label}"`);

      const result = await executeNode(currentNode, runLog.variables);

      runLog.logs.push({
        nodeId: currentNode.id,
        ts:     new Date().toISOString(),
        status: 'ok',
        output: result.output,
      });

      runLog.variables = result.variables;

      if (!result.nextId) {
        break;
      }

      const next = nodeMap.get(result.nextId);
      if (!next) {
        logger.warn('Runner', `  nextId "${result.nextId}" not found — stopping`);
        break;
      }

      currentNode = next;
    }

    if (steps >= MAX_STEPS) {
      logger.warn('Runner', `Workflow "${workflow.name}" hit MAX_STEPS limit (${MAX_STEPS}) — possible loop`);
      runLog.error = `Exceeded max steps (${MAX_STEPS})`;
    }

    runLog.status    = 'completed';
    runLog.finishedAt = new Date().toISOString();
    recordRun(workflowId, 'completed', runLog);
    logger.info('Runner', `Workflow "${workflow.name}" completed in ${steps} steps`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    runLog.status    = 'failed';
    runLog.error     = message;
    runLog.finishedAt = new Date().toISOString();

    runLog.logs.push({
      nodeId: runLog.nodeId,
      ts:     new Date().toISOString(),
      status: 'error',
      output: message,
    });

    recordRun(workflowId, 'failed', runLog, message);
    logger.error('Runner', `Workflow "${workflow.name}" failed: ${message}`);
  }

  return runLog;
}
