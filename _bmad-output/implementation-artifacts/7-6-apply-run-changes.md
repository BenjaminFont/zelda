# Story 7.6: Apply Run Changes to Project

Status: done

## Story

As a **developer using Zelda**,
I want to apply the code changes from an evaluation run's workspace back to my real project,
So that I can adopt Claude's generated code without manually copying files or crafting git patches.

## Acceptance Criteria

1. **Given** a completed run with a persisted workspace **When** the user runs `zelda apply <run-id>` **Then** all uncommitted changes from the workspace are applied to the project working directory

2. **Given** a run ID **When** the user runs `zelda apply <run-id> --dry-run` **Then** the diff is displayed (file list + stats) but no changes are made to the project

3. **Given** a run ID pointing to a nonexistent workspace **When** the user runs `zelda apply <run-id>` **Then** a clear error is displayed: "Workspace not found for run: <run-id>"

4. **Given** a git worktree workspace **When** `zelda apply` runs **Then** changes are extracted via `git diff` in the workspace and applied via `git apply` in the project directory

5. **Given** a directory-copy workspace (non-git) **When** `zelda apply` runs **Then** changes are extracted by diffing workspace files against the project and copying modified/new files

6. **Given** changes that conflict with the project's current state **When** `zelda apply` runs **Then** the error from `git apply` is surfaced to the user with a suggestion to use `--3way` or resolve manually

7. **Given** a successful apply **When** the command completes **Then** the output shows how many files were changed, added, or deleted

## Tasks / Subtasks

- [x] Task 1: Create apply module (AC: #1, #4, #5)
  - [x] 1.1 Create `src/core/apply/apply-changes.ts` with `applyRunChanges(projectDir, runId, options)` function
  - [x] 1.2 For git workspaces: generate diff with `git diff HEAD` in workspace, apply with `git apply` in project
  - [x] 1.3 For non-git workspaces: fall back to file copy from workspace to project (new/modified files)

- [x] Task 2: Add dry-run support (AC: #2)
  - [x] 2.1 Add `dryRun` option to `applyRunChanges`
  - [x] 2.2 In dry-run mode: show `git diff --stat HEAD` output from the workspace but don't apply

- [x] Task 3: Add `zelda apply` CLI command (AC: #1, #2, #3, #6, #7)
  - [x] 3.1 Add `apply <run-id>` command to `src/cli.ts` with `--dry-run` flag
  - [x] 3.2 Resolve workspace path from `.zelda/workspaces/<run-id>`
  - [x] 3.3 Display summary (files changed/added/deleted) on success
  - [x] 3.4 Display clear error messages for missing workspace or apply conflicts

- [x] Task 4: Add tests (AC: all)
  - [x] 4.1 Test apply from git worktree workspace (creates diff, applies to project)
  - [x] 4.2 Test dry-run shows stats without modifying project
  - [x] 4.3 Test error when workspace doesn't exist
  - [x] 4.4 Test non-git workspace fallback (file copy)

## Dev Notes

### Architecture

The core logic lives in a new module `src/core/apply/apply-changes.ts`. It:
1. Checks if the workspace exists at `.zelda/workspaces/<run-id>`
2. Detects whether it's a git worktree (has `.git` file) or directory copy
3. For git: runs `git diff HEAD` in workspace, then `git apply` in project dir
4. For non-git: walks workspace files and copies changed ones to project dir
5. Returns a summary of changes applied

### Git Diff Strategy

In a worktree created with `git worktree add ... HEAD --detach`, the HEAD is the same commit as the main repo. So `git diff HEAD` gives exactly the changes Claude made during the session. We pipe that diff to `git apply` in the project root.

### Files to Create/Modify

| File | Change |
|------|--------|
| `src/core/apply/apply-changes.ts` | New: apply logic (git diff + apply, directory copy fallback) |
| `src/cli.ts` | Add `apply <run-id>` command with `--dry-run` flag |
| `tests/core/apply/apply-changes.test.ts` | New: tests for apply module |

### Risks

- **Merge conflicts**: If the user has modified files since the run, `git apply` may fail. Surface the error clearly and suggest `--3way`.
- **Untracked files in workspace**: `git diff HEAD` only shows tracked file changes. New files need `git diff HEAD --no-index` or `git status` handling. Use `git diff HEAD` with `--include-untracked` strategy.
- **Large diffs**: For very large workspaces, piping the diff could be slow. Acceptable for a local tool.

### References

- [Source: src/core/workspace/manager.ts] — Workspace creation (git worktree vs directory copy)
- [Source: src/core/workspace/sweeper.ts] — Workspace path resolution pattern
- [Source: src/cli.ts] — CLI command patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- All 4 tasks and 11 subtasks completed
- 435 tests pass (9 new tests added, up from 426), zero regressions
- TypeScript typecheck passes, build succeeds
- Key changes:
  - `applyRunChanges(projectDir, runId, options)` — extracts diff from workspace, applies to project
  - Git worktree path: `git add -A && git diff --cached HEAD` → `git apply` in project
  - Directory-copy path: recursive file comparison + copy for changed/new files
  - `--dry-run` flag shows diff stats without applying
  - Error handling for missing workspace and apply conflicts
  - README updated with `zelda apply` docs

### File List

- `src/core/apply/apply-changes.ts` — New: apply module with git and directory-copy strategies
- `src/cli.ts` — Added `apply <run-id>` command with `--dry-run` flag
- `README.md` — Added `zelda apply` docs
- `tests/core/apply/apply-changes.test.ts` — New: 9 tests for apply module

## Change Log

- 2026-02-16: Implemented Story 7.6 — Added `zelda apply <run-id>` command to apply workspace changes back to the real project. Supports git worktree (diff + apply) and directory-copy (file comparison + copy) workspaces.
