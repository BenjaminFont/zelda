// Runtime detector — checks Docker/Podman and agentbox availability

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { ExecutionError } from '../errors.js';
import type { RuntimeDetectionResult } from '../types.js';

let cachedResult: RuntimeDetectionResult | undefined;

const isCommandAvailable = (command: string, args: string[]): boolean => {
  try {
    execFileSync(command, args, { timeout: 5000, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const findAgentbox = (configuredPath?: string): string | undefined => {
  if (configuredPath) {
    if (existsSync(configuredPath)) {
      return configuredPath;
    }
    throw new ExecutionError(
      `Configured agentboxPath does not exist: ${configuredPath}`,
      'AGENTBOX_PATH_INVALID',
      `Configured agentboxPath does not exist: ${configuredPath}`,
    );
  }

  // Platform-aware PATH lookup: 'where' on Windows, 'which' on Unix
  const lookupCommand = process.platform === 'win32' ? 'where' : 'which';
  try {
    const result = execFileSync(lookupCommand, ['agentbox'], {
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf-8',
    });
    return result.trim() || undefined;
  } catch {
    return undefined;
  }
};

export const detectRuntime = (config: { agentboxPath?: string }): RuntimeDetectionResult => {
  if (cachedResult) return cachedResult;

  // Check Docker first, then Podman
  let containerRuntime: 'docker' | 'podman' | undefined;
  if (isCommandAvailable('docker', ['info'])) {
    containerRuntime = 'docker';
  } else if (isCommandAvailable('podman', ['info'])) {
    containerRuntime = 'podman';
  }

  if (!containerRuntime) {
    cachedResult = {
      available: false,
      warnings: [
        'Docker/Podman not found. Running in local mode. Containerized execution is recommended for host isolation.',
      ],
    };
    return cachedResult;
  }

  // Container runtime found — check agentbox
  // Note: findAgentbox throws AGENTBOX_PATH_INVALID for bad configured paths (config error).
  // Missing agentbox in PATH returns undefined (handled below as unavailable).
  const agentboxPath = findAgentbox(config.agentboxPath);

  if (!agentboxPath) {
    cachedResult = {
      available: false,
      containerRuntime,
      warnings: [
        'agentbox not found. Install agentbox for containerized execution:\n' +
          '  git clone https://github.com/fletchgqc/agentbox\n' +
          '  chmod +x agentbox/agentbox\n' +
          '  Add agentbox directory to your PATH',
      ],
    };
    return cachedResult;
  }

  cachedResult = {
    available: true,
    containerRuntime,
    agentboxPath,
    warnings: [],
  };
  return cachedResult;
};

export const clearRuntimeCache = (): void => {
  cachedResult = undefined;
};
