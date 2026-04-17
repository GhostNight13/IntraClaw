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
import { evaluateAmbiguity } from './ambiguity-gate';
import { evaluateStep } from './evaluation-gate';
import { wonderReflectCycle } from './wonder-reflect';
import { getTools, executeTool, findToolsByKeyword } from '../tools/auto-registry';
import { determineModelTier } from '../routing/smart-router';
import { skillLibrary, type SkillMatch } from '../evolution/skill-library';
import { createSkillFromTask } from '../evolution/skill-creator';
import { requestConfirmation } from '../security/confirmation';

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
  tool: 'terminal' | 'browser' | 'file_write' | 'file_read' | 'ai_generate' | 'sub_agents' | 'mcp_tool' | 'skill' | 'builtin_tool';
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
    // ── Phase 0.5: SMART ROUTING (first — cheapest, pattern-matching only) ────
    const smartTier = determineModelTier(request);
    logger.info('UniversalExecutor', `Smart Router → tier: ${smartTier}`);

    // ── Phase 0.7: QUICK TOOL CHECK — fast-path BEFORE ambiguity LLM call ─────
    // If a builtin tool can handle the raw request, skip ambiguity + skill retrieval
    // entirely. Saves 2-3 LLM calls on simple queries ("cherche X", "calcule Y").
    const quickResultEarly = await tryBuiltinToolDirect(request);
    if (quickResultEarly) {
      progress.status = 'completed';
      progress.completedAt = new Date().toISOString();
      progress.totalSteps = 1;
      progress.currentStep = 1;
      progress.steps.push({
        stepNumber: 1,
        description: `Builtin tool: ${quickResultEarly.toolName}`,
        tool: 'builtin_tool',
        success: quickResultEarly.result.success,
        output: JSON.stringify(quickResultEarly.result.data ?? quickResultEarly.result.error).slice(0, 5000),
        durationMs: quickResultEarly.durationMs,
      });
      // Optional lightweight LLM post-format: when the user asks to summarise,
      // explain, list, or format the results, run a cheap `fast`-tier pass over
      // the raw tool output. Adds ~2-5s but produces a human-readable answer in
      // the user's language. Skipped when the query is a raw lookup.
      const wantsFormat = /\b(résume|resume|explique|liste|list|en\s+\d+\s+(points?|bullets?|lignes?)|bullet|analyse|summary|summar|compare|traduis)\b/i.test(request);
      if (quickResultEarly.result.success && wantsFormat) {
        progress.finalOutput = await formatToolOutput(request, quickResultEarly.toolName, quickResultEarly.result.data);
      } else {
        progress.finalOutput = quickResultEarly.result.success
          ? JSON.stringify(quickResultEarly.result.data, null, 2)
          : `Error: ${quickResultEarly.result.error}`;
      }
      notify();
      return progress;
    }

    // ── Phase 0: AMBIGUITY CHECK — skip for obvious action requests ──────────
    // Heuristic: request long enough + starts with action verb = skip the LLM
    // ambiguity gate (saves ~5-10s).
    const OBVIOUS_ACTION = /^(lis|lire|cherche|recherche|calcule|convertis|traduis|résume|resume|trouve|montre|affiche|explique|crée|cr[ée]+|fais|build|génère|g[ée]n[èe]re|envoie|install|configure|analyse|modifie|refactor|fix|corrige|teste|debug|compare|vérifie|verifie)\b/i;
    let clarifiedRequest = request;
    if (request.length < 30 || !OBVIOUS_ACTION.test(request.trim())) {
      // Ambiguous or short — run the gate
      const ambiguity = await evaluateAmbiguity(request);
      if (!ambiguity.canProceed) {
        progress.status = 'failed';
        progress.error = `Demande trop floue (score: ${ambiguity.score.toFixed(2)}). Questions : ${ambiguity.questions.join(' | ')}`;
        progress.finalOutput = `❓ J'ai besoin de précisions :\n${ambiguity.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;
        notify();
        return progress;
      }
      clarifiedRequest = ambiguity.clarifiedRequest ?? request;
    } else {
      logger.info('UniversalExecutor', 'Ambiguity gate SKIPPED (obvious action request)');
    }

    // ── Phase 0.7bis: QUICK TOOL CHECK on clarified ────────────────────────────
    const quickResult = await tryBuiltinToolDirect(clarifiedRequest);
    if (quickResult) {
      progress.status = 'completed';
      progress.completedAt = new Date().toISOString();
      progress.totalSteps = 1;
      progress.currentStep = 1;
      progress.steps.push({
        stepNumber: 1,
        description: `Builtin tool: ${quickResult.toolName}`,
        tool: 'builtin_tool',
        success: quickResult.result.success,
        output: JSON.stringify(quickResult.result.data ?? quickResult.result.error).slice(0, 5000),
        durationMs: quickResult.durationMs,
      });
      const wantsFormat2 = /\b(résume|resume|explique|liste|list|en\s+\d+\s+(points?|bullets?|lignes?)|bullet|analyse|summary|summar|compare|traduis)\b/i.test(request);
      if (quickResult.result.success && wantsFormat2) {
        progress.finalOutput = await formatToolOutput(request, quickResult.toolName, quickResult.result.data);
      } else {
        progress.finalOutput = quickResult.result.success
          ? JSON.stringify(quickResult.result.data, null, 2)
          : `Error: ${quickResult.result.error}`;
      }
      notify();
      return progress;
    }

    // ── Phase 0.8: LEARNED SKILLS — skip entirely if DB is empty ──────────────
    let relevantSkills: SkillMatch[] = [];
    try {
      // Cheap SQL count before expensive embedding call
      const count = skillLibrary.countSkills();
      if (count > 0) {
        relevantSkills = await skillLibrary.findRelevant(clarifiedRequest, 5);
        if (relevantSkills.length > 0) {
          logger.info(
            'UniversalExecutor',
            `Retrieved ${relevantSkills.length} learned skills: ${relevantSkills.map(s => `${s.name}(${s.similarity.toFixed(2)})`).join(', ')}`,
          );
        }
      } else {
        logger.info('UniversalExecutor', 'Skill library empty — skipping retrieval');
      }
    } catch (skillErr) {
      logger.warn('UniversalExecutor', 'learned-skill retrieval failed', skillErr instanceof Error ? skillErr.message : skillErr);
    }

    // ── Phase 1: PLAN ─────────────────────────────────────────────────────────
    logger.info('UniversalExecutor', `Planning task: ${clarifiedRequest.slice(0, 100)}`);
    const plan = await planTask(clarifiedRequest, smartTier, relevantSkills);

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

      if (stepResult.success) {
        const evaluation = await evaluateStep({
          originalRequest: request,
          stepDescription: step.description,
          stepOutput: stepResult.output,
          tool: step.tool,
          filePath: step.filePath,
          isFinalStep: i === plan.length - 1,
        });

        if (!evaluation.passed) {
          stepResult.success = false;
          stepResult.output += `\n\n⚠️ Evaluation failed (stage ${evaluation.stage}): ${evaluation.feedback}`;
        }
      }

      progress.steps.push(stepResult);

      if (!stepResult.success) {
        // Attempt automated recovery — but cap total plan size to prevent
        // runaway loops where each failure injects more steps that also fail.
        const MAX_TOTAL_STEPS = 15;
        if (plan.length >= MAX_TOTAL_STEPS) {
          logger.warn('UniversalExecutor', `Plan already ${plan.length} steps — skipping recovery (cap=${MAX_TOTAL_STEPS})`);
        } else {
          const recovery = await recoverFromError(request, progress.steps, stepResult);
          if (recovery && recovery.length > 0) {
            const room = MAX_TOTAL_STEPS - plan.length;
            const injected = recovery.slice(0, room);
            plan.splice(i + 1, 0, ...injected);
            progress.totalSteps = plan.length;
            logger.info('UniversalExecutor', `Injected ${injected.length}/${recovery.length} recovery steps (cap=${MAX_TOTAL_STEPS})`);
          } else {
            logger.warn('UniversalExecutor', `Step ${i + 1} failed, no recovery — continuing`);
          }
        }
      }

      // Bail out early if >50% of steps failed (likely systemic issue, not fixable by more retries)
      if (progress.steps.length >= 6) {
        const failureRate = progress.steps.filter(s => !s.success).length / progress.steps.length;
        if (failureRate > 0.5) {
          logger.warn('UniversalExecutor', `Failure rate ${(failureRate * 100).toFixed(0)}% — bailing out`);
          break;
        }
      }
    }

    // ── Phase 3: SUMMARIZE ────────────────────────────────────────────────────
    progress.status = 'completed';
    progress.completedAt = new Date().toISOString();
    progress.finalOutput = await summarizeResults(request, progress.steps);
    notify();

    // ── Phase 3.5: RECORD USAGE — bump counters on skills we retrieved ───────
    const overallSuccess = progress.steps.some(s => s.success)
      && progress.steps.filter(s => !s.success).length <= Math.floor(progress.steps.length / 2);
    for (const s of relevantSkills) {
      try { skillLibrary.recordUsage(s.name, overallSuccess); } catch { /* ignore */ }
    }

    // ── Phase 4 + 5: WONDER/REFLECT + LEARN — fire-and-forget, don't block reply
    // These cycles can take 10-30s combined and aren't needed for the user response.
    // Run them async so the user gets their answer immediately.
    (async () => {
      try {
        await wonderReflectCycle({ taskRequest: request, stepsResults: progress.steps });
      } catch (wrErr) {
        logger.warn('UniversalExecutor', 'Wonder/Reflect failed (bg)', wrErr instanceof Error ? wrErr.message : wrErr);
      }
      if (overallSuccess) {
        try {
          const planDigest = plan.map((p, i) => `${i + 1}. [${p.tool}] ${p.description}`).join('\n');
          const learnResult = await createSkillFromTask(
            request, planDigest,
            { status: 'completed', finalOutput: progress.finalOutput, steps: progress.steps.map(s => ({ ...s })) },
          );
          if (learnResult.created && learnResult.skill) {
            logger.info('UniversalExecutor', `Learned skill (bg): ${learnResult.skill.name} (v${learnResult.skill.version})`);
          }
        } catch (learnErr) {
          logger.warn('UniversalExecutor', 'Skill-creator failed (bg)', learnErr instanceof Error ? learnErr.message : learnErr);
        }
      }
    })().catch(() => { /* swallow — background only */ });
  } catch (err) {
    progress.status = 'failed';
    progress.error = err instanceof Error ? err.message : 'Unknown error';
    notify();
  }

  logger.info('UniversalExecutor', `Task ${progress.status}: ${request.slice(0, 80)}`);
  return progress;
}

// ─── Quick builtin tool shortcut ─────────────────────────────────────────────

interface QuickToolResult {
  toolName: string;
  result: { success: boolean; data?: unknown; error?: string };
  durationMs: number;
}

/**
 * Attempt to handle a request directly with a builtin tool (no LLM planning).
 * Returns null if no builtin tool matches — the request then goes through normal planning.
 */
async function tryBuiltinToolDirect(request: string): Promise<QuickToolResult | null> {
  const lower = request.toLowerCase().trim();

  // ── Calculator shortcut: "calculate X", "what is 2+2", math expressions ──
  const calcPatterns = [
    /^(?:calculate|compute|eval(?:uate)?)\s+(.+)/i,
    /^(?:what(?:'s| is)\s+)?([\d(][^a-zA-Z]*[\d)])(\s*\??)?$/i,
    /^(?:combien (?:fait|font))\s+(.+)/i,
  ];
  for (const pattern of calcPatterns) {
    const match = lower.match(pattern);
    if (match) {
      const startMs = Date.now();
      const result = await executeTool('calculator', { expression: match[1].replace(/\?$/, '').trim() });
      return { toolName: 'calculator', result, durationMs: Date.now() - startMs };
    }
  }

  // ── DateTime shortcut: "what time is it", "quelle heure" ──
  const timePatterns = [
    /^(?:what(?:'s| is) the (?:current )?(?:time|date|day))/i,
    /^(?:quelle heure|quel jour|what time)/i,
    /^(?:current (?:time|date|datetime))/i,
  ];
  for (const pattern of timePatterns) {
    if (pattern.test(lower)) {
      const startMs = Date.now();
      const result = await executeTool('datetime', { action: 'now' });
      return { toolName: 'datetime', result, durationMs: Date.now() - startMs };
    }
  }

  // ── Web search shortcut: "search for X", "google X", "cherche X" ──
  const searchPatterns = [
    /^(?:search(?:\s+for)?|google|look\s+up|cherche|recherche)\s+(.+)/i,
  ];
  for (const pattern of searchPatterns) {
    const match = lower.match(pattern);
    if (match) {
      const startMs = Date.now();
      const result = await executeTool('web-search', { query: match[1].trim() });
      return { toolName: 'web-search', result, durationMs: Date.now() - startMs };
    }
  }

  return null;
}

// ─── Planning ─────────────────────────────────────────────────────────────────

async function planTask(
  request: string,
  smartTier?: ModelTier,
  learnedSkills: SkillMatch[] = [],
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
    'builtin_tool — Use a self-registered builtin tool (see list below)',
  ];

  const skills = loadAllSkills();
  const mcpTools = getMCPTools();
  const builtinTools = getTools();

  const learnedBlock = learnedSkills.length > 0
    ? `\n\nLEARNED SKILLS YOU CAN REUSE (from past successful runs — prefer these when applicable):\n${learnedSkills
        .map(s => `- ${s.name} (v${s.version}, ${(s.similarity * 100).toFixed(0)}% match, used ${s.usageCount}x, ${Math.round(s.successRate * 100)}% success): ${s.description}`)
        .join('\n')}`
    : '';

  const prompt = `Tu es IntraClaw, un agent IA universel. Tu dois PLANIFIER comment accomplir cette tâche :

DEMANDE : "${request}"${learnedBlock}

OUTILS DISPONIBLES :
${availableTools.map(t => `- ${t}`).join('\n')}

OUTILS BUILTIN (auto-decouverts) :
${builtinTools.map(t => `- ${t.name}: ${t.description} | params: ${Object.entries(t.parameters).map(([k, v]) => { const p = v as { type: string; required?: boolean }; return `${k}(${p.type}${p.required ? ',requis' : ''})`; }).join(', ')}`).join('\n') || 'Aucun'}

SKILLS DISPONIBLES :
${skills.map(s => `- ${s.id}: ${s.description}`).join('\n') || 'Aucun'}

OUTILS MCP :
${mcpTools.map(t => `- ${t.name}: ${t.description}`).join('\n') || 'Aucun'}

REGLES CRITIQUES :
1. Decompose en etapes CONCRETES et EXECUTABLES
2. Chaque etape = 1 action avec 1 outil
3. Pour creer un projet : utilise terminal (mkdir, npm init, etc.) + file_write pour les fichiers
4. Pour du contenu texte : utilise ai_generate
5. Pour de la recherche web : utilise builtin_tool web-search (PAS browser, PAS WebSearch, PAS WebFetch)
6. Pour des calculs : utilise builtin_tool calculator
7. Pour l'heure/les dates : utilise builtin_tool datetime
8. Pour lire un fichier : utilise file_read (PAS Read, PAS cat)
9. Pour executer une commande shell : utilise terminal (PAS Bash, PAS exec)
10. Maximum 10 etapes (pas 30+, sois EFFICACE)
11. Sois CONCRET : donne les vraies commandes, les vrais chemins, le vrai contenu
12. Les chemins absolus commencent par /Users/aymn_idm/Desktop/
13. Pour builtin_tool, specifie builtinTool (nom) et builtinParams (objet JSON)

⚠️ INTERDIT : N'utilise JAMAIS ces noms d'outils qui n'existent pas dans IntraClaw :
Read, Bash, Grep, WebSearch, WebFetch, Write, Edit, Agent, Glob, NotebookEdit.
Utilise UNIQUEMENT les outils listés ci-dessus : terminal, browser, file_write, file_read, ai_generate, sub_agents, mcp_tool, skill, builtin_tool.

Reponds en JSON UNIQUEMENT (un tableau) :
[
  {
    "description": "Creer le dossier du projet",
    "tool": "terminal",
    "command": "mkdir -p /Users/aymn_idm/Desktop/mon-projet"
  },
  {
    "description": "Rechercher sur le web",
    "tool": "builtin_tool",
    "builtinTool": "web-search",
    "builtinParams": {"query": "React best practices 2025"}
  },
  {
    "description": "Ecrire le fichier page.tsx",
    "tool": "file_write",
    "filePath": "/Users/aymn_idm/Desktop/mon-projet/page.tsx",
    "content": "PLACEHOLDER_FROM_PREVIOUS_AI_STEP"
  }
]`;

  // Use smart-routed tier for planning (powerful for complex tasks, balanced otherwise)
  const planTier: ModelTier = smartTier === 'fast' ? 'balanced' : (smartTier ?? 'powerful');

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
    const parsed = JSON.parse(match[0]) as PlannedStep[];
    // Hard cap: truncate any plan >10 steps. LLMs sometimes ignore the
    // prompt limit and return 30–50 steps, which creates runaway executions.
    if (parsed.length > 10) {
      logger.warn('UniversalExecutor', `Plan truncated from ${parsed.length} → 10 steps`);
      return parsed.slice(0, 10);
    }
    return parsed;
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
    // ── Tool name mapping — LLMs sometimes hallucinate Claude Code tool names ──
    const TOOL_ALIASES: Record<string, () => void> = {
      'Bash':       () => { step.tool = 'terminal'; },
      'bash':       () => { step.tool = 'terminal'; },
      'exec':       () => { step.tool = 'terminal'; },
      'shell':      () => { step.tool = 'terminal'; },
      'Read':       () => { step.tool = 'file_read'; },
      'read':       () => { step.tool = 'file_read'; },
      'cat':        () => { step.tool = 'file_read'; },
      'Write':      () => { step.tool = 'file_write'; },
      'write':      () => { step.tool = 'file_write'; },
      'Edit':       () => { step.tool = 'file_write'; },
      'WebSearch':  () => {
        step.tool = 'builtin_tool'; step.builtinTool = 'web-search';
        // LLM may have put query in any of: builtinParams.query, command, url,
        // or the description. Fall through all of them.
        const existingQuery = (step.builtinParams as { query?: string } | undefined)?.query;
        const q = existingQuery || step.command || step.url || step.description || '';
        step.builtinParams = { query: q };
      },
      'web_search': () => {
        step.tool = 'builtin_tool'; step.builtinTool = 'web-search';
        const existingQuery = (step.builtinParams as { query?: string } | undefined)?.query;
        const q = existingQuery || step.command || step.url || step.description || '';
        step.builtinParams = { query: q };
      },
      'WebFetch':   () => { step.tool = 'browser'; },
      'Grep':       () => { step.tool = 'terminal'; step.command = `grep -r "${step.command || ''}" .`; },
      'Glob':       () => { step.tool = 'terminal'; step.command = `ls ${step.command || step.filePath || '.'}`; },
    };
    const alias = TOOL_ALIASES[step.tool];
    if (alias) {
      logger.warn('UniversalExecutor', `Tool alias mapping: "${step.tool}" → remapped`);
      alias();
    }

    switch (step.tool) {
      // ── Terminal ───────────────────────────────────────────────────────────
      case 'terminal': {
        if (!step.command) throw new Error('No command provided');
        // Human-in-the-loop gate — sensible action, must be approved
        const approved = await requestConfirmation(
          'terminal',
          step.description || 'Shell command',
          step.command,
        );
        if (!approved) return makeResult(false, 'Refusé par l\'utilisateur ou timeout (60s)');

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

        // Human-in-the-loop gate
        const approved = await requestConfirmation(
          'file_write',
          step.description || `Écrire ${step.filePath}`,
          `${step.filePath}\n---\n${content.slice(0, 400)}`,
        );
        if (!approved) return makeResult(false, 'Refusé par l\'utilisateur ou timeout (60s)');

        const result = await writeFile(step.filePath, content);
        return makeResult(result.success, result.success ? `Written: ${step.filePath}` : 'Write failed');
      }

      // ── File read ─────────────────────────────────────────────────────────
      case 'file_read': {
        if (!step.filePath) throw new Error('No filePath provided');
        const result = await readFile(step.filePath);
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

      // ── Builtin tool (auto-registry) ──────────────────────────────────────
      case 'builtin_tool': {
        if (!step.builtinTool) throw new Error('No builtinTool name specified');
        const result = await executeTool(step.builtinTool, step.builtinParams ?? {});
        const output = result.success
          ? JSON.stringify(result.data, null, 2)
          : (result.error ?? 'Builtin tool failed');
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

/**
 * Lightweight post-format for fast-path tool outputs. Takes the raw tool
 * data and asks a `fast`-tier LLM to shape it into a human-readable answer
 * that respects the user's original intent (résume, liste, explique, etc.).
 * Budget: ~2-5s. Falls back to raw JSON on error.
 */
async function formatToolOutput(
  userRequest: string,
  toolName: string,
  toolData: unknown,
): Promise<string> {
  const raw = JSON.stringify(toolData, null, 2).slice(0, 4000);
  const prompt = `L'utilisateur a demandé : "${userRequest}"

L'outil "${toolName}" a retourné ces données brutes :

${raw}

Reformule la réponse en français dans le format demandé par l'utilisateur (résumé, liste à puces, explication, comparaison, etc.). Sois concis et direct. Pas d'intro du type "Voici...". Pas de JSON brut. Utilise les données telles quelles, n'invente rien.`;

  try {
    const response = await ask({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 600,
      temperature: 0.3,
      task: AgentTask.MORNING_BRIEF,
      modelTier: 'fast' as ModelTier,
    });
    return response.content.trim();
  } catch (err) {
    logger.warn('UniversalExecutor', 'formatToolOutput failed — falling back to raw JSON', err instanceof Error ? err.message : err);
    return raw;
  }
}
