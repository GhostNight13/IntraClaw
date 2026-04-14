/**
 * INTRACLAW -- Memory Consolidator
 * Resume les actions des dernieres 24h en insights compacts
 */
import { ask } from '../../ai';
import { AgentTask } from '../../types';

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] \u{1F4A4} [Consolidator] ${msg}`);
}

export async function consolidateActions(actions: any[]): Promise<string> {
  if (actions.length === 0) return 'Aucune action dans les dernieres 24h.';

  const successCount = actions.filter((a: any) => a.status === 'success').length;
  const failCount    = actions.filter((a: any) => a.status === 'failure' || a.status === 'error').length;
  const taskTypes    = [...new Set(actions.map((a: any) => a.task || a.type || 'unknown'))];

  const prompt = `Resume les activites de l'agent IntraClaw sur les dernieres 24h en 3-5 phrases concises et factuelles :

- Nombre total d'actions : ${actions.length}
- Reussites : ${successCount}
- Echecs : ${failCount}
- Types d'actions : ${taskTypes.join(', ')}

Exemples d'actions recentes :
${actions.slice(0, 15).map((a: any) => `  - [${a.status || '?'}] ${a.task || a.type || '?'} @ ${a.created_at || a.createdAt || ''}`).join('\n')}

Resume factuel et concis (pas de bullet points, juste du texte) :`;

  try {
    const response = await ask({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 300,
      temperature: 0.3,
      task: AgentTask.MAINTENANCE,
      modelTier: 'fast',
    });

    const summary = typeof response === 'string' ? response : response.content || '';
    log(`Consolidation terminee : ${summary.slice(0, 80)}...`);
    return summary.trim();
  } catch (err: any) {
    log(`Erreur consolidation: ${err.message}`);
    return `${actions.length} actions effectuees, dont ${successCount} reussies et ${failCount} echouees.`;
  }
}
