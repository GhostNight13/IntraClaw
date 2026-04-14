import { ask } from '../../ai';

export interface SummaryResult {
  summary: string;
  actionItems: string[];
}

/**
 * Uses Claude to summarise a meeting transcript and extract action items.
 */
export async function summarizeMeeting(transcript: string, title: string): Promise<SummaryResult> {
  const prompt = `You are an expert meeting assistant. Analyse the following meeting transcript titled "${title}" and produce:

1. A concise summary with exactly 3-5 bullet points that capture the key decisions and outcomes.
2. A list of concrete action items assigned during the meeting.

Return your response in the following JSON format only (no markdown prose outside the JSON):
{
  "summary": "• Point 1\\n• Point 2\\n• Point 3",
  "actionItems": ["Action item 1", "Action item 2"]
}

TRANSCRIPT:
${transcript}`;

  const response = await ask({
    messages: [{ role: 'user', content: prompt }],
    modelTier: 'fast',
  });

  const raw = response.content.trim();

  // Try to extract JSON from ```json ... ``` block or bare JSON
  let jsonStr = raw;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    jsonStr = fenced[1].trim();
  } else {
    // Try to find the first { ... } block
    const objMatch = raw.match(/\{[\s\S]*\}/);
    if (objMatch) jsonStr = objMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr) as { summary?: string; actionItems?: unknown[] };
    const summary = typeof parsed.summary === 'string' ? parsed.summary : raw;
    const actionItems = Array.isArray(parsed.actionItems)
      ? parsed.actionItems.filter((a): a is string => typeof a === 'string')
      : [];
    return { summary, actionItems };
  } catch {
    // Fallback: return full content as summary, empty action items
    return { summary: raw, actionItems: [] };
  }
}
