import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  startContainer,
  stopContainer,
  computeContainerName,
  listZeldaContainers,
  registerContainerCleanup,
  resetCleanupState,
} from '../../../src/core/execution/container-manager.js';
import { ExecutionError } from '../../../src/core/errors.js';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

describe('execution/container-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCleanupState();
  });

  describe('computeContainerName', () => {
    it('produces deterministic name from path', () => {
      const name1 = computeContainerName('/project/workspace');
      const name2 = computeContainerName('/project/workspace');
      expect(name1).toBe(name2);
      expect(name1).toMatch(/^agentbox-[a-f0-9]{12}$/);
    });

    it('produces different names for different paths', () => {
      const name1 = computeContainerName('/project/workspace-a');
      const name2 = computeContainerName('/project/workspace-b');
      expect(name1).not.toBe(name2);
    });
  });

  describe('startContainer', () => {
    it('starts agentbox with workspace path', () => {
      vi.mocked(execFileSync).mockReturnValue(Buffer.from('ready\n'));

      const result = startContainer({
        workspacePath: '/tmp/workspace',
        agentboxPath: '/usr/local/bin/agentbox',
      });

      expect(execFileSync).toHaveBeenCalledWith(
        '/usr/local/bin/agentbox',
        ['shell', 'echo', 'ready'],
        expect.objectContaining({
          cwd: '/tmp/workspace',
          timeout: 30000,
        }),
      );
      expect(result.workspacePath).toBe('/tmp/workspace');
      expect(result.agentboxPath).toBe('/usr/local/bin/agentbox');
    });

    it('returns ContainerInstance with computed name', () => {
      vi.mocked(execFileSync).mockReturnValue(Buffer.from('ready\n'));

      const result = startContainer({
        workspacePath: '/tmp/workspace',
        agentboxPath: '/usr/local/bin/agentbox',
      });

      const expectedName = computeContainerName('/tmp/workspace');
      expect(result.containerId).toBe(expectedName);
      expect(result.containerName).toBe(expectedName);
    });

    it('throws ExecutionError when agentbox fails', () => {
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('agentbox not found');
      });

      try {
        startContainer({
          workspacePath: '/tmp/workspace',
          agentboxPath: '/usr/local/bin/agentbox',
        });
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ExecutionError);
        expect((e as ExecutionError).code).toBe('CONTAINER_START_FAILED');
      }
    });
  });

  describe('stopContainer', () => {
    const instance = {
      containerId: 'agentbox-abc123def456',
      containerName: 'agentbox-abc123def456',
      workspacePath: '/tmp/workspace',
      agentboxPath: '/usr/local/bin/agentbox',
    };

    it('stops container gracefully via execFileSync', () => {
      vi.mocked(execFileSync).mockReturnValue(Buffer.from(''));

      const result = stopContainer(instance);
      expect(result).toBe(true);
      expect(execFileSync).toHaveBeenCalledWith(
        'docker',
        ['stop', 'agentbox-abc123def456'],
        expect.objectContaining({ timeout: 10000 }),
      );
    });

    it('falls back to kill when stop fails', () => {
      vi.mocked(execFileSync).mockImplementationOnce(() => {
        throw new Error('stop failed');
      }).mockReturnValueOnce(Buffer.from(''));

      const result = stopContainer(instance);
      expect(result).toBe(true);
      expect(execFileSync).toHaveBeenCalledTimes(2);
      expect(execFileSync).toHaveBeenCalledWith(
        'docker',
        ['kill', 'agentbox-abc123def456'],
        expect.objectContaining({ timeout: 5000 }),
      );
    });

    it('returns false when container already gone', () => {
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('no such container');
      });

      const result = stopContainer(instance);
      expect(result).toBe(false);
    });

    it('never throws on any error', () => {
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('fail');
      });

      expect(() => stopContainer(instance)).not.toThrow();
      expect(stopContainer(instance)).toBe(false);
    });
  });

  describe('registerContainerCleanup', () => {
    it('registers SIGINT and SIGTERM handlers', () => {
      const onSpy = vi.spyOn(process, 'on');
      const activeContainers = new Map<string, {
        containerId: string;
        containerName: string;
        workspacePath: string;
        agentboxPath: string;
      }>();

      registerContainerCleanup(activeContainers);

      const signalCalls = onSpy.mock.calls.filter(
        (call) => call[0] === 'SIGINT' || call[0] === 'SIGTERM',
      );
      expect(signalCalls).toHaveLength(2);
      const signals = signalCalls.map((c) => c[0]);
      expect(signals).toContain('SIGINT');
      expect(signals).toContain('SIGTERM');

      onSpy.mockRestore();
    });

    it('stops all active containers on signal', () => {
      const activeContainers = new Map<string, {
        containerId: string;
        containerName: string;
        workspacePath: string;
        agentboxPath: string;
      }>();
      activeContainers.set('run-1', {
        containerId: 'agentbox-111',
        containerName: 'agentbox-111',
        workspacePath: '/tmp/ws1',
        agentboxPath: '/usr/local/bin/agentbox',
      });
      activeContainers.set('run-2', {
        containerId: 'agentbox-222',
        containerName: 'agentbox-222',
        workspacePath: '/tmp/ws2',
        agentboxPath: '/usr/local/bin/agentbox',
      });

      let sigintHandler: (() => void) | undefined;
      const onSpy = vi.spyOn(process, 'on').mockImplementation((event, handler) => {
        if (event === 'SIGINT') sigintHandler = handler as () => void;
        return process;
      });

      registerContainerCleanup(activeContainers);

      vi.mocked(execFileSync).mockReturnValue(Buffer.from(''));
      sigintHandler?.();

      expect(execFileSync).toHaveBeenCalledWith(
        'docker',
        ['stop', 'agentbox-111'],
        expect.anything(),
      );
      expect(execFileSync).toHaveBeenCalledWith(
        'docker',
        ['stop', 'agentbox-222'],
        expect.anything(),
      );

      onSpy.mockRestore();
    });

    it('cleanup never throws even when stop fails', () => {
      const activeContainers = new Map<string, {
        containerId: string;
        containerName: string;
        workspacePath: string;
        agentboxPath: string;
      }>();
      activeContainers.set('run-1', {
        containerId: 'agentbox-111',
        containerName: 'agentbox-111',
        workspacePath: '/tmp/ws1',
        agentboxPath: '/usr/local/bin/agentbox',
      });

      let sigintHandler: (() => void) | undefined;
      const onSpy = vi.spyOn(process, 'on').mockImplementation((event, handler) => {
        if (event === 'SIGINT') sigintHandler = handler as () => void;
        return process;
      });

      registerContainerCleanup(activeContainers);

      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('fail');
      });

      expect(() => sigintHandler?.()).not.toThrow();

      onSpy.mockRestore();
    });

    it('does not register duplicate handlers on repeated calls', () => {
      const onSpy = vi.spyOn(process, 'on');
      const map1 = new Map<string, {
        containerId: string;
        containerName: string;
        workspacePath: string;
        agentboxPath: string;
      }>();
      const map2 = new Map<string, {
        containerId: string;
        containerName: string;
        workspacePath: string;
        agentboxPath: string;
      }>();

      registerContainerCleanup(map1);
      registerContainerCleanup(map2);

      const signalCalls = onSpy.mock.calls.filter(
        (call) => call[0] === 'SIGINT' || call[0] === 'SIGTERM',
      );
      // Only 2 handlers (SIGINT + SIGTERM), not 4
      expect(signalCalls).toHaveLength(2);

      onSpy.mockRestore();
    });

    it('uses latest activeContainers reference after re-registration', () => {
      const map1 = new Map<string, {
        containerId: string;
        containerName: string;
        workspacePath: string;
        agentboxPath: string;
      }>();
      const map2 = new Map<string, {
        containerId: string;
        containerName: string;
        workspacePath: string;
        agentboxPath: string;
      }>();
      map2.set('run-new', {
        containerId: 'agentbox-new',
        containerName: 'agentbox-new',
        workspacePath: '/tmp/new',
        agentboxPath: '/usr/local/bin/agentbox',
      });

      let sigintHandler: (() => void) | undefined;
      const onSpy = vi.spyOn(process, 'on').mockImplementation((event, handler) => {
        if (event === 'SIGINT') sigintHandler = handler as () => void;
        return process;
      });

      registerContainerCleanup(map1);
      registerContainerCleanup(map2); // Updates reference to map2

      vi.mocked(execFileSync).mockReturnValue(Buffer.from(''));
      sigintHandler?.();

      // Should stop container from map2, not map1
      expect(execFileSync).toHaveBeenCalledWith(
        'docker',
        ['stop', 'agentbox-new'],
        expect.anything(),
      );

      onSpy.mockRestore();
    });
  });

  describe('listZeldaContainers', () => {
    it('returns list of running zelda containers', () => {
      vi.mocked(execFileSync).mockReturnValue(
        'agentbox-abc123\nagentbox-def456\n' as unknown as Buffer,
      );

      const result = listZeldaContainers();
      expect(result).toEqual(['agentbox-abc123', 'agentbox-def456']);
      expect(execFileSync).toHaveBeenCalledWith(
        'docker',
        ['ps', '--filter', 'name=agentbox-', '--format', '{{.Names}}'],
        expect.anything(),
      );
    });

    it('returns empty array when no containers running', () => {
      vi.mocked(execFileSync).mockReturnValue('' as unknown as Buffer);

      const result = listZeldaContainers();
      expect(result).toEqual([]);
    });

    it('returns empty array when docker command fails', () => {
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('docker not available');
      });

      const result = listZeldaContainers();
      expect(result).toEqual([]);
    });
  });
});
