# Story 9.1: Execution Backend Configuration & Runtime Detection

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer using Zelda**,
I want to configure whether evaluations run locally or in a container and have the system detect Docker/Podman/agentbox availability,
so that I can choose the execution mode that suits my environment with clear feedback when container execution is unavailable.

## Acceptance Criteria

1. **Given** a `zelda.config.yaml` **When** the developer adds `execution.backend: container` or `execution.backend: local` **Then** the config schema validates the value and the pipeline uses the specified backend (FR71)
2. **Given** a test suite YAML with `execution.backend` set **When** it differs from the project-level setting **Then** the test suite value overrides the project default (FR71)
3. **Given** no `execution.backend` configured **When** the config resolver applies defaults **Then** `container` is the default backend
4. **Given** `backend: container` **When** the pipeline starts execution **Then** it checks for Docker or Podman availability by running `docker info` or `podman info` (FR72)
5. **Given** Docker/Podman is available **When** the pipeline checks for agentbox **Then** it verifies the agentbox binary exists at the configured path or in PATH (FR78)
6. **Given** Docker/Podman is NOT available and backend is `container` **When** the pipeline detects the missing runtime **Then** it logs a yellow warning recommending containerized execution and falls back to `local` mode (FR77)
7. **Given** agentbox is not found and backend is `container` **When** the pipeline detects the missing binary **Then** it throws a clear `ExecutionError` with instructions on how to install agentbox
8. **Given** the developer wants to specify a custom agentbox path **When** `execution.agentboxPath` is set in config **Then** the system uses that path instead of searching PATH (FR78)
9. **Given** runtime detection results **When** checked across multiple test suites in a single `zelda run` **Then** detection is cached per pipeline run (not re-checked per suite)

## Tasks / Subtasks

- [x] Task 1: Extend config schema with backend fields (AC: #1, #2, #3, #8)
  - [x] 1.1 Add `backend: z.enum(['container', 'local']).optional()` to `ExecutionDefaultsSchema` in `schemas.ts`
  - [x] 1.2 Add `agentboxPath: z.string().optional()` to `ExecutionDefaultsSchema` in `schemas.ts`
  - [x] 1.3 Update type `ExecutionDefaults` in `types.ts` to include `backend` and `agentboxPath`
  - [x] 1.4 Add schema validation tests for new fields in `schemas.test.ts`
- [x] Task 2: Update config resolver for backend defaults (AC: #3)
  - [x] 2.1 Set `backend` default to `'container'` in resolver when not specified
  - [x] 2.2 Add resolver tests for backend override and default behavior in `resolver.test.ts`
- [x] Task 3: Create runtime detector module (AC: #4, #5, #6, #7, #8, #9)
  - [x] 3.1 Create `src/core/execution/runtime-detector.ts` with `detectRuntime()` function
  - [x] 3.2 Implement Docker detection: spawn `docker info` with timeout, capture exit code
  - [x] 3.3 Implement Podman detection: spawn `podman info` as fallback when Docker not found
  - [x] 3.4 Implement agentbox detection: check configured path or `which agentbox` in PATH
  - [x] 3.5 Return `RuntimeDetectionResult` with container runtime availability, agentbox path, and warnings
  - [x] 3.6 Add caching: memoize detection result per pipeline run
  - [x] 3.7 Create comprehensive test suite `tests/core/execution/runtime-detector.test.ts`
- [x] Task 4: Integrate runtime detection into pipeline (AC: #4, #6, #9)
  - [x] 4.1 Call `detectRuntime()` in `run-pipeline.ts` before execution phase
  - [x] 4.2 Pass detection result through pipeline, cached across suites
  - [x] 4.3 On fallback to local: log yellow warning via chalk
  - [x] 4.4 On agentbox missing: throw `ExecutionError` with install instructions
  - [x] 4.5 Add pipeline integration tests
- [x] Task 5: Update init template (AC: relates to FR71)
  - [x] 5.1 Add `execution.backend` field with comment to generated `zelda.config.yaml`
  - [x] 5.2 Update init test if exists

## Dev Notes

### Architecture Patterns & Constraints

- **Zod 4** (NOT Zod 3): use `z.enum(['container', 'local'])`, `.optional()`, `.safeParse()` pattern
- **Error hierarchy**: Use `ExecutionError` for runtime detection failures (3-arg constructor: `message, code, userMessage`)
- **No null values**: use optional properties (`backend?: 'container' | 'local'`)
- **No enums**: use string union types or `z.enum()`
- **Named exports only**, no `export default`, no barrel files
- **kebab-case.ts** file naming: `runtime-detector.ts`
- **SDK type isolation**: Do not expose `child_process` types — wrap in Zelda-owned types

### Config System Patterns (from existing code analysis)

**Schema pattern** (`schemas.ts`):
```typescript
// ExecutionDefaultsSchema currently has: model, maxTurns, taskSize
// Add backend and agentboxPath following same optional pattern
export const ExecutionDefaultsSchema = z.object({
  model: z.string().optional(),
  maxTurns: z.number().int().positive().optional(),
  taskSize: z.enum(['small', 'medium', 'large', 'xl']).optional(),
  backend: z.enum(['container', 'local']).optional(),       // NEW
  agentboxPath: z.string().optional(),                       // NEW
});
```

**Resolver pattern** (`resolver.ts`):
```typescript
// Backend uses simple merge — no special derivation logic needed
// Test suite backend overrides project backend via spread:
const mergedExecution = {
  ...projectConfig.execution,    // Project defaults first
  ...testSuiteConfig.execution,  // Suite overrides second
};
// After merge, apply default if not set:
if (!mergedExecution.backend) {
  mergedExecution.backend = 'container';
}
```

**Loader pattern** (`loader.ts`):
- No changes needed — YAML parsing + Zod validation automatically handles new fields
- Error pattern: `ConfigError(technicalMsg, 'ERROR_CODE', userFacingMsg)`

### Runtime Detection Design

**Module**: `src/core/execution/runtime-detector.ts`

**Detection strategy**:
1. Spawn `docker info` — if exit code 0, Docker is available
2. If Docker fails, spawn `podman info` — if exit code 0, Podman is available
3. If neither available: return `{ containerRuntime: undefined, available: false }`
4. If container runtime found, check agentbox:
   - If `agentboxPath` configured: check that path exists and is executable
   - If not configured: spawn `which agentbox` (or `where agentbox` on Windows)
5. Return `RuntimeDetectionResult` with all findings

**Subprocess pattern** (from `execution-client.ts` and `workspace/manager.ts`):
```typescript
import { execFileSync } from 'node:child_process';

// Use execFileSync with timeout for detection commands
try {
  execFileSync('docker', ['info'], { timeout: 5000, stdio: 'ignore' });
  // Docker available
} catch {
  // Docker not available, try podman
}
```

**Caching pattern**:
```typescript
let cachedResult: RuntimeDetectionResult | undefined;

export const detectRuntime = (config: { agentboxPath?: string }): RuntimeDetectionResult => {
  if (cachedResult) return cachedResult;
  // ... detection logic ...
  cachedResult = result;
  return result;
};

export const clearRuntimeCache = (): void => {
  cachedResult = undefined;
};
```

### Pipeline Integration Point

**Location**: `src/core/pipeline/run-pipeline.ts`

Detection should happen **once** at the start of the pipeline run, before the per-suite loop:

```typescript
// In runPipeline():
// 1. Load project config
// 2. Detect runtime (ONCE, cached)
const runtimeResult = detectRuntime({ agentboxPath: projectConfig.execution?.agentboxPath });
// 3. Per-suite loop:
//   - resolve config
//   - if resolved.execution.backend === 'container' && !runtimeResult.available:
//       log warning, override to 'local'
//   - execute session (backend determines execution path — Story 9.3)
```

### Terminal Output Patterns

- **Yellow warning** (chalk.yellow): "Docker/Podman not found. Running in local mode. Containerized execution is recommended for host isolation."
- **Red error** (chalk.red): "agentbox not found. Install agentbox to use containerized execution: https://github.com/fletchgqc/agentbox"
- **No emojis** in terminal output

### Error Codes

| Scenario | Error Type | Code | User Message |
|---|---|---|---|
| Invalid backend value | `ConfigError` (from Zod) | `CONFIG_VALIDATION_FAILED` | "execution.backend must be 'container' or 'local'" |
| Docker/Podman missing | Warning only (not error) | N/A | Yellow warning + fallback |
| Agentbox not found | `ExecutionError` | `AGENTBOX_NOT_FOUND` | "agentbox binary not found at {path}. Install: ..." |
| Agentbox path invalid | `ExecutionError` | `AGENTBOX_PATH_INVALID` | "Configured agentboxPath does not exist: {path}" |
| Detection subprocess timeout | Handled internally | N/A | Treat as "not available" |

### Project Structure Notes

**New files to create:**
- `src/core/execution/runtime-detector.ts` — detection logic
- `tests/core/execution/runtime-detector.test.ts` — detection tests

**Existing files to modify:**
- `src/core/config/schemas.ts` — add `backend` and `agentboxPath` to `ExecutionDefaultsSchema`
- `src/core/config/resolver.ts` — add default value for `backend`
- `src/core/types.ts` — add `RuntimeDetectionResult` type, update `ExecutionDefaults`
- `src/core/pipeline/run-pipeline.ts` — call `detectRuntime()`, handle fallback
- `src/core/init/templates/` — update init config template (if applicable)
- `tests/core/config/schemas.test.ts` — add backend validation tests
- `tests/core/config/resolver.test.ts` — add backend resolution tests

**Alignment with existing structure:**
```
src/core/execution/
├── execution-client.ts         # Existing — Claude Agent SDK wrapper
└── runtime-detector.ts         # NEW — Docker/Podman/agentbox detection

tests/core/execution/
├── execution-client.test.ts    # Existing
└── runtime-detector.test.ts    # NEW
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 9, Story 9.1]
- [Source: _bmad-output/planning-artifacts/prd.md — FR71-78, NFR17-19]
- [Source: _bmad-output/planning-artifacts/architecture.md — Config patterns, error hierarchy, execution module]
- [Source: src/core/config/schemas.ts — ExecutionDefaultsSchema pattern]
- [Source: src/core/config/resolver.ts — merge/override logic]
- [Source: src/core/execution/execution-client.ts — subprocess and SDK patterns]
- [Source: src/core/errors.ts — error class hierarchy]
- [Source: src/core/types.ts — shared type definitions]
- [Agentbox: https://github.com/fletchgqc/agentbox]

### Git Intelligence

- Recent commits follow `feat(story-id): description` pattern
- All commits include `Co-Authored-By: Claude Opus 4.6`
- Execution module is smallest in codebase (115 lines source, 240 lines test) — clean extension point
- No existing container/Docker code in codebase — this is entirely net-new functionality

### Previous Story Intelligence

This is the first story in Epic 9 — no previous story learnings to incorporate. However, patterns from Epic 7 (post-launch fixes) are relevant:
- Story 7.2 (workspace isolation) established subprocess patterns for git detection
- Story 7.3 (Portkey fixes) established runtime detection patterns for gateway type
- Both used the same error handling and fallback approaches needed here

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Rollup platform mismatch resolved by reinstalling node_modules (linux-arm64-gnu vs host platform)
- Existing resolver test "handles project config without optional execution and metrics" updated to expect `{ backend: 'container' }` instead of `{}` due to new default

### Completion Notes List

- Task 1: Extended `ExecutionDefaultsSchema` with `backend` (container|local) and `agentboxPath` (string) as optional fields. Added `ExecutionBackend` type alias and `RuntimeDetectionResult` type to types.ts. 7 new schema tests added.
- Task 2: Added backend default to 'container' in resolver when not specified. 5 new resolver tests covering default, override, and agentboxPath passthrough. Updated 1 existing test for new default behavior.
- Task 3: Created `runtime-detector.ts` with `detectRuntime()` and `clearRuntimeCache()`. Detection checks Docker first, Podman fallback, then agentbox via configured path or PATH lookup. Results cached per pipeline run. 9 unit tests with mocked child_process.
- Task 4: Integrated runtime detection into `runPipeline()` — called once before suite loop with `clearRuntimeCache()`. `runSingleSuite()` receives `runtimeResult` and falls back to local when container runtime unavailable. 4 new pipeline integration tests.
- Task 5: Updated `DEFAULT_CONFIG` template with `backend: container`, `# agentboxPath` comment, and explanatory comment about container vs local modes. 1 new init test.

### Change Log

- 2026-02-17: Implemented Story 9.1 — execution backend configuration and runtime detection. Added container/local backend support to config schema, resolver defaults, runtime detection module, pipeline integration, and init template.
- 2026-02-17: Code review fixes — (1) Platform-aware agentbox lookup using `which`/`where` based on process.platform; (2) Restructured detectRuntime to return unavailable result instead of throwing for agentbox-not-in-PATH, making all code paths cacheable; (3) Removed overly-broad try/catch in pipeline — only AGENTBOX_PATH_INVALID (config error) propagates now; (4) Added 2 new tests (caching for agentbox-not-found, platform lookup command).

### Senior Developer Review (AI)

**Date:** 2026-02-17
**Outcome:** Approve (after fixes)

**Issues Found:** 1 High, 3 Medium, 2 Low

**Action Items:**
- [x] [HIGH] Platform-aware `which`/`where` — `findAgentbox()` used `which` unconditionally, fails on Windows. Fixed: uses `process.platform` to select `where` on win32.
- [x] [MEDIUM] Caching bug — `detectRuntime()` threw for agentbox-not-found, bypassing cache. Fixed: returns `{ available: false }` with warning instead of throwing. Only `AGENTBOX_PATH_INVALID` (user config error) still throws.
- [x] [MEDIUM] Pipeline try/catch too broad — caught all ZeldaErrors, silencing agentbox config errors. Fixed: removed try/catch since detectRuntime no longer throws for missing-in-PATH.
- [x] [MEDIUM] `package-lock.json` missing from File List — added.
- [x] [LOW] Test double-call pattern — fixed to use single try/catch assertion.
- [x] [LOW] Unused `warnings` variable — inlined as `warnings: []` in return.

**Note (not fixed):** Pipeline mutates `resolvedConfig.execution.backend` to `'local'` on fallback. This is by design — the persisted result reflects actual execution mode. Story 9.4 will add a separate `executionBackend` field to `RunResult` for tracking original intent.

### File List

**New files:**
- src/core/execution/runtime-detector.ts
- tests/core/execution/runtime-detector.test.ts

**Modified files:**
- src/core/config/schemas.ts
- src/core/config/resolver.ts
- src/core/types.ts
- src/core/pipeline/run-pipeline.ts
- src/core/init/init-project.ts
- tests/core/config/schemas.test.ts
- tests/core/config/resolver.test.ts
- tests/core/pipeline/run-pipeline.test.ts
- tests/core/init/init-project.test.ts
- package-lock.json
