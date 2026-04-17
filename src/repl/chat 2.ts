#!/usr/bin/env ts-node
// src/repl/chat.ts
// Terminal REPL for IntraClaw — talk to the agent without Telegram/Discord.
//
// Usage: `npm run chat` (see package.json scripts)
//
// The REPL loads just enough of the agent stack: tools + executor + providers.
// It does NOT spin up channels, schedulers, or evolution cycles — those live
// in the full server process. Keep this lightweight for "try in 30s" UX.
import 'dotenv/config';
import * as readline from 'readline';
import { executeUniversalTask } from '../executor/universal-executor';
import { initToolRegistry, getTools } from '../tools/auto-registry';
import { getAvailableProviders, refreshProviders } from '../providers/multi-provider';
import { setConfirmationNotifier } from '../security/confirmation';
import { logger } from '../utils/logger';

// ─── Terminal colours (no deps) ───────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  magenta:'\x1b[35m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
};

function banner(): void {
  const title = 'IntraClaw REPL';
  console.log();
  console.log(C.bold + C.cyan + '╭' + '─'.repeat(title.length + 4) + '╮' + C.reset);
  console.log(C.bold + C.cyan + '│  ' + title + '  │' + C.reset);
  console.log(C.bold + C.cyan + '╰' + '─'.repeat(title.length + 4) + '╯' + C.reset);
}

function printProviders(): void {
  const providers = getAvailableProviders();
  if (providers.length === 0) {
    console.log(`${C.red}⚠ No LLM providers available.${C.reset}`);
    console.log(`  Install one of: claude CLI, gemini CLI (with auth), ollama, or set an API key.`);
    return;
  }
  console.log(`${C.gray}Providers:${C.reset} ${providers.map(p => `${C.green}${p.name}${C.reset}`).join(', ')}`);
}

function printTools(): void {
  const tools = getTools();
  console.log(`${C.gray}Tools (${tools.length}):${C.reset} ${tools.map(t => t.name).join(', ')}`);
}

function printHelp(): void {
  console.log();
  console.log(`${C.bold}Commands:${C.reset}`);
  console.log(`  ${C.cyan}/help${C.reset}      Show this help`);
  console.log(`  ${C.cyan}/providers${C.reset} List available LLM providers`);
  console.log(`  ${C.cyan}/tools${C.reset}     List registered tools`);
  console.log(`  ${C.cyan}/refresh${C.reset}   Re-scan for providers (useful if you start Ollama mid-session)`);
  console.log(`  ${C.cyan}/yes${C.reset}/${C.cyan}/no${C.reset}   Confirm or refuse pending tool calls (printed in yellow)`);
  console.log(`  ${C.cyan}/quit${C.reset}      Exit`);
  console.log();
  console.log(`${C.bold}Examples:${C.reset}`);
  console.log(`  ${C.dim}calculate sqrt(256) + 3*pi${C.reset}`);
  console.log(`  ${C.dim}cherche les news sur OpenAI et résume en 3 points${C.reset}`);
  console.log(`  ${C.dim}lis package.json${C.reset}`);
  console.log();
}

// ─── Confirmation flow in REPL ────────────────────────────────────────────
// Track the latest confirmation code printed so /yes and /no with no arg work.
let pendingCode: string | null = null;

function wireConfirmations(): void {
  setConfirmationNotifier(async (message: string) => {
    console.log();
    console.log(C.yellow + message + C.reset);
    // Extract 6-digit code from message (cheap regex match)
    const m = message.match(/\/yes (\d{6})/);
    if (m) pendingCode = m[1];
  });
}

// ─── Main loop ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  banner();
  console.log(`${C.gray}Version ${process.env.npm_package_version ?? '0.1.x'} — type /help for commands${C.reset}`);
  console.log();

  // Initialise just enough of the stack
  initToolRegistry();
  wireConfirmations();

  printProviders();
  printTools();
  console.log();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${C.bold}${C.magenta}› ${C.reset}`,
    historySize: 100,
  });

  rl.prompt();

  rl.on('line', async (rawLine: string) => {
    const line = rawLine.trim();
    if (!line) { rl.prompt(); return; }

    // ── Slash commands ──────────────────────────────────────────────────
    if (line.startsWith('/')) {
      await handleCommand(line);
      rl.prompt();
      return;
    }

    // ── Normal task input ───────────────────────────────────────────────
    const startedAt = Date.now();
    try {
      console.log(`${C.gray}…thinking${C.reset}`);
      const result = await executeUniversalTask(line, progress => {
        if (progress.currentStep > 0 && progress.currentStep % 2 === 0) {
          process.stdout.write(`${C.gray}  step ${progress.currentStep}/${progress.totalSteps}${C.reset}\r`);
        }
      });
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

      if (result.status === 'completed') {
        console.log();
        console.log(`${C.green}✓${C.reset} ${C.gray}(${elapsed}s)${C.reset}`);
        console.log();
        console.log(result.finalOutput ?? '');
        console.log();
      } else {
        console.log();
        console.log(`${C.red}✗ ${result.error ?? 'Failed'}${C.reset}`);
        console.log();
      }
    } catch (err) {
      console.log();
      console.log(`${C.red}✗ ${err instanceof Error ? err.message : String(err)}${C.reset}`);
      console.log();
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log();
    console.log(`${C.gray}bye.${C.reset}`);
    process.exit(0);
  });
}

async function handleCommand(line: string): Promise<void> {
  const [cmd, ...args] = line.slice(1).split(/\s+/);
  switch (cmd) {
    case 'help':       printHelp(); break;
    case 'providers':  printProviders(); break;
    case 'tools':      printTools(); break;
    case 'refresh': {
      refreshProviders();
      console.log(`${C.gray}Providers re-scanned.${C.reset}`);
      printProviders();
      break;
    }
    case 'yes': {
      const { approveByCode } = await import('../security/confirmation');
      const code = args[0] ?? pendingCode;
      if (!code) { console.log(`${C.red}No pending code. Usage: /yes <code>${C.reset}`); break; }
      const res = approveByCode(code);
      console.log(res.ok ? `${C.green}${res.message}${C.reset}` : `${C.red}${res.message}${C.reset}`);
      if (res.ok) pendingCode = null;
      break;
    }
    case 'no': {
      const { rejectByCode } = await import('../security/confirmation');
      const code = args[0] ?? pendingCode;
      if (!code) { console.log(`${C.red}No pending code. Usage: /no <code>${C.reset}`); break; }
      const res = rejectByCode(code);
      console.log(res.ok ? `${C.yellow}${res.message}${C.reset}` : `${C.red}${res.message}${C.reset}`);
      if (res.ok) pendingCode = null;
      break;
    }
    case 'quit':
    case 'exit':
      console.log(`${C.gray}bye.${C.reset}`);
      process.exit(0);
      break;
    default:
      console.log(`${C.red}Unknown command /${cmd}. Try /help.${C.reset}`);
  }
}

main().catch(err => {
  logger.error('REPL', 'Fatal error', err instanceof Error ? err.message : String(err));
  console.error(err);
  process.exit(1);
});
