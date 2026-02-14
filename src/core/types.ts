// Shared types — single source of truth for all Zelda components

// ─── Evaluation Types ────────────────────────────────────────────────────────

export type EvalContext = {
  config: ResolvedConfig;
  transcript: SessionTranscript;
  workspacePath: string;
  toolsManifest: ToolsManifest;
};

export type EvalResult = {
  metric: string;
  score: number; // 0-100 normalized
  details: unknown; // metric-specific structured data
  reasoning?: string; // human-readable explanation
};

export type Evaluator = (context: EvalContext) => Promise<EvalResult>;

// ─── Configuration Types ─────────────────────────────────────────────────────

export type MetricToggles = {
  efficiency?: boolean;
  requirementFulfillment?: boolean;
  toolUsage?: boolean;
  functionalCorrectness?: boolean;
};

export type ExecutionDefaults = {
  model?: string;
  maxTurns?: number;
};

export type ResolvedConfig = {
  judgeModel: string;
  gatewayUrl: string;
  resultsDir: string;
  testDir: string;
  execution: ExecutionDefaults;
  metrics: MetricToggles;
  // Test suite specific (merged from suite overrides)
  testSuiteName: string;
  prompt: string;
  acceptanceCriteria: string[];
  buildCommand?: string;
  testCommand?: string;
  coverageThreshold?: number;
};

// ─── Session & Transcript Types ──────────────────────────────────────────────

export type ToolCall = {
  toolName: string;
  input: unknown;
  output?: unknown;
};

export type TranscriptMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCall[];
};

export type SessionMetadata = {
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  turnCount: number;
  durationMs: number;
  errorCount: number;
};

export type SessionTranscript = {
  messages: TranscriptMessage[];
  metadata: SessionMetadata;
};

// ─── Tools Manifest Types ────────────────────────────────────────────────────

export type ToolEntry = {
  name: string;
  path: string;
  contentSummary?: string;
};

export type ToolsManifest = {
  skills: ToolEntry[];
  rules: ToolEntry[];
  subAgents: ToolEntry[];
  mcpConfigs: ToolEntry[];
};

// ─── Run Result Types ────────────────────────────────────────────────────────

export type TestSuiteSnapshot = {
  name: string;
  prompt: string;
  acceptanceCriteria: string[];
  execution: ExecutionDefaults;
  metrics: MetricToggles;
};

export type RunResult = {
  id: string; // format: <test-name>-<timestamp>
  timestamp: string;
  testSuite: TestSuiteSnapshot;
  metrics: Record<string, EvalResult>;
};
