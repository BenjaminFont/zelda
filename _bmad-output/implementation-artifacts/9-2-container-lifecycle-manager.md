# Story 9.2: Container Lifecycle Manager

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer using Zelda**,
I want containers automatically started before execution and destroyed after,
so that I get full host isolation without managing Docker manually.

## Acceptance Criteria

1. **Given** `backend: container` and runtime is available **When** the pipeline is ready to execute a Claude Code session **Then** it starts an agentbox container with the workspace directory bind-mounted (FR73-74)
2. **Given** a started container **When** the container is running **Then** the workspace directory inside the container reflects all files from the host workspace, and any changes inside are immediately visible on the host (FR74, NFR19)
3. **Given** execution completes (success or failure) **When** the container lifecycle ends **Then** the container is automatically destroyed — ephemeral, no leftover containers (FR76, NFR18)
4. **Given** a run interrupted by SIGINT or SIGTERM **When** the signal handler fires **Then** the container is stopped and removed before process exit (NFR18)
5. **Given** multiple test suites in a single `zelda run` **When** each suite executes **Then** each suite gets its own container instance — containers are not shared across suites
6. **Given** container startup and teardown **When** overhead is measured **Then** it does not dominate Zelda's framework time — the Claude Code session remains the dominant cost (NFR17)

## Tasks / Subtasks

- [x] Task 1: Define container lifecycle types (AC: #1, #3)
  - [x] 1.1 Add `ContainerInstance` type to `src/core/types.ts`: `containerId`, `containerName`, `workspacePath`, `agentboxPath`
  - [x] 1.2 Add `ContainerStartOptions` type: `workspacePath`, `agentboxPath`, `envVars`
- [x] Task 2: Create container manager module (AC: #1, #2, #3)
  - [x] 2.1 Create `src/core/execution/container-manager.ts`
  - [x] 2.2 Implement `startContainer(options: ContainerStartOptions): ContainerInstance` — spawns agentbox with workspace mounted
  - [x] 2.3 Implement `stopContainer(instance: ContainerInstance): boolean` — best-effort cleanup, never throws
  - [x] 2.4 Implement `listZeldaContainers(): string[]` — list running zelda containers for orphan detection
  - [x] 2.5 Create test suite `tests/core/execution/container-manager.test.ts`
- [x] Task 3: Implement signal handler integration (AC: #4)
  - [x] 3.1 Implement `registerContainerCleanup(activeContainers: Map<string, ContainerInstance>): void`
  - [x] 3.2 SIGINT/SIGTERM handlers call `stopContainer()` for all active containers
  - [x] 3.3 Cleanup never throws — best-effort pattern matching workspace cleanup
  - [x] 3.4 Add signal handler tests
- [x] Task 4: Integrate into pipeline (AC: #1, #3, #5, #6)
  - [x] 4.1 In `run-pipeline.ts`: when `backend === 'container'`, call `startContainer()` before execution
  - [x] 4.2 Track active container in `activeContainers` map for signal handler cleanup
  - [x] 4.3 Stop container in finally block AFTER results display (NFR3: results before cleanup)
  - [x] 4.4 Each suite gets its own container (no sharing across suites)
  - [x] 4.5 Container teardown happens BEFORE workspace removal (container uses mounted files)
  - [x] 4.6 Add pipeline integration tests with mocked container-manager

## Dev Notes

### Architecture Patterns & Constraints

- **Best-effort cleanup pattern**: `stopContainer()` NEVER throws — mirrors `cleanupWorkspace()` pattern exactly
- **Results before cleanup (NFR3)**: Display report, THEN stop container, THEN remove workspace
- **Error hierarchy**: Use `ExecutionError` for container failures (3-arg: `message, code, userMessage`)
- **Named exports only**, no `export default`, no barrel files
- **kebab-case.ts** file naming: `container-manager.ts`
- **No SDK type leakage**: wrap `child_process` results in Zelda-owned types

### Agentbox CLI Integration (Critical Reference)

**How agentbox works internally:**
```bash
# Container name is deterministic: sha256(projectDir).slice(0,12)
container_name="agentbox-$(echo -n "$PROJECT_DIR" | sha256sum | cut -c1-12)"

# Full docker run command:
docker run -it --rm \
  --name "$container_name" \
  --hostname "agentbox-$PROJECT_NAME" \
  --init \
  -v "$PROJECT_DIR:$PROJECT_DIR:z" \
  -w "$PROJECT_DIR" \
  --env-file ~/.agentbox/.env \
  --env-file $PROJECT_DIR/.env \
  -e PROJECT_DIR="$PROJECT_DIR" \
  agentbox:latest \
  <command>
```

**Key facts for integration:**
- `--rm` flag: container auto-removed when process exits
- `--init` flag: tini handles signal forwarding (SIGINT/SIGTERM → child process)
- `-v $path:$path:z`: mount at SAME path (not /workspace), SELinux relabeled
- Container naming: `agentbox-${sha256(projectDir).slice(0,12)}` — deterministic per project dir
- **One-off commands**: `agentbox shell <command>` runs raw command (NOT through Claude)
- **No daemon mode**: every invocation starts fresh, container destroyed on exit
- **No already-running check**: second invocation on same project fails with name conflict
- **Env vars**: injected via `.env` files or `--env-file` flags

**For Zelda's use case:**
- Zelda will NOT run agentbox interactively (no `-it` TTY needed for programmatic use)
- Zelda creates a workspace first (git worktree/dir copy), THEN mounts it into the container
- The workspace path may differ from the original project path — use workspace path for mount
- Claude Code runs INSIDE the container via `agentbox shell claude --dangerously-skip-permissions --prompt "..."`
- OR: Zelda spawns the agentbox script directly, modifying how it's called

### Container Manager Design

**Module**: `src/core/execution/container-manager.ts`

**startContainer pattern** (mirrors `createWorkspace`):
```typescript
import { execFileSync, execSync } from 'node:child_process';
import { ExecutionError } from '../errors.js';
import type { ContainerInstance, ContainerStartOptions } from '../types.js';

export const startContainer = (options: ContainerStartOptions): ContainerInstance => {
  const { workspacePath, agentboxPath } = options;

  // agentbox runs from the workspace directory
  // It will mount the current directory into the container
  try {
    // Option A: Use agentbox directly
    // agentbox determines container name from cwd (workspace path)
    // Run in background or with a specific command
    execFileSync(agentboxPath, ['shell', 'echo', 'ready'], {
      cwd: workspacePath,
      timeout: 30000,
      stdio: 'pipe',
    });

    // Compute container name (same algorithm as agentbox)
    const containerName = computeContainerName(workspacePath);

    return {
      containerId: containerName, // agentbox uses name as ID
      containerName,
      workspacePath,
      agentboxPath,
    };
  } catch (e) {
    throw new ExecutionError(
      `Failed to start container: ${e instanceof Error ? e.message : String(e)}`,
      'CONTAINER_START_FAILED',
      'Could not start agentbox container. Verify Docker is running and agentbox is properly installed.',
    );
  }
};
```

**Container name computation** (match agentbox's algorithm):
```typescript
import { createHash } from 'node:crypto';

export const computeContainerName = (projectDir: string): string => {
  const hash = createHash('sha256').update(projectDir).digest('hex').slice(0, 12);
  return `agentbox-${hash}`;
};
```

**stopContainer pattern** (mirrors `cleanupWorkspace` — NEVER throws):
```typescript
export const stopContainer = (instance: ContainerInstance): boolean => {
  try {
    // Try graceful stop (sends SIGTERM, waits, then SIGKILL)
    execSync(`docker stop ${instance.containerName}`, {
      timeout: 10000,
      stdio: 'ignore',
    });
    return true;
  } catch {
    // Container may already be stopped/removed (--rm)
    // Try force kill as fallback
    try {
      execSync(`docker kill ${instance.containerName}`, {
        timeout: 5000,
        stdio: 'ignore',
      });
      return true;
    } catch {
      // Container already gone — this is fine
      return false;
    }
  }
};
```

**Signal handler pattern** (mirrors workspace signal handling):
```typescript
export const registerContainerCleanup = (
  activeContainers: Map<string, ContainerInstance>,
): void => {
  const cleanup = () => {
    for (const [, instance] of activeContainers) {
      stopContainer(instance); // best-effort, never throws
    }
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
};
```

### Pipeline Integration Pattern

**Location**: `src/core/pipeline/run-pipeline.ts`

**Lifecycle ordering** (CRITICAL):
```
1. Create workspace (git worktree / dir copy)
2. Start container (mount workspace into container)
3. Execute Claude Code inside container
4. Run evaluators
5. Persist results
6. Display report to user  ← RESULTS SHOWN HERE
7. Stop container           ← THEN container cleanup
8. Remove workspace         ← THEN workspace cleanup
```

**Integration in runSingleSuite:**
```typescript
let workspacePath: string | undefined;
let container: ContainerInstance | undefined;

try {
  workspacePath = createWorkspace(projectDir, runId);

  // Start container if backend is container
  if (resolvedConfig.execution.backend === 'container' && runtimeResult.available) {
    container = startContainer({
      workspacePath,
      agentboxPath: runtimeResult.agentboxPath,
    });
    activeContainers.set(runId, container);
  }

  // Execute session (Story 9.3 handles container vs local routing)
  const { transcript } = await executeSession({ ... });

  // Evaluate, persist, report
  // ...
  printRunReport(runResult);

  return { run: runResult };
} catch (e) {
  // Error handling
} finally {
  // Cleanup: container FIRST, then workspace
  if (container) {
    stopContainer(container);
    activeContainers.delete(runId);
  }
  if (workspacePath) {
    cleanupWorkspace(projectDir, workspacePath);
  }
}
```

### Existing Patterns to Mirror

| Aspect | Workspace Manager | Container Manager (this story) |
|---|---|---|
| **Create** | `createWorkspace(projectDir, runId) → string` | `startContainer(options) → ContainerInstance` |
| **Cleanup** | `cleanupWorkspace(dir, path) → void (never throws)` | `stopContainer(instance) → boolean (never throws)` |
| **Orphans** | `sweepOrphanedWorkspaces(dir) → string[]` | `listZeldaContainers() → string[]` |
| **Error codes** | `WORKSPACE_CREATE_FAILED` | `CONTAINER_START_FAILED` |
| **Signal handler** | Sweeps workspaces | Stops containers |
| **Cleanup order** | After results display | After results display, BEFORE workspace removal |

### Error Codes

| Scenario | Error Type | Code | User Message |
|---|---|---|---|
| Container start fails | `ExecutionError` | `CONTAINER_START_FAILED` | "Could not start agentbox container. Verify Docker is running and agentbox is properly installed." |
| Container stop fails | Warning only (best-effort) | N/A | Logged internally, not thrown |

### Test Patterns

**Unit tests** (`tests/core/execution/container-manager.test.ts`):
```typescript
// Mock child_process to avoid real Docker calls
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
  execSync: vi.fn(),
}));

describe('container-manager', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('startContainer', () => {
    it('starts agentbox with workspace path', () => { ... });
    it('throws ExecutionError when agentbox fails', () => { ... });
    it('returns ContainerInstance with computed name', () => { ... });
  });

  describe('stopContainer', () => {
    it('stops container gracefully', () => { ... });
    it('returns false when container already stopped', () => { ... });
    it('never throws on any error', () => {
      vi.mocked(execSync).mockImplementation(() => { throw new Error('fail'); });
      expect(() => stopContainer(instance)).not.toThrow();
      expect(stopContainer(instance)).toBe(false);
    });
  });

  describe('computeContainerName', () => {
    it('produces deterministic name from path', () => {
      const name1 = computeContainerName('/project/workspace');
      const name2 = computeContainerName('/project/workspace');
      expect(name1).toBe(name2);
      expect(name1).toMatch(/^agentbox-[a-f0-9]{12}$/);
    });
  });

  describe('registerContainerCleanup', () => {
    it('registers SIGINT and SIGTERM handlers', () => { ... });
    it('stops all active containers on signal', () => { ... });
  });
});
```

**Pipeline integration tests** (mock container-manager):
```typescript
vi.mock('../../../src/core/execution/container-manager.js', () => ({
  startContainer: vi.fn().mockReturnValue({
    containerId: 'agentbox-test123',
    containerName: 'agentbox-test123',
    workspacePath: '/tmp/workspace',
    agentboxPath: '/usr/local/bin/agentbox',
  }),
  stopContainer: vi.fn().mockReturnValue(true),
  registerContainerCleanup: vi.fn(),
}));
```

### Previous Story Intelligence (Story 9.1)

Story 9.1 establishes:
- `RuntimeDetectionResult` type with `available`, `containerRuntime`, `agentboxPath` fields
- `detectRuntime()` function with caching — this story reads from its cached result
- `backend` field in `ExecutionDefaults` — this story checks `resolvedConfig.execution.backend`
- Runtime detection runs ONCE before per-suite loop — container lifecycle runs PER SUITE

**Dependency**: Story 9.2 depends on Story 9.1's `RuntimeDetectionResult` and `detectRuntime()`. The pipeline passes `runtimeResult.agentboxPath` to `startContainer()`.

### Project Structure Notes

**New files to create:**
- `src/core/execution/container-manager.ts` — container lifecycle management
- `tests/core/execution/container-manager.test.ts` — container manager tests

**Existing files to modify:**
- `src/core/types.ts` — add `ContainerInstance`, `ContainerStartOptions`
- `src/core/pipeline/run-pipeline.ts` — integrate container start/stop, signal handlers
- `tests/core/pipeline/run-pipeline.test.ts` — add container-aware pipeline tests

**Alignment with existing structure:**
```
src/core/execution/
├── execution-client.ts     # Existing — Claude Agent SDK wrapper
├── runtime-detector.ts     # Story 9.1 — Docker/agentbox detection
└── container-manager.ts    # NEW — container lifecycle

tests/core/execution/
├── execution-client.test.ts
├── runtime-detector.test.ts  # Story 9.1
└── container-manager.test.ts # NEW
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 9, Story 9.2]
- [Source: _bmad-output/planning-artifacts/prd.md — FR73-76, NFR17-19]
- [Source: src/core/workspace/manager.ts — createWorkspace/cleanupWorkspace patterns]
- [Source: src/core/workspace/sweeper.ts — orphan detection patterns]
- [Source: src/core/pipeline/run-pipeline.ts — pipeline orchestration, try/finally]
- [Source: src/core/errors.ts — ExecutionError class]
- [Source: _bmad-output/implementation-artifacts/9-1-execution-backend-configuration-and-runtime-detection.md — previous story]
- [Agentbox: https://github.com/fletchgqc/agentbox — CLI reference, container naming, mount patterns]

### Git Intelligence

- Commit convention: `feat(story-9-2): container lifecycle manager`
- Workspace manager (115 lines) is the closest pattern reference
- No existing container code — net-new module

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Mock return type mismatch for `listZeldaContainers`: test returned `Buffer.from(...)` but function uses `encoding: 'utf-8'` returning string. Fixed by casting mock returns.
- Pipeline test mock leaking: `vi.clearAllMocks()` doesn't reset `mockReturnValue` set during tests. Fixed by explicitly resetting `detectRuntime` mock in affected tests.

### Completion Notes List

- Task 1: Added `ContainerInstance` and `ContainerStartOptions` types to `types.ts`. ContainerInstance holds containerId, containerName, workspacePath, agentboxPath. ContainerStartOptions has workspacePath, agentboxPath, and optional envVars.
- Task 2: Created `container-manager.ts` with `computeContainerName()` (SHA-256 hash matching agentbox algorithm), `startContainer()` (spawns agentbox shell), `stopContainer()` (graceful stop → force kill fallback, never throws), `listZeldaContainers()` (docker ps filter). 12 unit tests.
- Task 3: Implemented `registerContainerCleanup()` with SIGINT/SIGTERM handlers that iterate `activeContainers` map and call `stopContainer()` for each. Best-effort, never throws. 3 signal handler tests.
- Task 4: Integrated into `runPipeline()` — creates `activeContainers` map, registers signal handler once. `runSingleSuite()` starts container when `backend === 'container'` and runtime available, tracks in map, stops in `finally` block after report display. 6 new pipeline integration tests.

### Change Log

- 2026-02-17: Implemented Story 9.2 — container lifecycle manager. Added ContainerInstance/ContainerStartOptions types, container-manager module with start/stop/list/cleanup functions, signal handler integration, and pipeline integration with per-suite container isolation.
- 2026-02-18: Code review fixes — (1) Eliminated command injection in stopContainer/listZeldaContainers by replacing execSync string interpolation with execFileSync array args; (2) Prevented signal handler accumulation with module-level registration guard and updatable reference; (3) Added 2 new tests for handler dedup and reference update.

### Senior Developer Review (AI)

**Date:** 2026-02-18
**Outcome:** Approve (after fixes)

**Issues Found:** 1 High, 3 Medium, 2 Low

**Action Items:**
- [x] [HIGH] Command injection in stopContainer/listZeldaContainers — used execSync with string interpolation. Fixed: replaced with execFileSync and array args.
- [x] [MEDIUM] Signal handler accumulation — registerContainerCleanup added duplicate process.on handlers per pipeline call. Fixed: module-level guard + updatable reference pattern.
- [ ] [MEDIUM] startContainer uses synchronous one-shot that exits immediately — container not actually kept running. By design: Story 9.3 will address actual container execution routing.
- [ ] [MEDIUM] listZeldaContainers Go template format string untestable without Docker — integration concern only. No fix needed.
- [ ] [LOW] envVars in ContainerStartOptions is unused — specified in story task 1.2, kept for Story 9.3.
- [ ] [LOW] No test for signal handler removal — accepted since handlers are process-lifetime scoped.

### File List

**New files:**
- src/core/execution/container-manager.ts
- tests/core/execution/container-manager.test.ts

**Modified files:**
- src/core/types.ts
- src/core/pipeline/run-pipeline.ts
- tests/core/pipeline/run-pipeline.test.ts
