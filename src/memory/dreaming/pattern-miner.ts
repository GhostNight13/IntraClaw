/**
 * INTRACLAW -- Pattern Miner
 * Analyse les actions des dernieres 24h pour trouver des tendances
 */
import type { Pattern } from './types';
import { ask } from '../../ai';
import { AgentTask } from '../../types';

function log(level: 'info' | 'warn' | 'error', msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  const prefix = { info: '\u{1F4A4}', warn: '\u26A0\uFE0F', error: '\u274C' }[level];
  console[level === 'info' ? 'log' : level](`[${ts}] ${prefix} [PatternMiner] ${msg}`);
}

export async function minePatterns(actions: any[]): Promise<Pattern[]> {
  if (actions.length === 0) return [];

  // Resume compact des actions
  const actionsSummary = actions.map((a: any) => ({
    type:    a.task || a.type || 'unknown',
    status:  a.status || (a.success ? 'success' : 'failure'),
    time:    a.created_at || a.createdAt || a.timestamp || '',
    data:    a.data ? JSON.stringify(a.data).slice(0, 150) : '',
  }));

  const prompt = `Tu es un analyste de donnees expert. Voici les ${actions.length} actions effectuees par un agent IA autonome (IntraClaw) au cours des dernieres 24 heures :

${JSON.stringify(actionsSummary.slice(0, 50), null, 1)}

Identifie des PATTERNS RECURRENTS et ACTIONABLES :
1. Quels types d'actions reussissent le plus souvent ?
2. A quels moments de la journee les resultats sont meilleurs ?
3. Y a-t-il des correlations (ex: emails du matin -> plus de reponses) ?
4. Quelles sequences d'actions sont efficaces ?
5. Y a-t-il des echecs recurrents a corriger ?

Reponds UNIQUEMENT en JSON valide -- un array de patterns :
[{
  "category": "email|prospecting|content|timing|productivity|communication",
  "description": "description concise du pattern",
  "confidence": 0.0-1.0,
  "evidence": ["preuve 1", "preuve 2"],
  "actionable": true|false,
  "suggestion": "action recommandee si actionable"
}]`;

  try {
    const response = await ask({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 800,
      temperature: 0.3,
      task: AgentTask.MAINTENANCE,
      modelTier: 'balanced',
    });

    const content = typeof response === 'string' ? response : response.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      log('warn', 'Reponse IA non-JSON');
      return [];
    }

    const patterns = JSON.parse(jsonMatch[0]) as Pattern[];
    log('info', `${patterns.length} patterns identifies`);
    return patterns;
  } catch (err: any) {
    log('error', `Erreur mining: ${err.message}`);
    return [];
  }
}
