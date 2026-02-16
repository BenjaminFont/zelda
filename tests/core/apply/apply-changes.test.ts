import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { applyRunChanges } from '../../../src/core/apply/apply-changes.js';
import { WorkspaceError } from '../../../src/core/errors.js';

describe('apply/apply-changes', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'zelda-apply-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('git worktree workspace', () => {
    let gitDir: string;

    const setupGitProject = () => {
      gitDir = tempDir;
      execSync('git init', { cwd: gitDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: gitDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: gitDir, stdio: 'pipe' });
      writeFileSync(join(gitDir, 'index.ts'), 'console.log("hello");\n');
      writeFileSync(join(gitDir, 'README.md'), '# Project\n');
      execSync('git add . && git commit -m "init"', { cwd: gitDir, stdio: 'pipe' });
    };

    const createWorktreeWorkspace = (runId: string): string => {
      const wsDir = join(gitDir, '.zelda', 'workspaces');
      mkdirSync(wsDir, { recursive: true });
      const workspacePath = join(wsDir, runId);
      execSync(`git worktree add "${workspacePath}" HEAD --detach`, {
        cwd: gitDir,
        stdio: 'pipe',
      });
      return workspacePath;
    };

    const cleanupWorktree = (workspacePath: string) => {
      try {
        execSync(`git worktree remove "${workspacePath}" --force`, {
          cwd: gitDir,
          stdio: 'pipe',
        });
      } catch {
        rmSync(workspacePath, { recursive: true, force: true });
      }
    };

    it('applies modified file changes from workspace to project', () => {
      setupGitProject();
      const ws = createWorktreeWorkspace('run-001');

      // Simulate Claude modifying a file in the workspace
      writeFileSync(join(ws, 'index.ts'), 'console.log("modified by Claude");\n');

      const result = applyRunChanges(gitDir, 'run-001');

      expect(result.filesChanged).toBe(1);
      expect(readFileSync(join(gitDir, 'index.ts'), 'utf-8')).toBe('console.log("modified by Claude");\n');

      cleanupWorktree(ws);
    });

    it('applies new file additions from workspace to project', () => {
      setupGitProject();
      const ws = createWorktreeWorkspace('run-002');

      // Simulate Claude creating a new file
      writeFileSync(join(ws, 'server.ts'), 'export const server = {};\n');

      const result = applyRunChanges(gitDir, 'run-002');

      expect(result.filesChanged).toBeGreaterThanOrEqual(1);
      expect(existsSync(join(gitDir, 'server.ts'))).toBe(true);
      expect(readFileSync(join(gitDir, 'server.ts'), 'utf-8')).toBe('export const server = {};\n');

      cleanupWorktree(ws);
    });

    it('returns zero files when no changes were made', () => {
      setupGitProject();
      const ws = createWorktreeWorkspace('run-003');

      // No changes made to workspace
      const result = applyRunChanges(gitDir, 'run-003');

      expect(result.filesChanged).toBe(0);
      expect(result.summary).toBe('No changes to apply');

      cleanupWorktree(ws);
    });

    it('shows diff stats in dry-run mode without applying', () => {
      setupGitProject();
      const ws = createWorktreeWorkspace('run-004');

      writeFileSync(join(ws, 'index.ts'), 'console.log("dry run test");\n');

      const result = applyRunChanges(gitDir, 'run-004', { dryRun: true });

      expect(result.filesChanged).toBe(1);
      expect(result.summary).toContain('index.ts');
      // Original file should be unchanged
      expect(readFileSync(join(gitDir, 'index.ts'), 'utf-8')).toBe('console.log("hello");\n');

      cleanupWorktree(ws);
    });
  });

  describe('directory-copy workspace', () => {
    it('copies modified files back to project', () => {
      const projectDir = join(tempDir, 'project');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'app.ts'), 'const app = 1;\n');

      // Create a non-git workspace manually
      const wsDir = join(projectDir, '.zelda', 'workspaces', 'run-copy');
      mkdirSync(wsDir, { recursive: true });
      writeFileSync(join(wsDir, 'app.ts'), 'const app = 2;\n');

      const result = applyRunChanges(projectDir, 'run-copy');

      expect(result.filesChanged).toBe(1);
      expect(readFileSync(join(projectDir, 'app.ts'), 'utf-8')).toBe('const app = 2;\n');
    });

    it('copies new files to project', () => {
      const projectDir = join(tempDir, 'project');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'existing.ts'), 'existing\n');

      const wsDir = join(projectDir, '.zelda', 'workspaces', 'run-new');
      mkdirSync(wsDir, { recursive: true });
      writeFileSync(join(wsDir, 'existing.ts'), 'existing\n');
      writeFileSync(join(wsDir, 'newfile.ts'), 'new content\n');

      const result = applyRunChanges(projectDir, 'run-new');

      expect(result.filesChanged).toBe(1);
      expect(existsSync(join(projectDir, 'newfile.ts'))).toBe(true);
    });

    it('returns zero when files are identical', () => {
      const projectDir = join(tempDir, 'project');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'same.ts'), 'unchanged\n');

      const wsDir = join(projectDir, '.zelda', 'workspaces', 'run-same');
      mkdirSync(wsDir, { recursive: true });
      writeFileSync(join(wsDir, 'same.ts'), 'unchanged\n');

      const result = applyRunChanges(projectDir, 'run-same');

      expect(result.filesChanged).toBe(0);
    });

    it('shows changes in dry-run without applying', () => {
      const projectDir = join(tempDir, 'project');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'app.ts'), 'const v = 1;\n');

      const wsDir = join(projectDir, '.zelda', 'workspaces', 'run-dry');
      mkdirSync(wsDir, { recursive: true });
      writeFileSync(join(wsDir, 'app.ts'), 'const v = 2;\n');

      const result = applyRunChanges(projectDir, 'run-dry', { dryRun: true });

      expect(result.filesChanged).toBe(1);
      // Project file unchanged
      expect(readFileSync(join(projectDir, 'app.ts'), 'utf-8')).toBe('const v = 1;\n');
    });
  });

  describe('error handling', () => {
    it('throws WorkspaceError when workspace does not exist', () => {
      expect(() => applyRunChanges(tempDir, 'nonexistent-run')).toThrow(WorkspaceError);

      try {
        applyRunChanges(tempDir, 'nonexistent-run');
      } catch (e) {
        expect((e as WorkspaceError).code).toBe('WORKSPACE_NOT_FOUND');
        expect((e as WorkspaceError).userMessage).toContain('nonexistent-run');
      }
    });
  });
});
