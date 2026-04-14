export interface Snapshot {
  id: string;
  filePath: string;
  content: string;
  createdAt: string;
}

export interface DiffResult {
  unified: string;
  additions: number;
  deletions: number;
  hasChanges: boolean;
}

export interface CodeRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}
