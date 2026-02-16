// Workspace manager — git worktree create/cleanup, directory copy fallback

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, cpSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { WorkspaceError } from '../errors.js';

const WORKSPACES_DIR = '.zelda/workspaces';

const isGitRepoRoot = (dir: string): boolean => {
  try {
    const toplevel = execSync('git rev-parse --show-toplevel', {
      cwd: dir,
      stdio: 'pipe',
      encoding: 'utf-8',
    }).trim();
    // Only use worktree when projectDir IS the repo root.
    // Subdirectories (e.g. monorepo packages) must use directory copy,
    // because worktrees check out the entire repo, not a subdirectory.
    return toplevel === dir;
  } catch {
    return false;
  }
};

export const createWorkspace = (
  projectDir: string,
  runId: string,
): string => {
  const workspacesBase = join(projectDir, WORKSPACES_DIR);
  const workspacePath = join(workspacesBase, runId);

  if (existsSync(workspacePath)) {
    throw new WorkspaceError(
      `Workspace already exists: ${workspacePath}`,
      'WORKSPACE_EXISTS',
      `Workspace directory already exists for run ${runId}. This may indicate a duplicate run ID.`,
    );
  }

  mkdirSync(workspacesBase, { recursive: true });

  if (isGitRepoRoot(projectDir)) {
    try {
      execSync(`git worktree add "${workspacePath}" HEAD --detach`, {
        cwd: projectDir,
        stdio: 'pipe',
      });
    } catch (e) {
      throw new WorkspaceError(
        `Failed to create git worktree: ${e instanceof Error ? e.message : String(e)}`,
        'WORKSPACE_CREATE_FAILED',
        `Could not create isolated workspace for run ${runId}. Git worktree creation failed.`,
      );
    }
  } else {
    try {
      const EXCLUDED = new Set(['node_modules', '.zelda', '.git', 'dist']);
      mkdirSync(workspacePath, { recursive: true });
      const entries = readdirSync(projectDir);
      for (const entry of entries) {
        if (EXCLUDED.has(entry)) continue;
        const srcPath = join(projectDir, entry);
        const destPath = join(workspacePath, entry);
        cpSync(srcPath, destPath, { recursive: true });
      }
    } catch (e) {
      throw new WorkspaceError(
        `Failed to copy directory: ${e instanceof Error ? e.message : String(e)}`,
        'WORKSPACE_COPY_FAILED',
        `Could not create isolated workspace for run ${runId}. Directory copy failed.`,
      );
    }
  }

  return workspacePath;
};

export const cleanupWorkspace = (
  projectDir: string,
  workspacePath: string,
): void => {
  // Try to remove git worktree first (fails silently if not a worktree)
  if (isGitRepoRoot(projectDir)) {
    try {
      execSync(`git worktree remove "${workspacePath}" --force`, {
        cwd: projectDir,
        stdio: 'pipe',
      });
      return;
    } catch {
      // Worktree removal failed — fall through to directory removal
    }
  }

  // Direct directory removal as fallback
  try {
    rmSync(workspacePath, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup — don't throw on cleanup failures
  }
};

