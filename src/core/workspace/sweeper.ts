// Workspace sweeper — startup orphan detection and cleanup

import { existsSync, readdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const WORKSPACES_DIR = '.zelda/workspaces';

export const sweepOrphanedWorkspaces = (projectDir: string): string[] => {
  const workspacesBase = join(projectDir, WORKSPACES_DIR);

  if (!existsSync(workspacesBase)) {
    return [];
  }

  let entries: string[];
  try {
    entries = readdirSync(workspacesBase);
  } catch {
    return [];
  }

  const removed: string[] = [];

  for (const entry of entries) {
    const workspacePath = join(workspacesBase, entry);

    // Try git worktree remove first
    try {
      execSync(`git worktree remove "${workspacePath}" --force`, {
        cwd: projectDir,
        stdio: 'pipe',
      });
    } catch {
      // Not a worktree or git not available — remove directly
      try {
        rmSync(workspacePath, { recursive: true, force: true });
      } catch {
        // Best-effort — skip if we can't remove
        continue;
      }
    }

    removed.push(entry);
  }

  return removed;
};
