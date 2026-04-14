export interface Snapshot {
  id: string;
  filePath: string;
  content: string;
  createdAt: string;
}

export interface DiffResult {
  filePath: string;
  original: string;
  modified: string;
  patch: string;
  additions: number;
  deletions: number;
}

export interface CodeRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
}
