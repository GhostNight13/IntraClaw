// src/executor/universal-executor.ts
import { ask } from '../ai';
import { buildSystemPrompt } from '../memory/core';
import { execCommand, readFile, writeFile } from '../tools/terminal-exec';
import { navigateAndExtract } from '../tools/browser-control';
import { delegateTasks } from '../agents/sub-agent';
import { callMCPTool, getMCPTools } from '../mcp/mcp-client';
import { loadAllSkills, findSkillByTrigger } from '../skills/skill-loader';
import { executeSkill } from '../skills/skill-executor';
import { logger } from '../utils/logger';
import { AgentTask } from '../types';
import type { ModelTier } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_STEPS = 30;
const STEP_TIMEOUT = 120_000; // 2 min per step

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskProgress {
  taskId: string;
  request: string;
  status: 'planning' | 'executing' | 'completed' | 'failed';
  currentStep: number;
  totalSteps: number;
  steps: StepResult[];
  startedAt: string;
  completedAt?: string;
  finalOutput?: string;
  error?: string;
}

interface StepResult {
  stepNumber: number;
  description: string;
  tool: string;
  success: boolean;
  output: string;
  durationMs: number;
}

interface PlannedStep {
  description: string;
  tool: 'terminal' | 'browser' | 'file_write' | 'file_read' | 'ai_generate' | 'sub_agents' | 'mcp_tool' | 'skill';
  command?: string;
  url?: string;
  filePath?: string;
  content?: string;
  skillId?: string;
  mcpTool?: string;
  mcpArgs?: Record<string, unknown>;
}

type ProgressCallback = (progress: TaskProgress) => void;

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Execute ANY task given in natural language.
 * Plans via Claude, executes step-by-step, recovers from errors automatically.
 */
export async function executeUniversalTask(
  request: string,
  onProgress?: ProgressCallback,
): Promise<TaskProgress> {
  const taskId = `task-${Date.now()}`;
  const progress: TaskProgress = {
    taskId,
    request,
    status: 'planning',
    currentStep: 0,
    totalSteps: 0,
    steps: [],
    startedAt: new Date().toISOString(),
  };

  const notify = () => onProgress?.(progress);
  notify();

  try {
    // ── Phase 1: PLAN ─────────────────────────────────────────────────────────
    logger.info('UniversalExecutor', `Planning task: ${request.slice(0, 100)}`);
    const plan = await planTask(request);

    if (!plan || plan.length === 0) {
      progress.status = 'failed';
      progress.error = 'Failed to decompose task into executable steps';
      notify();
      return progress;
    }

    progress.totalSteps = plan.length;
    progress.status = 'executing';
    notify();

    // ── Phase 2: EXECUTE ──────────────────────────────────────────────────────
    for (let i = 0; i < plan.length && i < MAX_STEPS; i++) {
      const step = plan[i];
      progress.currentStep = i + 1;
      logger.info('UniversalExecutor', `Step ${i + 1}/${plan.length}: ${step.description}`);
      notify();

      const stepResult = await executeStep(step, i + 1, progress);
      progress.steps.push(stepResult);

      if (!stepResult.success) {
        // Attempt automated recovery
        const recovery = await recoverFromError(request, progress.steps, stepResult);
        if (recovery && recovery.length > 0) {
          plan.splice(i + 1, 0, ...recovery);
          progress.totalSteps = plan.length;
          logger.info('UniversalExecutor', `Injected ${recovery.length} recovery steps`);
        } else {
          logger.warn('UniversalExecutor', `Step ${i + 1} failed, no recovery — continuing`);
        }
      }
    }

    // ── Phase 3: SUMMARIZE ────────────────────────────────────────────────────
    progress.status = 'completed';
    progress.completedAt = new Date().toISOString();
    progress.finalOutput = await summarizeResults(request, progress.steps);
    notify();
  } catch (err) {
    progress.status = 'failed';
    progress.error = err instanceof Error ? err.message : 'Unknown error';
    notify();
  }

  logger.info('UniversalExecutor', `Task ${progress.status}: ${request.slice(0, 80)}`);
  return progress;
}

// ─── Planning ─────────────────────────────────────────────────────────────────

async function planTask(request: string): Promise<PlannedStep[]> {
  const availableTools = [
    'terminal — Execute shell commands (npm, git, mkdir, curl, python, etc.)',
    'browser — Navigate web, extract content, fill forms, take screenshots',
    'file_write — Create/edit files with content',
    'file_read — Read file contents',
    'ai_generate — Use AI to generate text, code, analysis, documents',
    'sub_agents — Delegate parallel sub-tasks',
    'mcp_tool — Call external MCP tools',
    'skill — Use a specialized skill',
  ];

  const skills = loadAllSkills();
  const mcpTools = getMCPTools();

  const prompt = `Tu es IntraClaw, un agent IA universel. Tu dois PLANIFIER comment accomplir cette tâche :

DEMANDE : "${request}"

OUTILS DISPONIBLES :
${availableTools.map(t => `- ${t}`).join('\n')}

SKILLS DISPONIBLES :
${skills.map(s => `- ${s.id}: ${s.description}`).join('\n') || 'Aucun'}

OUTILS MCP :
${mcpTools.map(t => `- ${t.name}: ${t.description}`).join('\n') || 'Aucun'}

REGLES :
1. Decompose en etapes CONCRETES et EXECUTABLES
2. Chaque etape = 1 action avec 1 outil
3. Pour creer un projet : utilise terminal (mkdir, npm init, etc.) + file_write pour les fichiers
4. Pour du contenu texte : utilise ai_generate
5. Pour de la recherche web : utilise browser
6. Maximum 20 etapes
7. Sois CONCRET : donne les vraies commandes, les vrais chemins, le vrai contenu
8. Les chemins absolus commencent par /Users/aymn_idm/Desktop/

Reponds en JSON UNIQUEMENT (un tableau) :
[
  {
    "description": "Creer le dossier du projet",
    "tool": "terminal",
    "command": "mkdir -p /Users/aymn_idm/Desktop/mon-projet"
  },
  {
    "description": "Generer le contenu de la page",
    "tool": "ai_generate",
    "content": "Genere le code React/TypeScript pour une landing page"
  },
  {
    "description": "Ecrire le fichier page.tsx",
    "tool": "file_write",
    "filePath": "/Users/aymn_idm/Desktop/mon-projet/page.tsx",
    "content": "PLACEHOLDER_FROM_PREVIOUS_AI_STEP"
  }
]`;

  const response = await ask({
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: prompt },
    ],
    maxTokens: 4000,
    temperature: 0.3,
    task: AgentTask.MORNING_BRIEF,
    modelTier: 'powerful' as ModelTier,
  });

  try {
    const match = response.content.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]) as PlannedStep[];
  } catch {
    logger.error('UniversalExecutor', 'Failed to parse plan JSON');
    return [];
  }
}

// ─── Step execution ───────────────────────────────────────────────────────────

async function executeStep(
  step: PlannedStep,
  stepNum: number,
  progress: TaskProgress,
): Promise<StepResult> {
  const startMs = Date.now();
  const makeResult = (success: boolean, output: string): StepResult => ({
    stepNumber: stepNum,
    description: step.description,
    tool: step.tool,
    success,
    output: output.slice(0, 5000),
    durationMs: Date.now() - startMs,
  });

  try {
    switch (step.tool) {
      // ── Terminal ───────────────────────────────────────────────────────────
      case 'terminal': {
        if (!step.command) throw new Error('No command provided');
        const result = execCommand(step.command, { timeout: STEP_TIMEOUT });
        if (result.blocked) throw new Error('Command blocked for safety');
        const output = result.success ? result.stdout : `ERROR: ${result.stderr}`;
        return makeResult(result.success, output);
      }

      // ── Browser ───────────────────────────────────────────────────────────
      case 'browser': {
        if (!step.url) throw new Error('No URL provided');
        const page = await navigateAndExtract(step.url);
        return makeResult(true, `Title: ${page.title}\n\n${page.text.slice(0, 4000)}`);
      }

      // ── File write ────────────────────────────────────────────────────────
      case 'file_write': {
        if (!step.filePath) throw new Error('No filePath provided');
        let content = step.content ?? '';

        // Resolve placeholder from most recent ai_generate output
        if (content.includes('PLACEHOLDER') || (content.startsWith('[') && content.includes('gener'))) {
          const aiStep = [...progress.steps].reverse().find(s => s.tool === 'ai_generate' && s.success);
          if (aiStep) content = aiStep.output;
        }

        const result = writeFile(step.filePath, content);
        return makeResult(result.success, result.success ? `Written: ${step.filePath}` : 'Write failed');
      }

      // ── File read ─────────────────────────────────────────────────────────
      case 'file_read': {
        if (!step.filePath) throw new Error('No filePath provided');
        const result = readFile(step.filePath);
        return makeResult(result.success, result.content);
      }

      // ── AI generate ───────────────────────────────────────────────────────
      case 'ai_generate': {
        const genPrompt = step.content ?? step.description;
        const response = await ask({
          messages: [
            { role: 'system', content: 'Tu es un expert qui genere du contenu de haute qualite. Reponds avec le contenu demande uniquement, sans explication.' },
            { role: 'user', content: genPrompt },
          ],
          maxTokens: 4000,
          temperature: 0.5,
          task: AgentTask.MORNING_BRIEF,
          modelTier: 'balanced' as ModelTier,
        });
        return makeResult(true, response.content);
      }

      // ── Sub-agents ────────────────────────────────────────────────────────
      case 'sub_agents': {
        const taskLines = (step.content ?? '').split('\n').filter(Boolean);
        const tasks = taskLines.map((t, i) => ({
          id: `sub-${i}`,
          name: t.trim(),
          prompt: t.trim(),
          modelTier: 'fast' as ModelTier,
        }));
        const results = await delegateTasks(tasks);
        const output = results.map(r =>
          `${r.success ? 'OK' : 'FAIL'} ${r.taskName}: ${r.content.slice(0, 500)}`,
        ).join('\n');
        return makeResult(results.some(r => r.success), output);
      }

      // ── MCP tool ──────────────────────────────────────────────────────────
      case 'mcp_tool': {
        if (!step.mcpTool) throw new Error('No MCP tool specified');
        const result = await callMCPTool(step.mcpTool, step.mcpArgs ?? {});
        return makeResult(result.success, result.content);
      }

      // ── Skill ─────────────────────────────────────────────────────────────
      case 'skill': {
        const skills = loadAllSkills();
        const skill = skills.find(s => s.id === step.skillId)
          ?? findSkillByTrigger(step.description, skills);
        if (!skill) throw new Error(`Skill not found: ${step.skillId ?? step.description}`);
        const result = await executeSkill(skill, step.content ?? step.description);
        const output = result.success
          ? JSON.stringify(result.data)
          : (result.error ?? 'Skill execution failed');
        return makeResult(result.success, output);
      }

      default:
        throw new Error(`Unknown tool: ${step.tool}`);
    }
  } catch (err) {
    return makeResult(false, `Error: ${err instanceof Error ? err.message : 'unknown'}`);
  }
}

// ─── Error recovery ───────────────────────────────────────────────────────────

async function recoverFromError(
  originalRequest: string,
  completedSteps: StepResult[],
  failedStep: StepResult,
): Promise<PlannedStep[] | null> {
  try {
    const response = await ask({
      messages: [
        {
          role: 'system',
          content: 'Tu es un agent de recuperation d\'erreur. Propose 1-3 etapes correctives en JSON array ou reponds "null" si irrecuperable.',
        },
        {
          role: 'user',
          content: `Tache originale: "${originalRequest}"
Etape echouee: ${failedStep.description}
Erreur: ${failedStep.output}
Etapes deja completes: ${completedSteps.filter(s => s.success).map(s => s.description).join(', ') || 'aucune'}

Propose des etapes correctives en JSON :
[{"description": "...", "tool": "terminal", "command": "..."}]`,
        },
      ],
      maxTokens: 1000,
      temperature: 0.3,
      task: AgentTask.MORNING_BRIEF,
      modelTier: 'fast' as ModelTier,
    });

    if (response.content.includes('null')) return null;
    const match = response.content.match(/\[[\s\S]*\]/);
    if (!match) return null;
    return JSON.parse(match[0]) as PlannedStep[];
  } catch {
    return null;
  }
}

// ─── Summarization ────────────────────────────────────────────────────────────

async function summarizeResults(request: string, steps: StepResult[]): Promise<string> {
  const successSteps = steps.filter(s => s.success);
  const failedSteps = steps.filter(s => !s.success);

  const response = await ask({
    messages: [
      { role: 'system', content: 'Tu resumes les resultats d\'une tache de maniere concise (3-5 lignes max).' },
      {
        role: 'user',
        content: `Tache: "${request}"

Etapes reussies (${successSteps.length}):
${successSteps.map(s => `- ${s.description}`).join('\n')}

Etapes echouees (${failedSteps.length}):
${failedSteps.map(s => `- ${s.description}: ${s.output.slice(0, 200)}`).join('\n') || 'aucune'}

Resume le resultat.`,
      },
    ],
    maxTokens: 300,
    temperature: 0.3,
    task: AgentTask.MORNING_BRIEF,
    modelTier: 'fast' as ModelTier,
  });

  return response.content;
}
