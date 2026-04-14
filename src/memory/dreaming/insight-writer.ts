/**
 * INTRACLAW -- Insight Writer
 * Ecrit les insights du cycle REM dans HEARTBEAT.md
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Pattern } from './types';

const HEARTBEAT_PATH = path.join(process.cwd(), 'memory', 'HEARTBEAT.md');

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] \u{1F4A4} [InsightWriter] ${msg}`);
}

export function writeInsightsToHeartbeat(data: {
  review: string;
  patterns: Pattern[];
}): boolean {
  try {
    let content = '';
    if (fs.existsSync(HEARTBEAT_PATH)) {
      content = fs.readFileSync(HEARTBEAT_PATH, 'utf-8');
    }

    const date = new Date().toLocaleDateString('fr-BE');
    const time = new Date().toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });

    const insightBlock = [
      ``,
      `## \u{1F4A4} Cycle REM -- ${date} a ${time}`,
      ``,
      `### Resume des dernieres 24h`,
      data.review,
      ``,
    ];

    if (data.patterns.length > 0) {
      insightBlock.push(`### Patterns identifies`);
      for (const p of data.patterns) {
        const confidence = `${(p.confidence * 100).toFixed(0)}%`;
        insightBlock.push(`- **[${p.category}]** ${p.description} (confiance: ${confidence})`);
        if (p.actionable && p.suggestion) {
          insightBlock.push(`  -> ${p.suggestion}`);
        }
      }
      insightBlock.push('');
    }

    insightBlock.push('---');

    // Insere apres le header existant, ou au debut
    const separator = '## \u{1F4A4} Cycle REM';
    const insertIdx = content.indexOf(separator);

    if (insertIdx >= 0) {
      // Insere avant le premier cycle REM existant (le nouveau en haut)
      content = content.slice(0, insertIdx) + insightBlock.join('\n') + '\n' + content.slice(insertIdx);
    } else {
      // Ajoute a la fin
      content += '\n' + insightBlock.join('\n');
    }

    // Garde seulement les 7 derniers cycles REM (evite fichier trop gros)
    const cycles = content.split('## \u{1F4A4} Cycle REM');
    if (cycles.length > 8) {
      content = cycles[0] + cycles.slice(1, 8).map(c => '## \u{1F4A4} Cycle REM' + c).join('');
    }

    fs.writeFileSync(HEARTBEAT_PATH, content.trim() + '\n');
    log(`HEARTBEAT.md mis a jour avec les insights`);
    return true;
  } catch (err: any) {
    log(`Erreur ecriture HEARTBEAT: ${err.message}`);
    return false;
  }
}
