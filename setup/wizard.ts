#!/usr/bin/env ts-node
import * as path from 'path';
import * as fs from 'fs';

// Compatibilité CommonJS/ESM
const inquirerModule = require('inquirer');
const inquirer = inquirerModule.default || inquirerModule;

import { generateEnv } from './env-generator';
import { runHealthCheck } from './health-check';
import { markSetupComplete } from './first-run';
import type { WizardAnswers } from './types';

const BANNER = `
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   ██╗███╗  ██╗████████╗██████╗  █████╗  ██████╗██╗     ║
║   ██║████╗ ██║╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██║     ║
║   ██║██╔██╗██║   ██║   ██████╔╝███████║██║     ██║     ║
║   ██║██║╚████║   ██║   ██╔══██╗██╔══██║██║     ██║     ║
║   ██║██║ ╚███║   ██║   ██║  ██║██║  ██║╚██████╗███████╗║
║   ╚═╝╚═╝  ╚══╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝║
║                    CLAW                                  ║
║              Setup Wizard v2.0                           ║
╚══════════════════════════════════════════════════════════╝
`;

async function runWizard(): Promise<void> {
  console.log(BANNER);
  console.log('🐾 Bienvenue ! Ce wizard configure IntraClaw en ~5 minutes.\n');
  console.log('─'.repeat(60));

  // ─── STEP 1 : API Key ───────────────────────────────────────
  console.log('\n📡 ÉTAPE 1/5 — Intelligence Artificielle\n');

  const { ANTHROPIC_API_KEY } = await inquirer.prompt([{
    type:     'password',
    name:     'ANTHROPIC_API_KEY',
    message:  '🔑 Clé API Anthropic (obligatoire) :',
    validate: (v: string) => v.startsWith('sk-ant-')
      ? true
      : 'La clé doit commencer par sk-ant- (https://console.anthropic.com)',
  }]);

  // ─── STEP 2 : User Profile ──────────────────────────────────
  console.log('\n👤 ÉTAPE 2/5 — Profil utilisateur\n');

  const profileAnswers = await inquirer.prompt([
    {
      type:    'input',
      name:    'USER_NAME',
      message: '👤 Ton prénom :',
      default: 'Ayman',
    },
    {
      type:    'list',
      name:    'USER_LANGUAGE',
      message: '🌍 Langue préférée :',
      choices: [
        { name: '🇫🇷 Français',    value: 'fr' },
        { name: '🇬🇧 English',     value: 'en' },
        { name: '🇳🇱 Nederlands',  value: 'nl' },
        { name: '🇪🇸 Español',     value: 'es' },
      ],
      default: 'fr',
    },
    {
      type:    'list',
      name:    'USER_TIMEZONE',
      message: '🕐 Fuseau horaire :',
      choices: [
        { name: '🇧🇪 Brussels (UTC+1/+2)',   value: 'Europe/Brussels' },
        { name: '🇫🇷 Paris (UTC+1/+2)',       value: 'Europe/Paris' },
        { name: '🇺🇸 New York (UTC-5/-4)',     value: 'America/New_York' },
        { name: '🇬🇧 London (UTC+0/+1)',       value: 'Europe/London' },
        { name: '🇦🇪 Dubai (UTC+4)',           value: 'Asia/Dubai' },
        { name: '🌐 UTC',                      value: 'UTC' },
      ],
      default: 'Europe/Brussels',
    },
  ]);

  // ─── STEP 3 : Channels ──────────────────────────────────────
  console.log('\n💬 ÉTAPE 3/5 — Canaux de communication\n');

  const { ENABLE_TELEGRAM } = await inquirer.prompt([{
    type:    'confirm',
    name:    'ENABLE_TELEGRAM',
    message: '📱 Activer Telegram ?',
    default: true,
  }]);

  let TELEGRAM_BOT_TOKEN = '';
  let TELEGRAM_CHAT_ID   = '';

  if (ENABLE_TELEGRAM) {
    const tg = await inquirer.prompt([
      {
        type:    'password',
        name:    'TELEGRAM_BOT_TOKEN',
        message: '  🤖 Token du bot Telegram (@BotFather) :',
      },
      {
        type:    'input',
        name:    'TELEGRAM_CHAT_ID',
        message: '  💬 Ton Chat ID (@userinfobot) :',
      },
    ]);
    TELEGRAM_BOT_TOKEN = tg.TELEGRAM_BOT_TOKEN;
    TELEGRAM_CHAT_ID   = tg.TELEGRAM_CHAT_ID;
  }

  const { ENABLE_WHATSAPP } = await inquirer.prompt([{
    type:    'confirm',
    name:    'ENABLE_WHATSAPP',
    message: '📲 Activer WhatsApp ? (nécessite scan QR code au premier démarrage)',
    default: false,
  }]);

  const { ENABLE_DISCORD } = await inquirer.prompt([{
    type:    'confirm',
    name:    'ENABLE_DISCORD',
    message: '🎮 Activer Discord ?',
    default: false,
  }]);

  let DISCORD_TOKEN = '';
  if (ENABLE_DISCORD) {
    const dc = await inquirer.prompt([{
      type:    'password',
      name:    'DISCORD_TOKEN',
      message: '  🎮 Token du bot Discord :',
    }]);
    DISCORD_TOKEN = dc.DISCORD_TOKEN;
  }

  const { ENABLE_SLACK } = await inquirer.prompt([{
    type:    'confirm',
    name:    'ENABLE_SLACK',
    message: '💼 Activer Slack ?',
    default: false,
  }]);

  let SLACK_BOT_TOKEN = '', SLACK_SIGNING_SECRET = '', SLACK_APP_TOKEN = '';
  if (ENABLE_SLACK) {
    const sl = await inquirer.prompt([
      { type: 'password', name: 'SLACK_BOT_TOKEN',      message: '  Bot Token (xoxb-...) :' },
      { type: 'password', name: 'SLACK_SIGNING_SECRET',  message: '  Signing Secret :' },
      { type: 'password', name: 'SLACK_APP_TOKEN',       message: '  App-level Token (xapp-...) :' },
    ]);
    SLACK_BOT_TOKEN      = sl.SLACK_BOT_TOKEN;
    SLACK_SIGNING_SECRET = sl.SLACK_SIGNING_SECRET;
    SLACK_APP_TOKEN      = sl.SLACK_APP_TOKEN;
  }

  // ─── STEP 4 : Integrations ──────────────────────────────────
  console.log('\n🔗 ÉTAPE 4/5 — Intégrations\n');

  const integrationsAnswers = await inquirer.prompt([
    { type: 'confirm', name: 'ENABLE_GMAIL',           message: '📧 Connecter Gmail ?',           default: true  },
    { type: 'confirm', name: 'ENABLE_GOOGLE_CALENDAR', message: '📅 Connecter Google Calendar ?', default: false },
    { type: 'confirm', name: 'ENABLE_NOTION',          message: '📓 Connecter Notion ?',          default: false },
  ]);

  let NOTION_TOKEN = '';
  if (integrationsAnswers.ENABLE_NOTION) {
    const nt = await inquirer.prompt([{
      type:    'password',
      name:    'NOTION_TOKEN',
      message: '  📓 Token Notion (secret_...) :',
    }]);
    NOTION_TOKEN = nt.NOTION_TOKEN;
  }

  // ─── STEP 5 : Confirmation ──────────────────────────────────
  console.log('\n✅ ÉTAPE 5/5 — Confirmation\n');

  const summary = [
    `  Prénom       : ${profileAnswers.USER_NAME}`,
    `  Langue       : ${profileAnswers.USER_LANGUAGE}`,
    `  Timezone     : ${profileAnswers.USER_TIMEZONE}`,
    `  Telegram     : ${ENABLE_TELEGRAM ? '✅' : '❌'}`,
    `  WhatsApp     : ${ENABLE_WHATSAPP ? '✅' : '❌'}`,
    `  Discord      : ${ENABLE_DISCORD ? '✅' : '❌'}`,
    `  Slack        : ${ENABLE_SLACK ? '✅' : '❌'}`,
    `  Gmail        : ${integrationsAnswers.ENABLE_GMAIL ? '✅' : '❌'}`,
    `  Calendar     : ${integrationsAnswers.ENABLE_GOOGLE_CALENDAR ? '✅' : '❌'}`,
    `  Notion       : ${integrationsAnswers.ENABLE_NOTION ? '✅' : '❌'}`,
  ].join('\n');

  console.log('📋 Récapitulatif :\n');
  console.log(summary);
  console.log('');

  const { confirmed } = await inquirer.prompt([{
    type:    'confirm',
    name:    'confirmed',
    message: '🚀 Tout est correct ? Générer la configuration ?',
    default: true,
  }]);

  if (!confirmed) {
    console.log('\n❌ Configuration annulée. Relance le wizard avec : npm run setup\n');
    process.exit(0);
  }

  // ─── Génération ──────────────────────────────────────────────
  console.log('\n⚙️  Génération de la configuration...\n');

  const answers: WizardAnswers = {
    ANTHROPIC_API_KEY,
    ENABLE_TELEGRAM,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
    ENABLE_WHATSAPP,
    ENABLE_DISCORD,
    DISCORD_TOKEN,
    ENABLE_SLACK,
    SLACK_BOT_TOKEN,
    SLACK_SIGNING_SECRET,
    SLACK_APP_TOKEN,
    ENABLE_GMAIL:           integrationsAnswers.ENABLE_GMAIL,
    ENABLE_GOOGLE_CALENDAR: integrationsAnswers.ENABLE_GOOGLE_CALENDAR,
    ENABLE_NOTION:          integrationsAnswers.ENABLE_NOTION,
    NOTION_TOKEN,
    USER_NAME:              profileAnswers.USER_NAME,
    USER_TIMEZONE:          profileAnswers.USER_TIMEZONE,
    USER_LANGUAGE:          profileAnswers.USER_LANGUAGE,
    DB_PASSWORD:            '',   // sera auto-généré
    REDIS_PASSWORD:         '',   // sera auto-généré
    JWT_SECRET:             '',   // sera auto-généré
  };

  await generateEnv(answers);
  markSetupComplete();

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  🎉  INTRACLAW EST PRÊT !                               ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║                                                          ║');
  console.log('║  Démarre avec :  docker compose up -d                   ║');
  console.log('║  Ou            : npm run docker:start                   ║');
  console.log('║                                                          ║');
  console.log('║  API     : http://localhost:3000                         ║');
  console.log('║  Health  : http://localhost:3000/health                  ║');
  console.log('║                                                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // Health check optionnel
  await runHealthCheck();
}

// Point d'entrée
runWizard().catch(err => {
  console.error('\n❌ Erreur dans le wizard :', err.message);
  process.exit(1);
});
