import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sweepOrphanedWorkspaces, listWorkspaces, cleanSingleWorkspace } from '../../../src/core/workspace/sweeper.js';

describe('workspace/sweeper', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'zelda-sweep-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns empty array when no workspaces directory exists', () => {
    const removed = sweepOrphanedWorkspaces(tempDir);
    expect(removed).toEqual([]);
  });

  it('returns empty array when workspaces directory is empty', () => {
    mkdirSync(join(tempDir, '.zelda', 'workspaces'), { recursive: true });
    const removed = sweepOrphanedWorkspaces(tempDir);
    expect(removed).toEqual([]);
  });

  it('removes orphaned directories (non-git)', () => {
    const wsDir = join(tempDir, '.zelda', 'workspaces');
    mkdirSync(wsDir, { recursive: true });

    // Create orphaned workspace directories
    mkdirSync(join(wsDir, 'orphan-run-1'));
    writeFileSync(join(wsDir, 'orphan-run-1', 'file.txt'), 'leftover');
    mkdirSync(join(wsDir, 'orphan-run-2'));
    writeFileSync(join(wsDir, 'orphan-run-2', 'file.txt'), 'leftover');

    const removed = sweepOrphanedWorkspaces(tempDir);
    expect(removed).toHaveLength(2);
    expect(removed).toContain('orphan-run-1');
    expect(removed).toContain('orphan-run-2');
    expect(existsSync(join(wsDir, 'orphan-run-1'))).toBe(false);
    expect(existsSync(join(wsDir, 'orphan-run-2'))).toBe(false);
  });

  it('removes orphaned git worktrees', () => {
    // Create a git repo with worktrees
    const gitDir = tempDir;
    execSync('git init', { cwd: gitDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: gitDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: gitDir, stdio: 'pipe' });
    writeFileSync(join(gitDir, 'README.md'), '# Test');
    execSync('git add . && git commit -m "init"', { cwd: gitDir, stdio: 'pipe' });

    // Create a worktree manually
    const wsDir = join(gitDir, '.zelda', 'workspaces');
    mkdirSync(wsDir, { recursive: true });
    const worktreePath = join(wsDir, 'orphan-wt');
    execSync(`git worktree add "${worktreePath}" HEAD --detach`, {
      cwd: gitDir,
      stdio: 'pipe',
    });

    expect(existsSync(worktreePath)).toBe(true);

    const removed = sweepOrphanedWorkspaces(gitDir);
    expect(removed).toContain('orphan-wt');
    expect(existsSync(worktreePath)).toBe(false);
  });
});

describe('workspace/sweeper - listWorkspaces', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'zelda-list-ws-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns empty array when no workspaces directory exists', () => {
    expect(listWorkspaces(tempDir)).toEqual([]);
  });

  it('returns empty array when workspaces directory is empty', () => {
    mkdirSync(join(tempDir, '.zelda', 'workspaces'), { recursive: true });
    expect(listWorkspaces(tempDir)).toEqual([]);
  });

  it('returns workspace directory names', () => {
    const wsDir = join(tempDir, '.zelda', 'workspaces');
    mkdirSync(wsDir, { recursive: true });
    mkdirSync(join(wsDir, 'run-001'));
    mkdirSync(join(wsDir, 'run-002'));

    const result = listWorkspaces(tempDir);
    expect(result).toHaveLength(2);
    expect(result).toContain('run-001');
    expect(result).toContain('run-002');
  });
});

describe('workspace/sweeper - cleanSingleWorkspace', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'zelda-clean-single-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns false when workspace does not exist', () => {
    expect(cleanSingleWorkspace(tempDir, 'nonexistent-run')).toBe(false);
  });

  it('removes a specific non-git workspace and returns true', () => {
    const wsDir = join(tempDir, '.zelda', 'workspaces');
    mkdirSync(wsDir, { recursive: true });
    const targetDir = join(wsDir, 'run-to-remove');
    mkdirSync(targetDir);
    writeFileSync(join(targetDir, 'file.txt'), 'content');

    // Also create another workspace that should not be touched
    mkdirSync(join(wsDir, 'run-to-keep'));

    const result = cleanSingleWorkspace(tempDir, 'run-to-remove');
    expect(result).toBe(true);
    expect(existsSync(targetDir)).toBe(false);
    expect(existsSync(join(wsDir, 'run-to-keep'))).toBe(true);
  });

  it('removes a git worktree workspace', () => {
    const gitDir = tempDir;
    execSync('git init', { cwd: gitDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: gitDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: gitDir, stdio: 'pipe' });
    writeFileSync(join(gitDir, 'README.md'), '# Test');
    execSync('git add . && git commit -m "init"', { cwd: gitDir, stdio: 'pipe' });

    const wsDir = join(gitDir, '.zelda', 'workspaces');
    mkdirSync(wsDir, { recursive: true });
    const worktreePath = join(wsDir, 'wt-run');
    execSync(`git worktree add "${worktreePath}" HEAD --detach`, {
      cwd: gitDir,
      stdio: 'pipe',
    });

    expect(existsSync(worktreePath)).toBe(true);

    const result = cleanSingleWorkspace(gitDir, 'wt-run');
    expect(result).toBe(true);
    expect(existsSync(worktreePath)).toBe(false);
  });
});
