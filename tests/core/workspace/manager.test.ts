import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, existsSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createWorkspace,
  cleanupWorkspace,
} from '../../../src/core/workspace/manager.js';
import { WorkspaceError } from '../../../src/core/errors.js';

describe('workspace/manager', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'zelda-ws-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('createWorkspace (git repo)', () => {
    let gitDir: string;

    beforeEach(() => {
      gitDir = join(tempDir, 'git-project');
      mkdirSync(gitDir);
      execSync('git init', { cwd: gitDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: gitDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: gitDir, stdio: 'pipe' });
      writeFileSync(join(gitDir, 'README.md'), '# Test');
      execSync('git add . && git commit -m "init"', { cwd: gitDir, stdio: 'pipe' });
    });

    it('creates a git worktree at .zelda/workspaces/<run-id>/', () => {
      const workspacePath = createWorkspace(gitDir, 'test-run-001');
      expect(existsSync(workspacePath)).toBe(true);
      expect(workspacePath).toContain('.zelda/workspaces/test-run-001');
      expect(existsSync(join(workspacePath, 'README.md'))).toBe(true);

      // Cleanup
      cleanupWorkspace(gitDir, workspacePath);
    });

    it('throws WorkspaceError if workspace already exists', () => {
      const workspacePath = createWorkspace(gitDir, 'dup-run');
      expect(() => createWorkspace(gitDir, 'dup-run')).toThrow(WorkspaceError);
      try {
        createWorkspace(gitDir, 'dup-run');
      } catch (e) {
        expect((e as WorkspaceError).code).toBe('WORKSPACE_EXISTS');
      }

      cleanupWorkspace(gitDir, workspacePath);
    });
  });

  describe('createWorkspace (non-git directory)', () => {
    let nonGitDir: string;

    beforeEach(() => {
      nonGitDir = join(tempDir, 'non-git-project');
      mkdirSync(nonGitDir);
      writeFileSync(join(nonGitDir, 'index.ts'), 'console.log("hello")');
      mkdirSync(join(nonGitDir, 'src'));
      writeFileSync(join(nonGitDir, 'src', 'app.ts'), 'export const app = {}');
    });

    it('falls back to directory copy', () => {
      const workspacePath = createWorkspace(nonGitDir, 'copy-run-001');
      expect(existsSync(workspacePath)).toBe(true);
      expect(existsSync(join(workspacePath, 'index.ts'))).toBe(true);
      expect(existsSync(join(workspacePath, 'src', 'app.ts'))).toBe(true);

      cleanupWorkspace(nonGitDir, workspacePath);
    });

    it('excludes node_modules and .zelda from copy', () => {
      mkdirSync(join(nonGitDir, 'node_modules'));
      writeFileSync(join(nonGitDir, 'node_modules', 'pkg.js'), '');
      mkdirSync(join(nonGitDir, '.zelda'));
      writeFileSync(join(nonGitDir, '.zelda', 'data'), '');

      const workspacePath = createWorkspace(nonGitDir, 'filtered-run');
      expect(existsSync(join(workspacePath, 'node_modules'))).toBe(false);
      expect(existsSync(join(workspacePath, '.zelda'))).toBe(false);
      expect(existsSync(join(workspacePath, 'index.ts'))).toBe(true);

      cleanupWorkspace(nonGitDir, workspacePath);
    });
  });

  describe('cleanupWorkspace', () => {
    it('removes git worktree and directory', () => {
      const gitDir = join(tempDir, 'git-cleanup');
      mkdirSync(gitDir);
      execSync('git init', { cwd: gitDir, stdio: 'pipe' });
      execSync('git config user.email "test@test.com"', { cwd: gitDir, stdio: 'pipe' });
      execSync('git config user.name "Test"', { cwd: gitDir, stdio: 'pipe' });
      writeFileSync(join(gitDir, 'file.txt'), 'content');
      execSync('git add . && git commit -m "init"', { cwd: gitDir, stdio: 'pipe' });

      const workspacePath = createWorkspace(gitDir, 'cleanup-test');
      expect(existsSync(workspacePath)).toBe(true);

      cleanupWorkspace(gitDir, workspacePath);
      expect(existsSync(workspacePath)).toBe(false);
    });

    it('removes non-git workspace directory', () => {
      const nonGitDir = join(tempDir, 'nongit-cleanup');
      mkdirSync(nonGitDir);
      writeFileSync(join(nonGitDir, 'file.txt'), 'content');

      const workspacePath = createWorkspace(nonGitDir, 'cleanup-test');
      expect(existsSync(workspacePath)).toBe(true);

      cleanupWorkspace(nonGitDir, workspacePath);
      expect(existsSync(workspacePath)).toBe(false);
    });

    it('does not throw on already-removed workspace', () => {
      const dir = join(tempDir, 'already-gone');
      mkdirSync(dir);
      const fakePath = join(dir, '.zelda', 'workspaces', 'gone');

      expect(() => cleanupWorkspace(dir, fakePath)).not.toThrow();
    });
  });
});
