// Container manager — agentbox container lifecycle (start/stop/list)

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ExecutionError } from '../errors.js';
import type { ContainerInstance, ContainerStartOptions } from '../types.js';

export const computeContainerName = (projectDir: string): string => {
  const hash = createHash('sha256').update(projectDir).digest('hex').slice(0, 12);
  return `agentbox-${hash}`;
};

export const startContainer = (options: ContainerStartOptions): ContainerInstance => {
  const { workspacePath, agentboxPath } = options;

  try {
    execFileSync(agentboxPath, ['shell', 'echo', 'ready'], {
      cwd: workspacePath,
      timeout: 30000,
      stdio: 'pipe',
    });

    const containerName = computeContainerName(workspacePath);

    return {
      containerId: containerName,
      containerName,
      workspacePath,
      agentboxPath,
    };
  } catch (e) {
    throw new ExecutionError(
      `Failed to start container: ${e instanceof Error ? e.message : String(e)}`,
      'CONTAINER_START_FAILED',
      'Could not start agentbox container. Verify Docker is running and agentbox is properly installed.',
    );
  }
};

export const stopContainer = (instance: ContainerInstance): boolean => {
  try {
    execFileSync('docker', ['stop', instance.containerName], {
      timeout: 10000,
      stdio: 'ignore',
    });
    return true;
  } catch {
    try {
      execFileSync('docker', ['kill', instance.containerName], {
        timeout: 5000,
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  }
};

// Module-level state for signal handler registration (prevents accumulation)
let activeContainersRef: Map<string, ContainerInstance> | undefined;
let cleanupRegistered = false;

export const registerContainerCleanup = (
  activeContainers: Map<string, ContainerInstance>,
): void => {
  activeContainersRef = activeContainers;
  if (cleanupRegistered) return;
  cleanupRegistered = true;

  const cleanup = () => {
    if (activeContainersRef) {
      for (const [, instance] of activeContainersRef) {
        stopContainer(instance);
      }
    }
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
};

// Exported for testing only
export const resetCleanupState = (): void => {
  activeContainersRef = undefined;
  cleanupRegistered = false;
};

export const listZeldaContainers = (): string[] => {
  try {
    const output = execFileSync(
      'docker',
      ['ps', '--filter', 'name=agentbox-', '--format', '{{.Names}}'],
      { timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf-8' },
    );
    return (output as string).split('\n').filter(Boolean);
  } catch {
    return [];
  }
};
