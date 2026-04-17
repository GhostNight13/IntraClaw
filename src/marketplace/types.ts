export interface MarketplaceSkill {
  id:          string;
  authorId:    string;
  authorName:  string;
  name:        string;
  slug:        string;       // unique, e.g. "prospection-b2b-fr"
  description: string;
  version:     string;
  content:     string;       // full YAML
  tags:        string;       // JSON array string for SQLite
  downloads:   number;
  avgRating:   number;
  published:   boolean;
  createdAt:   string;
}

export interface SkillRating {
  id:        string;
  skillId:   string;
  userId:    string;
  score:     number;         // 1-5
  comment:   string | null;
  createdAt: string;
}

export interface PublishRequest {
  name:        string;
  slug:        string;
  description: string;
  version:     string;
  content:     string;       // YAML
  tags:        string[];
}

export interface RateRequest {
  score:    number;          // 1-5
  comment?: string;
}

// ─── Generic skills (any user can install) ─────────────────────────────────

export type SkillTier = 'free' | 'pro' | 'agency';

export interface SkillContext {
  userId: string;
  config: Record<string, unknown>;
}

export interface SkillResult {
  ok:       boolean;
  message?: string;
  data?:    unknown;
  error?:   string;
}

export interface GenericSkill {
  id:          string;
  name:        string;
  description: string;
  icon?:       string;        // lucide-react icon name
  tier:        SkillTier;
  requires:    string[];      // e.g. ['gmail','notion','calendar']
  execute:     (ctx: SkillContext, input: Record<string, unknown>) => Promise<SkillResult>;
}

export interface UserSkillRow {
  user_id:    string;
  skill_id:   string;
  enabled:    number;     // 0|1
  config:     string;     // JSON
  created_at: string;
}
