// src/graph/task-graph.ts
//
// Universal task graph — models the linear universal-executor flow as a
// checkpointable StateGraph. Nodes: perceive → plan → execute_step (loops)
// → reflect → summarize → learn.
//
// Every node saves a checkpoint (via the engine), so a crash mid-execution
// lets us resume from the latest node without re-running earlier work.

import { ask } from '../ai';
import { buildSystemPrompt } from '../memory/core';
import { AgentTask } from '../types';
import type { ModelTier } from '../types';
import { logger } from '../utils/logger';

import { loadAllSkills, findSkillByTrigger } from '../skills/skill-loader';
import { executeSkill } from '../skills/skill-executor';
import { getMCPTools, callMCPTool } from '../mcp/mcp-client';
import { getTools, executeTool } from '../tools/auto-registry';
import { execCommand, readFile, writeFile } from '../tools/terminal-exec';
import { navigateAndExtract } from '../tools/browser-control';
import { delegateTasks } from '../agents/sub-agent';

import { determineModelTier } from '../routing/smart-router';
import { evaluateAmbiguity } from '../executor/ambiguity-gate';
import { evaluateStep } from '../executor/evaluation-gate';
import { wonderReflectCycle } from '../executor/wonder-reflect';
import { skillLibrary, type SkillMatch } from '../evolution/skill-library';
import { createSkillFromTask } from '../evolution/skill-creator';

import { StateGraph, END, type CompiledGraph } from './state-graph';

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface PlannedStep {
  description: string;
  tool:
    | 'terminal' | 'browser' | 'file_write' | 'file_read'
    | 'ai_generate' | 'sub_agents' | 'mcp_tool' | 'skill' | 'builtin_tool';
  command?: string;
  url?: string;
  filePath?: string;
  content?: string;
  skillId?: string;
  mcpTool?: string;
  mcpArgs?: Record<string, unknown>;
  builtinTool?: string;
  builtinParams?: Record<string, unknown>;
}

export interface ExecutionStep {
  stepNumber: number;
  description: string;
  tool: string;
  success: boolean;
  output: string;
  durationMs: number;
}

export type TaskStatus = 'running' | 'completed' | 'failed' | 'paused';

export interface TaskState {
  request: string;
  clarifiedRequest: string;
  threadId: string;
  modelTier: ModelTier;
  relevantSkills: SkillMatch[];
  plan: PlannedStep[];
  currentStepIdx: number;
  stepResults: ExecutionStep[];
  finalOutput: string;
  status: TaskStatus;
  error?: string;
  iteration: number;
  startedAt: string;
  completedAt?: string;
}

// ─── Node names (exported for introspection/UI) ──────────────────────────────

export const NODE = {
  PERCEIVE: 'perceive',
  PLAN: 'plan',
  EXECUTE_STEP: 'execute_step',
  REFLECT: 'reflect',
  SUMMARIZE: 'summarize',
  LEARN: 'learn',
} as const;

// ─── Initial state factory ───────────────────────────────────────────────────

export function createInitialTaskState(request: string, threadId: string): TaskState {
  return {
    request,
    clarifiedRequest: request,
    threadId,
    modelTier: 'balanced',
    relevantSkills: [],
    plan: [],
    currentStepIdx: 0,
    stepResults: [],
    finalOutput: '',
    status: 'running',
    iteration: 0,
    startedAt: new Date().toISOString(),
  };
}

// ─── Nodes ───────────────────────────────────────────────────────────────────

const STEP_TIMEOUT = 120_000;
const MAX_STEPS = 30;

async function perceiveNode(state: TaskState): Promise<Partial<TaskState>> {
  const ambiguity = await evaluateAmbiguity(state.request);
  if (!ambiguity.canProceed) {
    return {
      status: 'failed',
      error: `Demande trop floue (score: ${ambiguity.score.toFixed(2)})`,
      finalOutput: `❓ J'ai besoin de précisions :\n${ambiguity.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
    };
  }

  const clarifiedRequest = ambiguity.clarifiedRequest ?? state.request;
  const modelTier = determineModelTier(clarifiedRequest);

  let relevantSkills: SkillMatch[] = [];
  try {
    relevantSkills = await skillLibrary.findRelevant(clarifiedRequest, 5);
  } catch (err) {
    logger.warn('TaskGraph', 'skill retrieval failed', err instanceof Error ? err.message : err);
  }

  return { clarifiedRequest, modelTier, relevantSkills };
}

async function planNode(state: TaskState): Promise<Partial<TaskState>> {
  if (state.status === 'failed') return {};

  const plan = await planTask(state.clarifiedRequest, state.modelTier, state.relevantSkills);
  if (!plan || plan.length === 0) {
    return { status: 'failed', error: 'Failed to decompose task into executable steps' };
  }
  return { plan };
}

async function executeStepNode(state: TaskState): Promise<Partial<TaskState>> {
  if (state.status === 'failed') return {};
  if (state.currentStepIdx >= state.plan.length || state.currentStepIdx >= MAX_STEPS) {
    return {};
  }

  const idx = state.currentStepIdx;
  const step = state.plan[idx];
  logger.info('TaskGraph', `Step ${idx + 1}/${state.plan.length}: ${step.description}`);

  const result = await runSingleStep(step, idx + 1, state.stepResults);

  if (result.success) {
    const evalResult = await evaluateStep({
      originalRequest: state.request,
      stepDescription: step.description,
      stepOutput: result.output,
      tool: step.tool,
      filePath: step.filePath,
      isFinalStep: idx === state.plan.length - 1,
    });
    if (!evalResult.passed) {
      result.success = false;
      result.output += `\n\n⚠️ Evaluation failed (stage ${evalResult.stage}): ${evalResult.feedback}`;
    }
  }

  return {
    // reducer='concat' → will be appended
    stepResults: [result],
    currentStepIdx: idx + 1,
    iteration: state.iteration + 1,
  };
}

async function reflectNode(state: TaskState): Promise<Partial<TaskState>> {
  if (state.status === 'failed') return {};
  try {
    await wonderReflectCycle({
      taskRequest: state.request,
      stepsResults: state.stepResults,
    });
  } catch (err) {
    logger.warn('TaskGraph', 'reflect failed (non-fatal)', err instanceof Error ? err.message : err);
  }
  return {};
}

async function summarizeNode(state: TaskState): Promise<Partial<TaskState>> {
  if (state.status === 'failed') return {};
  const finalOutput = await summarizeResults(state.request, state.stepResults);

  const overallSuccess = state.stepResults.some(s => s.success)
    && state.stepResults.filter(s => !s.success).length <= Math.floor(state.stepResults.length / 2);

  return {
    finalOutput,
    status: overallSuccess ? 'completed' : 'failed',
    completedAt: new Date().toISOString(),
  };
}

async function learnNode(state: TaskState): Promise<Partial<TaskState>> {
  if (state.status !== 'completed') return {};

  // Record usage for retrieved skills
  for (const s of state.relevantSkills) {
    try { skillLibrary.recordUsage(s.name, true); } catch { /* ignore */ }
  }

  // Maybe learn a new skill
  try {
    const planDigest = state.plan
      .map((p, i) => `${i + 1}. [${p.tool}] ${p.description}`)
      .join('\n');
    const learnResult = await createSkillFromTask(
      state.request,
      planDigest,
      {
        status: 'completed',
        finalOutput: state.finalOutput,
        steps: state.stepResults.map(s => ({ ...s })),
      },
    );
    if (learnResult.created && learnResult.skill) {
      logger.info('TaskGraph', `Learned skill: ${learnResult.skill.name} (v${learnResult.skill.version})`);
    }
  } catch (err) {
    logger.warn('TaskGraph', 'learn failed (non-fatal)', err instanceof Error ? err.message : err);
  }
  return {};
}

// ─── Graph builder ───────────────────────────────────────────────────────────

export function buildTaskGraph(): CompiledGraph<TaskState> {
  const graph = new StateGraph<TaskState>({
    // reducers: arrays of step results concat; everything else overwrites
    stepResults: 'concat',
    relevantSkills: 'overwrite',
    plan: 'overwrite',
  })
    .addNode(NODE.PERCEIVE, perceiveNode)
    .addNode(NODE.PLAN, planNode)
    .addNode(NODE.EXECUTE_STEP, executeStepNode)
    .addNode(NODE.REFLECT, reflectNode)
    .addNode(NODE.SUMMARIZE, summarizeNode)
    .addNode(NODE.LEARN, learnNode)
    .setEntry(NODE.PERCEIVE)
    .addEdge(NODE.PERCEIVE, NODE.PLAN)
    .addConditionalEdge(NODE.PLAN, (s) => (s.status === 'failed' ? NODE.SUMMARIZE : NODE.EXECUTE_STEP))
    .addConditionalEdge(NODE.EXECUTE_STEP, (s) => {
      if (s.status === 'failed') return NODE.SUMMARIZE;
      if (s.currentStepIdx < s.plan.length && s.currentStepIdx < MAX_STEPS) return NODE.EXECUTE_STEP;
      return NODE.REFLECT;
    })
    .addEdge(NODE.REFLECT, NODE.SUMMARIZE)
    .addEdge(NODE.SUMMARIZE, NODE.LEARN)
    .addEdge(NODE.LEARN, END);

  return graph.compile();
}

// ─── Helpers (adapted from universal-executor) ───────────────────────────────

async function planTask(
  request: string,
  smartTier: ModelTier,
  learnedSkills: SkillMatch[],
): Promise<PlannedStep[]> {
  const availableTools = [
    'terminal — Execute shell commands (npm, git, mkdir, curl, python, etc.)',
    'browser — Navigate web, extract content, fill forms, take screenshots',
    'file_write — Create/edit files with content',
    'file_read — Read file contents',
    'ai_generate — Use AI to generate text, code, analysis, documents',
    'sub_agents — Delegate parallel sub-tasks',
    'mcp_tool — Call external MCP tools',
    'skill — Use a specialized skill',
    'builtin_tool — Use a self-registered builtin tool',
  ];
  const skills = loadAllSkills();
  const mcpTools = getMCPTools();
  const builtinTools = getTools();

  const learnedBlock = learnedSkills.length > 0
    ? `\n\nLEARNED SKILLS YOU CAN REUSE:\n${learnedSkills
        .map(s => `- ${s.name} (v${s.version}, ${(s.similarity * 100).toFixed(0)}% match): ${s.description}`)
        .join('\n')}`
    : '';

  const prompt = `Tu es IntraClaw. Planifie cette tâche en étapes JSON :

DEMANDE : "${request}"${learnedBlock}

OUTILS :
${availableTools.map(t => `- ${t}`).join('\n')}

OUTILS BUILTIN :
${builtinTools.map(t => `- ${t.name}: ${t.description}`).join('\n') || 'Aucun'}

SKILLS :
${skills.map(s => `- ${s.id}: ${s.description}`).join('\n') || 'Aucun'}

MCP :
${mcpTools.map(t => `- ${t.name}: ${t.description}`).join('\n') || 'Aucun'}

Réponds en JSON UNIQUEMENT (tableau) :
[{"description": "...", "tool": "terminal", "command": "..."}]`;

  const planTier: ModelTier = smartTier === 'fast' ? 'balanced' : smartTier;
  const response = await ask({
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: prompt },
    ],
    maxTokens: 4000,
    temperature: 0.3,
    task: AgentTask.MORNING_BRIEF,
    modelTier: planTier,
  });

  try {
    const match = response.content.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]) as PlannedStep[];
  } catch {
    logger.error('TaskGraph', 'Failed to parse plan JSON');
    return [];
  }
}

async function runSingleStep(
  step: PlannedStep,
  stepNum: number,
  prevSteps: ExecutionStep[],
): Promise<ExecutionStep> {
  const startMs = Date.now();
  const makeResult = (success: boolean, output: string): ExecutionStep => ({
    stepNumber: stepNum,
    description: step.description,
    tool: step.tool,
    success,
    output: output.slice(0, 5000),
    durationMs: Date.now() - startMs,
  });

  try {
    switch (step.tool) {
      case 'terminal': {
        if (!step.command) throw new Error('No command provided');
        const result = execCommand(step.command, { timeout: STEP_TIMEOUT });
        if (result.blocked) throw new Error('Command blocked for safety');
        return makeResult(result.success, result.success ? result.stdout : `ERROR: ${result.stderr}`);
      }
      case 'browser': {
        if (!step.url) throw new Error('No URL provided');
        const page = await navigateAndExtract(step.url);
        return makeResult(true, `Title: ${page.title}\n\n${page.text.slice(0, 4000)}`);
      }
      case 'file_write': {
        if (!step.filePath) throw new Error('No filePath provided');
        let content = step.content ?? '';
        if (content.includes('PLACEHOLDER') || (content.startsWith('[') && content.includes('gener'))) {
          const aiStep = [...prevSteps].reverse().find(s => s.tool === 'ai_generate' && s.success);
          if (aiStep) content = aiStep.output;
        }
        const result = await writeFile(step.filePath, content);
        return makeResult(result.success, result.success ? `Written: ${step.filePath}` : 'Write failed');
      }
      case 'file_read': {
        if (!step.filePath) throw new Error('No filePath provided');
        const result = await readFile(step.filePath);
        return makeResult(result.success, result.content);
      }
      case 'ai_generate': {
        const genPrompt = step.content ?? step.description;
        const response = await ask({
          messages: [
            { role: 'system', content: 'Tu es un expert. Réponds avec le contenu demandé uniquement.' },
            { role: 'user', content: genPrompt },
          ],
          maxTokens: 4000,
          temperature: 0.5,
          task: AgentTask.MORNING_BRIEF,
          modelTier: 'balanced' as ModelTier,
        });
        return makeResult(true, response.content);
      }
      case 'sub_agents': {
        const taskLines = (step.content ?? '').split('\n').filter(Boolean);
        const tasks = taskLines.map((t, i) => ({
          id: `sub-${i}`,
          name: t.trim(),
          prompt: t.trim(),
          modelTier: 'fast' as ModelTier,
        }));
        const results = await delegateTasks(tasks);
        const output = results.map(r => `${r.success ? 'OK' : 'FAIL'} ${r.taskName}: ${r.content.slice(0, 500)}`).join('\n');
        return makeResult(results.some(r => r.success), output);
      }
      case 'mcp_tool': {
        if (!step.mcpTool) throw new Error('No MCP tool specified');
        const result = await callMCPTool(step.mcpTool, step.mcpArgs ?? {});
        return makeResult(result.success, result.content);
      }
      case 'skill': {
        const skills = loadAllSkills();
        const skill = skills.find(s => s.id === step.skillId) ?? findSkillByTrigger(step.description, skills);
        if (!skill) throw new Error(`Skill not found: ${step.skillId ?? step.description}`);
        const result = await executeSkill(skill, step.content ?? step.description);
        return makeResult(result.success, result.success ? JSON.stringify(result.data) : (result.error ?? 'Skill failed'));
      }
      case 'builtin_tool': {
        if (!step.builtinTool) throw new Error('No builtinTool name specified');
        const result = await executeTool(step.builtinTool, step.builtinParams ?? {});
        return makeResult(result.success, result.success ? JSON.stringify(result.data, null, 2) : (result.error ?? 'Builtin failed'));
      }
      default:
        throw new Error(`Unknown tool: ${(step as PlannedStep).tool}`);
    }
  } catch (err) {
    return makeResult(false, `Error: ${err instanceof Error ? err.message : 'unknown'}`);
  }
}

async function summarizeResults(request: string, steps: ExecutionStep[]): Promise<string> {
  const successSteps = steps.filter(s => s.success);
  const failedSteps = steps.filter(s => !s.success);
  const response = await ask({
    messages: [
      { role: 'system', content: 'Tu résumes les résultats d\'une tâche en 3-5 lignes max.' },
      {
        role: 'user',
        content: `Tâche: "${request}"\n\nEtapes réussies (${successSteps.length}):\n${successSteps.map(s => `- ${s.description}`).join('\n')}\n\nEtapes échouées (${failedSteps.length}):\n${failedSteps.map(s => `- ${s.description}: ${s.output.slice(0, 200)}`).join('\n') || 'aucune'}\n\nRésume.`,
      },
    ],
    maxTokens: 300,
    temperature: 0.3,
    task: AgentTask.MORNING_BRIEF,
    modelTier: 'fast' as ModelTier,
  });
  return response.content;
}
