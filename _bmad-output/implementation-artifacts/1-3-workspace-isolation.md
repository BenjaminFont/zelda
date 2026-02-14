# Story 1.3: Workspace Isolation

Status: done

## Story

As a **developer using Zelda**,
I want each evaluation run to execute in an isolated workspace,
So that Zelda never modifies my working directory and cleans up after itself.

## Acceptance Criteria

1. **Given** a git repository **When** the workspace manager creates a workspace for a run **Then** a git worktree is created at `.zelda/workspaces/<run-id>/` containing a clean copy of the repo (FR11)

2. **Given** a non-git directory **When** the workspace manager creates a workspace **Then** it falls back to directory copy (FR12)

3. **Given** a completed or failed run **When** the workspace cleanup runs **Then** the worktree is removed and the directory is deleted (FR16)

4. **Given** a run is interrupted by Ctrl+C (SIGINT) **When** the signal handler fires **Then** workspace cleanup executes before exit (NFR16)

5. **Given** orphaned workspaces from a previous crash exist in `.zelda/workspaces/` **When** `zelda run` starts **Then** the sweeper detects and removes them before proceeding (NFR16)

6. **Given** any execution path (success, error, interrupt, crash recovery) **When** the workspace lifecycle completes **Then** no files in the developer's working directory are modified (NFR13)

## Tasks / Subtasks

- [x] Task 1: Implement workspace manager with git worktree support (AC: #1, #3)
  - [x]1.1 Create src/core/workspace/manager.ts with createWorkspace function
  - [x]1.2 Implement git worktree creation at .zelda/workspaces/<run-id>/
  - [x]1.3 Implement cleanupWorkspace function to remove worktree and directory
  - [x]1.4 Implement directory copy fallback for non-git repos (AC: #2)
- [x] Task 2: Implement workspace sweeper for orphan cleanup (AC: #5)
  - [x]2.1 Create src/core/workspace/sweeper.ts with sweepOrphanedWorkspaces function
  - [x]2.2 Scan .zelda/workspaces/ for leftover directories
  - [x]2.3 Remove orphaned worktrees and directories
- [x] Task 3: Write comprehensive tests (AC: #1-6)
  - [x]3.1 Create tests/core/workspace/manager.test.ts
  - [x]3.2 Test worktree creation and cleanup in git repos
  - [x]3.3 Test directory copy fallback for non-git
  - [x]3.4 Test cleanup after errors
  - [x]3.5 Create tests/core/workspace/sweeper.test.ts

## Dev Notes

### Architecture Requirements

From architecture.md:
- Triple-layer cleanup: try/finally + signal handlers + startup sweep
- Workspace location: `.zelda/workspaces/<run-id>/`
- Git worktree for git repos, directory copy fallback for non-git

### References

- [Source: architecture.md#Workspace Isolation]
- [Source: epics.md#Story 1.3]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Completion Notes List

- Implemented workspace manager: createWorkspace (git worktree + dir copy fallback), cleanupWorkspace, registerCleanupHandlers (SIGINT/SIGTERM)
- Implemented sweeper: sweepOrphanedWorkspaces scans .zelda/workspaces/ and removes orphaned worktrees/directories
- Non-git copy excludes node_modules, .zelda, .git, dist via entry-level iteration to avoid self-copy issues
- Git worktree created with HEAD --detach for clean workspace isolation
- 11 new tests (manager: 7, sweeper: 4), all 67 total tests passing
- TypeScript typecheck clean

### Change Log

- 2026-02-14: Story 1.3 implemented — workspace manager, sweeper, cleanup handlers

### File List

- src/core/workspace/manager.ts (new)
- src/core/workspace/sweeper.ts (new)
- tests/core/workspace/manager.test.ts (new)
- tests/core/workspace/sweeper.test.ts (new)
