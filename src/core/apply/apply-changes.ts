// Apply changes — extract workspace diff and apply to project

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, cpSync, mkdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { WorkspaceError } from '../errors.js';

const WORKSPACES_DIR = '.zelda/workspaces';

export type ApplyResult = {
  filesChanged: number;
  summary: string;
};

export type ApplyOptions = {
  dryRun?: boolean;
};

export const applyRunChanges = (
  projectDir: string,
  runId: string,
  options?: ApplyOptions,
): ApplyResult => {
  const workspacePath = join(projectDir, WORKSPACES_DIR, runId);

  if (!existsSync(workspacePath)) {
    throw new WorkspaceError(
      `Workspace not found: ${workspacePath}`,
      'WORKSPACE_NOT_FOUND',
      `Workspace not found for run: ${runId}. It may have been cleaned with 'zelda clean'.`,
    );
  }

  // Git worktrees have a .git file (not directory) pointing to the main repo
  const isGitWorkspace = existsSync(join(workspacePath, '.git'));

  if (isGitWorkspace) {
    return applyGitChanges(projectDir, workspacePath, options);
  }

  return applyDirectoryChanges(projectDir, workspacePath, options);
};

const applyGitChanges = (
  projectDir: string,
  workspacePath: string,
  options?: ApplyOptions,
): ApplyResult => {
  // Stage all changes in workspace (including new/deleted files)
  execSync('git add -A', { cwd: workspacePath, stdio: 'pipe' });

  // Get the full diff (staged against HEAD = all changes Claude made)
  const diff = execSync('git diff --cached HEAD', {
    cwd: workspacePath,
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
  });

  if (!diff.trim()) {
    return { filesChanged: 0, summary: 'No changes to apply' };
  }

  // Get human-readable stats
  const stat = execSync('git diff --cached --stat HEAD', {
    cwd: workspacePath,
    encoding: 'utf-8',
  }).trim();

  const filesChanged = countFilesFromStat(stat);

  if (options?.dryRun) {
    return { filesChanged, summary: stat };
  }

  // Apply the diff to the project directory
  try {
    execSync('git apply', {
      cwd: projectDir,
      input: diff,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (e) {
    const stderr = e instanceof Error && 'stderr' in e
      ? String((e as Record<string, unknown>).stderr)
      : '';
    throw new WorkspaceError(
      `Failed to apply changes: ${stderr || (e instanceof Error ? e.message : String(e))}`,
      'APPLY_FAILED',
      `Could not apply workspace changes. The project may have been modified since the run.\nTry manually: git -C "${workspacePath}" diff --cached HEAD | git apply --3way`,
    );
  }

  return { filesChanged, summary: stat };
};

const EXCLUDED = new Set(['node_modules', '.zelda', '.git', 'dist']);

const walkFiles = (dir: string): string[] => {
  const files: string[] = [];
  const walk = (currentDir: string) => {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      if (EXCLUDED.has(entry.name)) continue;
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        files.push(relative(dir, fullPath));
      }
    }
  };
  walk(dir);
  return files;
};

const applyDirectoryChanges = (
  projectDir: string,
  workspacePath: string,
  options?: ApplyOptions,
): ApplyResult => {
  const workspaceFiles = walkFiles(workspacePath);
  const changed: string[] = [];

  for (const relPath of workspaceFiles) {
    const wsFile = join(workspacePath, relPath);
    const projFile = join(projectDir, relPath);

    if (!existsSync(projFile)) {
      changed.push(relPath);
      continue;
    }

    const wsStat = statSync(wsFile);
    const projStat = statSync(projFile);

    // Compare by size first (fast), then content if sizes match
    if (wsStat.size !== projStat.size) {
      changed.push(relPath);
      continue;
    }

    const wsContent = readFileSync(wsFile);
    const projContent = readFileSync(projFile);
    if (!wsContent.equals(projContent)) {
      changed.push(relPath);
    }
  }

  if (changed.length === 0) {
    return { filesChanged: 0, summary: 'No changes to apply' };
  }

  const summary = changed.map((f) => `  ${f}`).join('\n');

  if (options?.dryRun) {
    return { filesChanged: changed.length, summary };
  }

  for (const relPath of changed) {
    const wsFile = join(workspacePath, relPath);
    const projFile = join(projectDir, relPath);
    mkdirSync(dirname(projFile), { recursive: true });
    cpSync(wsFile, projFile);
  }

  return { filesChanged: changed.length, summary };
};

const countFilesFromStat = (stat: string): number => {
  const lines = stat.split('\n');
  const summaryLine = lines[lines.length - 1];
  const match = summaryLine.match(/(\d+) files? changed/);
  return match ? parseInt(match[1], 10) : 0;
};
