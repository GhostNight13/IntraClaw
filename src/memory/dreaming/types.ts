export interface Pattern {
  category:    'email' | 'prospecting' | 'content' | 'timing' | 'productivity' | 'communication';
  description: string;
  confidence:  number;  // 0-1
  evidence:    string[];
  actionable:  boolean;
  suggestion?: string;
}

export interface REMReport {
  date:               string;
  startedAt:          string;
  completedAt:        string;
  durationMs:         number;
  actionsReviewed:    number;
  patternsFound:      Pattern[];
  memoriesCompressed: number;
  insightsGenerated:  string[];
  heartbeatUpdated:   boolean;
}

export interface ConsolidatedMemory {
  period:   string;   // "2026-04-07 to 2026-04-13"
  summary:  string;   // Resume compresse
  keyFacts: string[];
  score:    number;   // importance 0-1
}
