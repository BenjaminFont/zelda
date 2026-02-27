# Story 9.3: Container Execution Adapter

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer using Zelda**,
I want Claude Code to run inside the container and produce the same transcript output as local execution,
so that the evaluation pipeline works identically regardless of execution backend.

## Acceptance Criteria

1. **Given** `backend: container` with a running container and workspace mounted **When** the pipeline executes a Claude Code session **Then** Claude Code runs inside the container via agentbox with the test suite prompt (FR75)
2. **Given** Claude Code completing inside the container **When** the session produces results **Then** the transcript and all file changes are written to the mounted workspace and are accessible from the host (FR74-75)
3. **Given** a containerized execution **When** the pipeline collects results **Then** it produces the same `SessionTranscript` and `ExecutionResult` types as local execution — downstream evaluators see no difference
4. **Given** the execution adapter **When** it selects the backend **Then** it delegates to either the existing `execution-client.ts` (local) or the new container adapter — both conform to the same interface
5. **Given** environment variables needed by Claude Code (e.g., `ANTHROPIC_API_KEY`) **When** the container starts **Then** required environment variables are passed through to the container
6. **Given** `backend: local` **When** the pipeline executes **Then** behavior is identical to current implementation (no regression)

## Tasks / Subtasks

- [x] Task 1: Extract execution interface (AC: #3, #4, #6)
  - [x] 1.1 Define `ExecutionBackend` type in `types.ts`: function signature `(params: ExecutionParams) => Promise<ExecutionResult>`
  - [x] 1.2 Verify existing `executeSession()` already conforms to this signature (it does)
  - [x] 1.3 Create `resolveExecutionBackend()` factory function that returns the appropriate backend based on config
- [x] Task 2: Create container execution adapter (AC: #1, #2, #3, #5)
  - [x] 2.1 Create `src/core/execution/container-adapter.ts`
  - [x] 2.2 Implement `executeSessionInContainer(params: ExecutionParams): Promise<ExecutionResult>`
  - [x] 2.3 Spawn Claude Code CLI inside container via agentbox, capture output
  - [x] 2.4 Parse CLI output into `SessionTranscript` (messages + metadata)
  - [x] 2.5 Pass `ANTHROPIC_API_KEY` and required env vars through agentbox
  - [x] 2.6 Handle execution errors with `ExecutionError` (same codes as local)
  - [x] 2.7 Create test suite `tests/core/execution/container-adapter.test.ts`
- [x] Task 3: Integrate adapter into pipeline (AC: #4, #6)
  - [x] 3.1 Update `run-pipeline.ts` to call `resolveExecutionBackend()` based on resolved config
  - [x] 3.2 Replace direct `executeSession()` call with resolved backend function
  - [x] 3.3 Ensure local mode is unchanged (no regression)
  - [x] 3.4 Add pipeline integration tests for both backends
- [x] Task 4: Transcript parsing from container output (AC: #2, #3)
  - [x] 4.1 Implement CLI output parser that transforms Claude Code CLI JSON output into `SessionTranscript`
  - [x] 4.2 Extract `TranscriptMessage[]` from CLI output (role, content, toolCalls)
  - [x] 4.3 Extract `SessionMetadata` from CLI output (cost, tokens, turns, duration, errors)
  - [x] 4.4 Add parser tests with sample CLI output fixtures

## Dev Notes

### Architecture Patterns & Constraints

- **Same interface**: Container adapter MUST return `Promise<ExecutionResult>` with identical `SessionTranscript` structure
- **No evaluator changes**: Downstream evaluators must see no difference between local and container execution
- **Error hierarchy**: Use `ExecutionError` with same error codes (`EXECUTION_SESSION_FAILED`)
- **Named exports only**, no `export default`, no barrel files
- **kebab-case.ts** file naming: `container-adapter.ts`
- **No SDK type leakage**: Container adapter wraps CLI output in Zelda-owned types

### Current Execution Interface (EXACT — must match)

**ExecutionParams** (input):
```typescript
export type ExecutionParams = {
  prompt: string;
  workspacePath: string;
  model?: string;
  maxTurns?: number;
};
```

**ExecutionResult** (output):
```typescript
export type ExecutionResult = {
  transcript: SessionTranscript;
};
```

**SessionTranscript**:
```typescript
export type SessionTranscript = {
  messages: TranscriptMessage[];
  metadata: SessionMetadata;
};

export type TranscriptMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCall[];
};

export type ToolCall = {
  toolName: string;
  input: unknown;
  output?: unknown;
};

export type SessionMetadata = {
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  turnCount: number;
  durationMs: number;
  errorCount: number;
};
```

**Current executeSession() call in pipeline (run-pipeline.ts):**
```typescript
const { transcript } = await executeSession({
  prompt: resolvedConfig.prompt,
  workspacePath,
  model: resolvedConfig.execution.model,
  maxTurns: resolvedConfig.execution.maxTurns,
});
```

### Adapter Pattern Design

**Factory function** (`src/core/execution/container-adapter.ts` or a shared module):
```typescript
import { executeSession as executeLocal } from './execution-client.js';
import { executeSessionInContainer } from './container-adapter.js';
import type { ExecutionParams, ExecutionResult, ContainerInstance } from '../types.js';

export type ExecutionBackend = (params: ExecutionParams) => Promise<ExecutionResult>;

export const resolveExecutionBackend = (
  backend: 'container' | 'local',
  container?: ContainerInstance,
): ExecutionBackend => {
  if (backend === 'container' && container) {
    return (params) => executeSessionInContainer(params, container);
  }
  return executeLocal;
};
```

**Pipeline integration** (updated call in `run-pipeline.ts`):
```typescript
// Resolve which backend to use
const executionBackend = resolveExecutionBackend(
  resolvedConfig.execution.backend ?? 'local',
  container,  // from Story 9.2's startContainer()
);

// Same call signature — evaluators see no difference
const { transcript } = await executionBackend({
  prompt: resolvedConfig.prompt,
  workspacePath,
  model: resolvedConfig.execution.model,
  maxTurns: resolvedConfig.execution.maxTurns,
});
```

### Container Execution: Transcript Capture Strategy

This is the core technical challenge. Two approaches — try Option 1 first, fall back to Option 2.

**Option 1 (Recommended): Claude Code CLI with JSON output**

Claude Code CLI supports `--output-format stream-json` which outputs structured JSON per message. Run inside container via agentbox and capture stdout:

```typescript
import { spawn } from 'node:child_process';

export const executeSessionInContainer = async (
  params: ExecutionParams,
  container: ContainerInstance,
): Promise<ExecutionResult> => {
  const { prompt, workspacePath, model, maxTurns } = params;

  // Build claude CLI args
  const claudeArgs = [
    '--dangerously-skip-permissions',
    '--output-format', 'stream-json',
    '-p', prompt,
  ];
  if (model) claudeArgs.push('--model', model);
  if (maxTurns) claudeArgs.push('--max-turns', String(maxTurns));

  // Run inside container via agentbox
  // agentbox shell <command> runs raw command (not through claude)
  const agentboxArgs = ['shell', 'claude', ...claudeArgs];

  const child = spawn(container.agentboxPath, agentboxArgs, {
    cwd: workspacePath,
    env: {
      ...process.env,  // Pass through ANTHROPIC_API_KEY etc.
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Collect stdout (JSON stream)
  let stdout = '';
  for await (const chunk of child.stdout) {
    stdout += chunk.toString();
  }

  // Parse JSON output into SessionTranscript
  const transcript = parseClaudeCliOutput(stdout);
  return { transcript };
};
```

**Option 2 (Fallback): Transcript file written to workspace**

If CLI JSON output is insufficient, write a small execution script:

```typescript
// Create a temporary execution script in workspace
const scriptContent = `
import { query } from '@anthropic-ai/claude-agent-sdk';
import { writeFileSync } from 'fs';

const session = query({ prompt: process.argv[2], options: { ... } });
const messages = [];
for await (const msg of session) { messages.push(msg); }
writeFileSync('.zelda/transcript-capture.json', JSON.stringify(messages));
`;

// Write to workspace (mounted in container)
writeFileSync(join(workspacePath, '.zelda-exec.mjs'), scriptContent);

// Run inside container
execFileSync(container.agentboxPath, ['shell', 'node', '.zelda-exec.mjs', prompt], {
  cwd: workspacePath,
  timeout: 600000, // 10 min max
});

// Read transcript from mounted workspace
const raw = readFileSync(join(workspacePath, '.zelda/transcript-capture.json'), 'utf-8');
const transcript = parseAgentSdkOutput(JSON.parse(raw));
```

**Recommendation**: Start with Option 1. The Claude Code CLI's JSON output is the cleanest path — no temp scripts, no extra dependencies inside the container. If the CLI output format doesn't contain enough metadata (cost, tokens), fall back to Option 2.

### CLI Output Parsing

**Parser module** (can be in `container-adapter.ts` or separate):
```typescript
export const parseClaudeCliOutput = (rawOutput: string): SessionTranscript => {
  // Parse JSON lines or structured JSON from Claude CLI
  // Transform into SessionTranscript:
  const messages: TranscriptMessage[] = [];
  const metadata: SessionMetadata = {
    costUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
    turnCount: 0,
    durationMs: 0,
    errorCount: 0,
  };

  // Parse each JSON line/object from CLI output
  // Extract assistant messages → TranscriptMessage with content and toolCalls
  // Extract result/summary → SessionMetadata fields

  return { messages, metadata };
};
```

**Key parsing rules** (must match local execution output exactly):
- `role` must be `'user' | 'assistant' | 'system'`
- `content` is text concatenated from content blocks
- `toolCalls` only present if tools were invoked (omit empty array)
- `metadata.errorCount` incremented when subtype !== 'success'
- `metadata.durationMs` fallback to wall-clock time if not in output

### Environment Variable Passthrough

Agentbox loads `.env` files automatically. For Zelda's use case, ensure:
- `ANTHROPIC_API_KEY` — required for Claude Code inside the container
- `PORTKEY_API_KEY` — not needed inside container (judge calls run on host)
- Agentbox mounts `~/.claude` for authentication config

If using `spawn()` to call agentbox, pass `process.env` through:
```typescript
const child = spawn(agentboxPath, args, {
  env: { ...process.env },  // Inherits all env vars
  cwd: workspacePath,
});
```

### Existing executeSession() (LOCAL — do not change)

The current `executeSession()` in `execution-client.ts` uses the Agent SDK directly:
```typescript
export const executeSession = async (params: ExecutionParams): Promise<ExecutionResult> => {
  const { prompt, workspacePath, model, maxTurns } = params;
  // SDK query() → async generator → build transcript
  // Returns { transcript: { messages, metadata } }
};
```

This function remains unchanged. The adapter pattern wraps it — the pipeline calls the factory function which delegates to either this or the container adapter.

### Error Handling

| Scenario | Error Type | Code | User Message |
|---|---|---|---|
| Container execution fails | `ExecutionError` | `EXECUTION_SESSION_FAILED` | "Claude Code session failed inside container. Check ANTHROPIC_API_KEY and container logs." |
| CLI output parse failure | `ExecutionError` | `EXECUTION_PARSE_FAILED` | "Could not parse Claude Code output from container. The CLI output format may be unsupported." |
| Timeout (>10 min) | `ExecutionError` | `EXECUTION_TIMEOUT` | "Claude Code session timed out inside container." |
| agentbox spawn failure | `ExecutionError` | `CONTAINER_EXEC_FAILED` | "Failed to execute command inside container." |

### Test Patterns

**Container adapter tests** (`tests/core/execution/container-adapter.test.ts`):
```typescript
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
  execFileSync: vi.fn(),
}));

describe('container-adapter', () => {
  describe('executeSessionInContainer', () => {
    it('spawns agentbox with correct args', async () => {
      // Mock spawn to return a process with stdout stream
      const mockProcess = createMockProcess(sampleCliOutput);
      vi.mocked(spawn).mockReturnValue(mockProcess);

      const result = await executeSessionInContainer(params, containerInstance);

      expect(spawn).toHaveBeenCalledWith(
        '/usr/local/bin/agentbox',
        ['shell', 'claude', '--dangerously-skip-permissions', '--output-format', 'stream-json', '-p', 'Build a REST API'],
        expect.objectContaining({ cwd: '/workspace' }),
      );
    });

    it('returns ExecutionResult with valid SessionTranscript', async () => {
      const mockProcess = createMockProcess(sampleCliOutput);
      vi.mocked(spawn).mockReturnValue(mockProcess);

      const result = await executeSessionInContainer(params, containerInstance);

      expect(result.transcript.messages).toHaveLength(2);
      expect(result.transcript.metadata.costUsd).toBeGreaterThan(0);
    });

    it('throws ExecutionError on spawn failure', async () => {
      vi.mocked(spawn).mockImplementation(() => { throw new Error('spawn fail'); });

      await expect(executeSessionInContainer(params, containerInstance))
        .rejects.toThrow(ExecutionError);
    });
  });

  describe('parseClaudeCliOutput', () => {
    it('parses assistant messages with text content', () => { ... });
    it('parses tool calls from content blocks', () => { ... });
    it('extracts metadata (cost, tokens, turns)', () => { ... });
    it('omits toolCalls when none invoked', () => { ... });
    it('handles empty output gracefully', () => { ... });
  });

  describe('resolveExecutionBackend', () => {
    it('returns local executeSession when backend is local', () => {
      const backend = resolveExecutionBackend('local');
      expect(backend).toBe(executeSession);
    });

    it('returns container adapter when backend is container', () => {
      const backend = resolveExecutionBackend('container', containerInstance);
      expect(backend).not.toBe(executeSession);
    });
  });
});
```

**Pipeline tests** (verify no regression):
```typescript
it('uses local executeSession when backend is local', async () => {
  // Config with backend: 'local'
  // Verify executeSession (local) was called, NOT container adapter
});

it('uses container adapter when backend is container', async () => {
  // Config with backend: 'container', container started
  // Verify executeSessionInContainer was called
});

it('evaluators receive identical transcript format from both backends', async () => {
  // Run with local, capture evalContext.transcript
  // Run with container (mocked), capture evalContext.transcript
  // Verify same structure: messages[], metadata fields present
});
```

### Previous Story Intelligence

**Story 9.1 provides:**
- `RuntimeDetectionResult` with `available` and `agentboxPath` — used to determine if container execution is possible
- `backend` field in `ExecutionDefaults` — the routing decision field
- Detection cached per pipeline run

**Story 9.2 provides:**
- `ContainerInstance` type with `containerName`, `workspacePath`, `agentboxPath`
- `startContainer()` / `stopContainer()` — container is already running when this adapter executes
- Signal handler integration for cleanup
- Container started BEFORE execution, stopped AFTER

**Data flow across stories:**
```
9.1: detectRuntime() → RuntimeDetectionResult { available, agentboxPath }
9.2: startContainer() → ContainerInstance { containerName, workspacePath, agentboxPath }
9.3: resolveExecutionBackend(backend, container) → ExecutionBackend function
     executeSessionInContainer(params, container) → ExecutionResult { transcript }
```

### Project Structure Notes

**New files to create:**
- `src/core/execution/container-adapter.ts` — container execution + CLI output parser + backend resolver
- `tests/core/execution/container-adapter.test.ts` — adapter and parser tests

**Existing files to modify:**
- `src/core/types.ts` — add `ExecutionBackend` type alias
- `src/core/pipeline/run-pipeline.ts` — replace direct `executeSession()` call with `resolveExecutionBackend()`

**Alignment with existing structure:**
```
src/core/execution/
├── execution-client.ts     # Existing — local Agent SDK execution (unchanged)
├── runtime-detector.ts     # Story 9.1 — Docker/agentbox detection
├── container-manager.ts    # Story 9.2 — container start/stop lifecycle
└── container-adapter.ts    # NEW — container execution + transcript parsing + backend resolver

tests/core/execution/
├── execution-client.test.ts
├── runtime-detector.test.ts
├── container-manager.test.ts
└── container-adapter.test.ts  # NEW
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 9, Story 9.3]
- [Source: _bmad-output/planning-artifacts/prd.md — FR74-75]
- [Source: src/core/execution/execution-client.ts — executeSession() signature, SDK query pattern]
- [Source: src/core/types.ts — SessionTranscript, TranscriptMessage, ToolCall, SessionMetadata, ExecutionResult]
- [Source: src/core/pipeline/run-pipeline.ts — pipeline execution flow, how executeSession is called]
- [Source: tests/core/execution/execution-client.test.ts — mock async generator pattern, SDK message fixtures]
- [Source: _bmad-output/implementation-artifacts/9-1-execution-backend-configuration-and-runtime-detection.md]
- [Source: _bmad-output/implementation-artifacts/9-2-container-lifecycle-manager.md]
- [Agentbox: https://github.com/fletchgqc/agentbox — CLI interface, one-off commands via `shell`]

### Git Intelligence

- Commit convention: `feat(story-9-3): container execution adapter`
- `execution-client.ts` is 115 lines — the adapter will be similar size
- No existing adapter/strategy pattern in codebase — this introduces a clean factory function

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
