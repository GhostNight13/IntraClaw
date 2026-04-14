export type EmailCategory =
  | 'URGENT'
  | 'CLIENT'
  | 'PROSPECT'
  | 'PARTNER'
  | 'NEWSLETTER'
  | 'INVOICE'
  | 'INTERNAL'
  | 'SPAM'
  | 'OTHER';

export type SuggestedAction =
  | 'reply_now'
  | 'reply_later'
  | 'archive'
  | 'delete'
  | 'unsubscribe'
  | 'forward';

export interface TriageResult {
  category:         EmailCategory;
  priority:         1 | 2 | 3 | 4 | 5;  // 1=critique, 5=ignorable
  suggestedAction:  SuggestedAction;
  summary:          string;     // 1 phrase max
  draftReply?:      string;     // brouillon si reply_now/reply_later
  confidence:       number;     // 0-1
}

export interface EmailDigest {
  date:           string;
  totalUnread:    number;
  urgent:         TriagedEmail[];
  clients:        TriagedEmail[];
  prospects:      TriagedEmail[];
  newsletters:    TriagedEmail[];
  other:          TriagedEmail[];
  summary:        string;       // Résumé global en 2-3 phrases
}

export interface TriagedEmail {
  from:       string;
  subject:    string;
  date:       string;
  triage:     TriageResult;
}

export interface EmailRule {
  id:        string;
  condition: {
    field: 'from' | 'subject' | 'body';
    operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'regex';
    value: string;
  };
  action:    SuggestedAction;
  category:  EmailCategory;
  enabled:   boolean;
}
