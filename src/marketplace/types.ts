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
