import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { detectRuntime, clearRuntimeCache } from '../../../src/core/execution/runtime-detector.js';
import { ExecutionError } from '../../../src/core/errors.js';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

describe('execution/runtime-detector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRuntimeCache();
  });

  describe('detectRuntime', () => {
    it('detects Docker when available', () => {
      vi.mocked(execFileSync).mockImplementation((cmd: string) => {
        if (cmd === 'docker') return Buffer.from('');
        if (cmd === 'which') return '/usr/local/bin/agentbox\n' as unknown as Buffer;
        throw new Error('not found');
      });

      const result = detectRuntime({});
      expect(result.available).toBe(true);
      expect(result.containerRuntime).toBe('docker');
      expect(result.agentboxPath).toBe('/usr/local/bin/agentbox');
    });

    it('detects Podman when Docker is not available', () => {
      vi.mocked(execFileSync).mockImplementation((cmd: string) => {
        if (cmd === 'docker') throw new Error('not found');
        if (cmd === 'podman') return Buffer.from('');
        if (cmd === 'which') return '/usr/local/bin/agentbox\n' as unknown as Buffer;
        throw new Error('not found');
      });

      const result = detectRuntime({});
      expect(result.available).toBe(true);
      expect(result.containerRuntime).toBe('podman');
    });

    it('returns unavailable when neither Docker nor Podman found', () => {
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('not found');
      });

      const result = detectRuntime({});
      expect(result.available).toBe(false);
      expect(result.containerRuntime).toBeUndefined();
      expect(result.agentboxPath).toBeUndefined();
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Docker/Podman not found');
    });

    it('uses configured agentboxPath when provided', () => {
      vi.mocked(execFileSync).mockImplementation((cmd: string) => {
        if (cmd === 'docker') return Buffer.from('');
        throw new Error('not found');
      });
      vi.mocked(existsSync).mockReturnValue(true);

      const result = detectRuntime({ agentboxPath: '/custom/agentbox' });
      expect(result.available).toBe(true);
      expect(result.agentboxPath).toBe('/custom/agentbox');
    });

    it('throws ExecutionError when configured agentboxPath does not exist', () => {
      vi.mocked(execFileSync).mockImplementation((cmd: string) => {
        if (cmd === 'docker') return Buffer.from('');
        throw new Error('not found');
      });
      vi.mocked(existsSync).mockReturnValue(false);

      try {
        detectRuntime({ agentboxPath: '/bad/path' });
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ExecutionError);
        expect((e as ExecutionError).code).toBe('AGENTBOX_PATH_INVALID');
      }
    });

    it('returns unavailable with warning when agentbox not found in PATH', () => {
      vi.mocked(execFileSync).mockImplementation((cmd: string) => {
        if (cmd === 'docker') return Buffer.from('');
        throw new Error('not found');
      });

      const result = detectRuntime({});
      expect(result.available).toBe(false);
      expect(result.containerRuntime).toBe('docker');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Install agentbox');
    });

    it('caches detection result across calls', () => {
      vi.mocked(execFileSync).mockImplementation((cmd: string) => {
        if (cmd === 'docker') return Buffer.from('');
        if (cmd === 'which') return '/usr/local/bin/agentbox\n' as unknown as Buffer;
        throw new Error('not found');
      });

      const result1 = detectRuntime({});
      const result2 = detectRuntime({});
      expect(result1).toBe(result2);
      // Docker check + which agentbox on first call only
      expect(vi.mocked(execFileSync)).toHaveBeenCalledTimes(2);
    });

    it('caches unavailable result too', () => {
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('not found');
      });

      const result1 = detectRuntime({});
      const result2 = detectRuntime({});
      expect(result1).toBe(result2);
      // Only docker + podman checks on first call
      expect(vi.mocked(execFileSync)).toHaveBeenCalledTimes(2);
    });

    it('caches agentbox-not-found result', () => {
      vi.mocked(execFileSync).mockImplementation((cmd: string) => {
        if (cmd === 'docker') return Buffer.from('');
        throw new Error('not found');
      });

      const result1 = detectRuntime({});
      const result2 = detectRuntime({});
      expect(result1).toBe(result2);
      expect(result1.available).toBe(false);
      // docker info + which agentbox on first call only
      expect(vi.mocked(execFileSync)).toHaveBeenCalledTimes(2);
    });

    it('uses platform-appropriate lookup command', () => {
      vi.mocked(execFileSync).mockImplementation((cmd: string) => {
        if (cmd === 'docker') return Buffer.from('');
        if (cmd === 'which' || cmd === 'where') return '/usr/local/bin/agentbox\n' as unknown as Buffer;
        throw new Error('not found');
      });

      detectRuntime({});

      const lookupCalls = vi.mocked(execFileSync).mock.calls.filter(
        (call) => call[0] === 'which' || call[0] === 'where',
      );
      expect(lookupCalls).toHaveLength(1);
      const expectedCommand = process.platform === 'win32' ? 'where' : 'which';
      expect(lookupCalls[0][0]).toBe(expectedCommand);
    });
  });

  describe('clearRuntimeCache', () => {
    it('allows re-detection after clearing cache', () => {
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('not found');
      });

      const result1 = detectRuntime({});
      clearRuntimeCache();

      vi.mocked(execFileSync).mockImplementation((cmd: string) => {
        if (cmd === 'docker') return Buffer.from('');
        if (cmd === 'which') return '/usr/local/bin/agentbox\n' as unknown as Buffer;
        throw new Error('not found');
      });

      const result2 = detectRuntime({});
      expect(result1.available).toBe(false);
      expect(result2.available).toBe(true);
    });
  });
});
