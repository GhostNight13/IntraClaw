/**
 * Generic Skill: Email Responder
 * Reads inbox via gmail tool, drafts reply for each email matching user-defined keywords.
 */
import { GenericSkill, SkillContext, SkillResult } from '../types';
import { getUnreadEmails, sendEmail } from '../../tools/gmail';
import { ask } from '../../ai';
import { logger } from '../../utils/logger';

interface EmailResponderConfig {
  keywords?:    string[];   // e.g. ['invoice','support','question']
  maxReplies?:  number;     // safety cap per run
  tone?:        'pro' | 'friendly' | 'concise';
  signature?:   string;
  draftOnly?:   boolean;    // if true, do NOT send — just return drafts
}

export const emailResponder: GenericSkill = {
  id:          'email-responder',
  name:        'Email Responder',
  description: 'Reads your inbox and drafts intelligent replies for emails matching your keyword rules.',
  icon:        'Mail',
  tier:        'free',
  requires:    ['gmail'],

  async execute(ctx: SkillContext, _input: Record<string, unknown>): Promise<SkillResult> {
    const cfg       = ctx.config as EmailResponderConfig;
    const keywords  = (cfg.keywords ?? []).map(k => k.toLowerCase());
    const maxReplies = cfg.maxReplies ?? 5;
    const tone      = cfg.tone      ?? 'pro';
    const draftOnly = cfg.draftOnly ?? true;

    try {
      const unread = await getUnreadEmails(20);
      const matched = keywords.length === 0
        ? unread
        : unread.filter(e => {
            const hay = `${e.subject} ${e.snippet}`.toLowerCase();
            return keywords.some(k => hay.includes(k));
          });

      const toProcess = matched.slice(0, maxReplies);
      const drafts: Array<{ to: string; subject: string; reply: string; sent: boolean }> = [];

      for (const email of toProcess) {
        const prompt = [
          `You are an email assistant. Tone: ${tone}.`,
          `Draft a short reply (3-6 sentences) to the email below.`,
          `From: ${email.from}`,
          `Subject: ${email.subject}`,
          `Snippet: ${email.snippet}`,
          cfg.signature ? `End with the signature: ${cfg.signature}` : '',
          `Output ONLY the reply body, no headers.`,
        ].filter(Boolean).join('\n');

        const reply = await ask({
          messages: [{ role: 'user', content: prompt }],
          modelTier: 'fast',
          maxTokens: 500,
        });
        const replyBody = reply.content.trim();

        let sent = false;
        if (!draftOnly) {
          await sendEmail(email.from, `Re: ${email.subject}`, replyBody.replace(/\n/g, '<br>'));
          sent = true;
        }
        drafts.push({ to: email.from, subject: `Re: ${email.subject}`, reply: replyBody, sent });
      }

      return {
        ok: true,
        message: `Processed ${toProcess.length} email(s), ${drafts.filter(d => d.sent).length} sent.`,
        data: { drafts, totalUnread: unread.length, matched: matched.length },
      };
    } catch (err) {
      logger.error('Skill:email-responder', err instanceof Error ? err.message : String(err));
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
