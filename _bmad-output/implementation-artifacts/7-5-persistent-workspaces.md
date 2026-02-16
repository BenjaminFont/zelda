# Story 7.5: Persistent Git Worktree Workspaces

Status: done

## Story

As a **developer using Zelda**,
I want evaluation workspaces to persist after a run instead of being automatically deleted,
So that I can inspect the generated code, run it manually, and debug issues — with a `zelda clean` command to remove old workspaces when done.

## Acceptance Criteria

1. **Given** a completed evaluation run **When** the pipeline finishes **Then** the workspace at `.zelda/workspaces/<run-id>` is NOT deleted and remains accessible

2. **Given** a run interrupted by Ctrl+C (SIGINT) or SIGTERM **When** the process exits **Then** the workspace is NOT deleted (partial work is still inspectable)

3. **Given** a completed run **When** the terminal report is displayed **Then** the workspace path is shown in the run header so the user knows where to find the generated code

4. **Given** a completed run **When** the result is persisted to `result.json` **Then** the `workspacePath` field is included in the run result

5. **Given** historical `result.json` files without `workspacePath` **When** loaded by list or compare commands **Then** they still parse correctly (backward compatible)

6. **Given** accumulated workspaces **When** the user runs `zelda clean` **Then** ALL workspaces in `.zelda/workspaces/` are removed (git worktree remove + rmSync fallback)

7. **Given** a specific run ID **When** the user runs `zelda clean <run-id>` **Then** only that workspace is removed, others are untouched

8. **Given** a non-git project or monorepo subdirectory **When** a run is started **Then** directory copy fallback still works (unchanged behavior)

## Tasks / Subtasks

- [x] Task 1: Add workspacePath to RunResult type (AC: #4, #5)
  - [x] 1.1 Add `workspacePath?: string` to `RunResult` in `src/core/types.ts`

- [x] Task 2: Remove automatic cleanup from pipeline (AC: #1, #2)
  - [x] 2.1 Remove imports of `cleanupWorkspace` and `registerCleanupHandlers` from `run-pipeline.ts`
  - [x] 2.2 Remove `deregister` variable and signal handler registration
  - [x] 2.3 Delete `finally` block that calls `cleanupWorkspace`
  - [x] 2.4 Add `workspacePath` to the `RunResult` object construction

- [x] Task 3: Remove `registerCleanupHandlers` from workspace manager (AC: #2)
  - [x] 3.1 Delete `registerCleanupHandlers` function from `src/core/workspace/manager.ts`
  - [x] 3.2 Keep `createWorkspace` and `cleanupWorkspace` exports (used by clean command)

- [x] Task 4: Extend sweeper with targeted cleanup (AC: #6, #7)
  - [x] 4.1 Add `listWorkspaces(projectDir)` — returns workspace directory names
  - [x] 4.2 Add `cleanSingleWorkspace(projectDir, runId)` — removes specific workspace, returns boolean
  - [x] 4.3 Add tests for both new functions

- [x] Task 5: Add `zelda clean` CLI command (AC: #6, #7)
  - [x] 5.1 Add `clean [run-id]` command to `src/cli.ts`
  - [x] 5.2 `zelda clean` removes all workspaces via `sweepOrphanedWorkspaces`
  - [x] 5.3 `zelda clean <run-id>` removes specific workspace via `cleanSingleWorkspace`

- [x] Task 6: Show workspace path in terminal reporter (AC: #3)
  - [x] 6.1 Add Workspace line to `renderRunHeader` when `run.workspacePath` is present
  - [x] 6.2 Add reporter tests for workspace display

- [x] Task 7: Update tests (AC: all)
  - [x] 7.1 Update pipeline test: remove cleanup mocks, delete "calls cleanupWorkspace" test, add workspacePath test
  - [x] 7.2 Update manager test: remove `registerCleanupHandlers` tests if any
  - [x] 7.3 Add sweeper tests: `cleanSingleWorkspace`, `listWorkspaces`
  - [x] 7.4 Add reporter tests: workspace path in header

## Dev Notes

### Architecture

The core change is removing the `finally` block in `runSingleSuite()` that destroys the workspace. Everything else flows from that:
- No cleanup → no signal handlers needed → remove `registerCleanupHandlers`
- Workspaces accumulate → need `zelda clean` command
- Users need to find workspaces → show path in terminal reporter
- Results should reference workspace → add `workspacePath` to `RunResult`

### Current Cleanup Flow (to be removed)

```
runSingleSuite() {
  try { ... }
  finally {
    if (deregister) deregister();            // ← remove
    if (workspacePath) cleanupWorkspace();   // ← remove
  }
}
```

### Workspace Location

Stays at `.zelda/workspaces/<run-id>` (already gitignored). Git worktrees for repo-root projects, directory copy for monorepo subdirectories / non-git — no change to creation logic.

### Files to Modify

| File | Change |
|------|--------|
| `src/core/types.ts` | Add `workspacePath?: string` to `RunResult` |
| `src/core/workspace/manager.ts` | Delete `registerCleanupHandlers` function |
| `src/core/pipeline/run-pipeline.ts` | Remove cleanup, add workspacePath to result |
| `src/core/workspace/sweeper.ts` | Add `cleanSingleWorkspace`, `listWorkspaces` |
| `src/cli.ts` | Add `zelda clean [run-id]` command |
| `src/core/reporter/terminal-reporter.ts` | Show workspace path in run header |
| `tests/core/pipeline/run-pipeline.test.ts` | Remove cleanup tests, add workspacePath test |
| `tests/core/workspace/manager.test.ts` | Remove registerCleanupHandlers tests |
| `tests/core/workspace/sweeper.test.ts` | Add cleanSingleWorkspace + listWorkspaces tests |
| `tests/core/reporter/terminal-reporter.test.ts` | Add workspace path display tests |

### Risks

- **Disk space**: Workspaces accumulate. Mitigated by `zelda clean`. Could add age-based retention later.
- **Git worktree accumulation**: Many detached worktrees could slow `git worktree list`. `zelda clean` handles this.
- **Absolute paths in result.json**: `workspacePath` is machine-specific. Fine for local use, meaningless if results are shared. Acceptable for a local eval tool.

### References

- [Source: src/core/pipeline/run-pipeline.ts#L140-146] — Current finally block to remove
- [Source: src/core/workspace/manager.ts#L104-130] — registerCleanupHandlers to delete
- [Source: src/core/workspace/sweeper.ts] — Existing sweep logic to extend
- [Source: src/core/reporter/terminal-reporter.ts#L193-201] — renderRunHeader to extend

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- All 7 tasks and 15 subtasks completed
- 426 tests pass (8 new tests added, up from 418), zero regressions
- TypeScript typecheck passes, build succeeds
- Key changes:
  - `workspacePath?: string` added to `RunResult` type (backward compatible)
  - `registerCleanupHandlers` deleted from workspace manager
  - Pipeline `finally` block removed — workspaces persist after runs
  - `listWorkspaces()` and `cleanSingleWorkspace()` added to sweeper
  - `zelda clean [run-id]` CLI command added
  - Workspace path shown in terminal reporter header
  - README updated: `zelda clean` docs, workspaces described as persistent

### File List

- `src/core/types.ts` — Added `workspacePath?: string` to `RunResult`
- `src/core/workspace/manager.ts` — Deleted `registerCleanupHandlers` function
- `src/core/pipeline/run-pipeline.ts` — Removed cleanup imports/logic/finally block, added workspacePath to result
- `src/core/workspace/sweeper.ts` — Added `listWorkspaces` and `cleanSingleWorkspace` exports
- `src/cli.ts` — Added `zelda clean [run-id]` command
- `src/core/reporter/terminal-reporter.ts` — Added Workspace line to `renderRunHeader`
- `README.md` — Updated pipeline description, added `zelda clean` docs, updated project structure
- `tests/core/pipeline/run-pipeline.test.ts` — Removed cleanup mocks/test, added workspacePath test
- `tests/core/workspace/sweeper.test.ts` — Added 6 tests for `listWorkspaces` and `cleanSingleWorkspace`
- `tests/core/reporter/terminal-reporter.test.ts` — Added 2 tests for workspace path display

## Change Log

- 2026-02-16: Implemented Story 7.5 — Workspaces now persist after evaluation runs for code inspection. Added `zelda clean` command for manual workspace removal. Removed automatic cleanup and signal handlers from pipeline.
