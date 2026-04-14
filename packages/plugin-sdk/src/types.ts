export interface UniversalMessage {
  id:        string;
  channel:   string;
  userId:    string;
  text:      string;
  timestamp: string;
  raw?:      unknown;
}

export interface PluginContext {
  /** Register a tool that the IntraClaw executor can call */
  registerTool(name: string, fn: (args: unknown) => Promise<unknown>): void;

  /** Register a skill from YAML string */
  registerSkill(yamlContent: string): void;

  /** Read a value from plugin memory */
  getMemory(key: string): Promise<string | null>;

  /** Save a value to plugin memory */
  setMemory(key: string, value: string): Promise<void>;

  /** Send a notification via Telegram */
  notify(message: string): Promise<void>;

  /** Call Claude via IntraClaw (rate limited) */
  ask(prompt: string, options?: { maxTokens?: number }): Promise<string>;

  /** Plugin logger (prefixed with plugin name) */
  logger: {
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
  };
}

export interface IntraclawPlugin {
  id:          string;
  name:        string;
  version:     string;
  description: string;

  /** Called once on startup */
  onLoad(ctx: PluginContext): Promise<void>;

  /** Called on graceful shutdown */
  onUnload?(): Promise<void>;

  /** Intercept incoming messages (optional) */
  onMessage?(message: UniversalMessage): Promise<UniversalMessage | null>;
}
