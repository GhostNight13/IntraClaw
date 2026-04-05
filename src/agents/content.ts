import { logger } from '../utils/logger';
import { ask } from '../ai';
import { buildSystemPrompt } from '../memory/core';
import { addContentPost, getRecentContentTopics } from '../tools/notion';
import { ContentPlatform, AgentTask } from '../types';
import type { AgentResult, ContentPost } from '../types';

// Rotating topics — ensures diversity over time
const LINKEDIN_TOPICS = [
  'cybersécurité pour PME',
  'refonte de site web : ROI concret',
  'prompt engineering pour non-techniciens',
  'pourquoi votre site Google ne convertit pas',
  'vibe coding : coder sans coder',
  '5 erreurs de site web qui font fuir les clients',
  'automatisation des tâches répétitives pour indépendants',
  'formation IA : se former en 2026',
  'site vitrine vs site e-commerce : lequel choisir ?',
  'comment un site web génère des clients même quand vous dormez',
  'HaiSkills : apprendre la cybersécurité en 30 jours',
  'Next.js vs WordPress : le vrai débat en 2026',
  'SEO local à Bruxelles : ce qui marche vraiment',
  'portfolio web : les 5 éléments indispensables',
  'facturation auto pour freelances belges',
];

async function pickTopic(recentTopics: string[]): Promise<string> {
  // Filter out recently used topics
  const available = LINKEDIN_TOPICS.filter(
    t => !recentTopics.some(r => r.toLowerCase().includes(t.toLowerCase()))
  );

  if (available.length > 0) {
    // Pick based on day of year for consistency
    const dayIndex = Math.floor(Date.now() / 86_400_000) % available.length;
    return available[dayIndex];
  }

  // All topics used recently — pick the oldest-used one
  return LINKEDIN_TOPICS[0];
}

async function generateLinkedInPost(topic: string): Promise<Omit<ContentPost, 'id'>> {
  const prompt = `
Tu es IntraClaw. Génère un post LinkedIn COMPLET pour Ayman Idamre.

THÈME : ${topic}
CONTEXTE : Ayman est développeur web à Bruxelles (intra-site.com) + fondateur HaiSkills (haiskills.vercel.app)

STRUCTURE OBLIGATOIRE :
1. Hook (1 ligne percutante qui force le stop du scroll)
2. Corps (3-5 points ou mini-histoire, avec sauts de ligne)
3. CTA (1 ligne d'appel à l'action claire)
4. Hashtags (3-5 hashtags pertinents)

RÈGLES :
- Ton : expert mais humain, pas de jargon
- Pas de bullet points avec tirets (utilise des emojis ou numéros)
- Ne pas commencer par "Je"
- Mentionner HaiSkills ou intra-site.com naturellement (pas de pub directe)
- Maximum 280 mots
- Langue : français

JSON strict :
{
  "hook": "La ligne accroche (pas plus de 120 chars)",
  "body": "Corps du post avec \\n pour sauts de ligne",
  "cta": "La ligne CTA",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
}
`.trim();

  const response = await ask({
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user',   content: prompt },
    ],
    maxTokens:   700,
    temperature: 0.85,
    task: AgentTask.CONTENT,
  });

  const match = response.content.match(/\{[\s\S]*"hook"[\s\S]*"body"[\s\S]*\}/);
  if (!match) {
    throw new Error(`Content generation failed — no JSON in response:\n${response.content.slice(0, 300)}`);
  }

  const parsed = JSON.parse(match[0]) as {
    hook: string;
    body: string;
    cta: string;
    hashtags: string[];
  };

  const scheduledFor = new Date(
    new Date().setHours(10, 0, 0, 0)  // schedule for 10am today
  ).toISOString();

  return {
    platform:    ContentPlatform.LINKEDIN,
    hook:        parsed.hook,
    body:        parsed.body,
    cta:         parsed.cta,
    hashtags:    parsed.hashtags.map(h => h.startsWith('#') ? h : `#${h}`),
    topic,
    scheduledFor,
    publishedAt: undefined,
    generatedBy: response.model,
  };
}

export async function runContentAgent(): Promise<AgentResult<{ postsCreated: number; topic: string }>> {
  const start = Date.now();
  logger.info('Content', '=== Starting content agent ===');

  try {
    // 1. Fetch recent topics to avoid repetition
    const recentTopics = await getRecentContentTopics(14);
    logger.info('Content', `Recent topics (last 14 days): ${recentTopics.length}`);

    // 2. Pick today's topic
    const topic = await pickTopic(recentTopics);
    logger.info('Content', `Selected topic: "${topic}"`);

    // 3. Generate the post
    const post = await generateLinkedInPost(topic);

    // 4. Preview in console
    console.log('\n📝 LINKEDIN POST GENERATED');
    console.log('─'.repeat(50));
    console.log(`Hook: ${post.hook}`);
    console.log(`\n${post.body}`);
    console.log(`\n${post.cta}`);
    console.log(`\n${post.hashtags.join(' ')}`);
    console.log('─'.repeat(50) + '\n');

    // 5. Save to Notion Content DB
    const postId = await addContentPost(post);
    logger.info('Content', `Post saved to Notion`, { id: postId, topic });

    return {
      task:       AgentTask.CONTENT,
      success:    true,
      data:       { postsCreated: 1, topic },
      durationMs: Date.now() - start,
      model:      post.generatedBy,
      timestamp:  new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Content', 'Agent failed', message);
    return {
      task:       AgentTask.CONTENT,
      success:    false,
      error:      message,
      durationMs: Date.now() - start,
      model:      'none',
      timestamp:  new Date().toISOString(),
    };
  }
}
