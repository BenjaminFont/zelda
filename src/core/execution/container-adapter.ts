// Container execution adapter — runs Claude Code inside agentbox container
// Parses CLI JSON output into SessionTranscript matching local execution format

import { spawn } from 'node:child_process';
import { ExecutionError } from '../errors.js';
import { executeSession } from './execution-client.js';
import type {
  ExecutionParams,
  ExecutionResult,
  ExecutionBackendFn,
  SessionTranscript,
  TranscriptMessage,
  SessionMetadata,
  ToolCall,
  ContainerInstance,
} from '../types.js';

export const resolveExecutionBackend = (
  backend: 'container' | 'local',
  container?: ContainerInstance,
): ExecutionBackendFn => {
  if (backend === 'container' && container) {
    return (params) => executeSessionInContainer(params, container);
  }
  return executeSession;
};

export const parseClaudeCliOutput = (rawOutput: string): SessionTranscript => {
  const messages: TranscriptMessage[] = [];
  const metadata: SessionMetadata = {
    costUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
    turnCount: 0,
    durationMs: 0,
    errorCount: 0,
  };

  const lines = rawOutput.trim().split('\n').filter(Boolean);
  if (lines.length === 0) {
    return { messages, metadata };
  }

  for (const line of lines) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new ExecutionError(
        `Failed to parse Claude CLI output line: ${line.slice(0, 100)}`,
        'EXECUTION_PARSE_FAILED',
        'Could not parse Claude Code output from container. The CLI output format may be unsupported.',
      );
    }

    if (parsed.type === 'assistant') {
      const contentBlocks = (parsed.content ?? []) as Array<Record<string, unknown>>;
      let textContent = '';
      const toolCalls: ToolCall[] = [];

      for (const block of contentBlocks) {
        if (block.type === 'text' && typeof block.text === 'string') {
          textContent += block.text;
        }
        if (block.type === 'tool_use' && typeof block.name === 'string') {
          toolCalls.push({
            toolName: block.name,
            input: block.input,
          });
        }
      }

      const msg: TranscriptMessage = {
        role: 'assistant',
        content: textContent,
      };
      if (toolCalls.length > 0) {
        msg.toolCalls = toolCalls;
      }
      messages.push(msg);
    }

    if (parsed.type === 'result') {
      metadata.costUsd = (parsed.total_cost_usd ?? parsed.cost_usd ?? 0) as number;
      metadata.inputTokens = ((parsed.usage as Record<string, unknown>)?.input_tokens ?? 0) as number;
      metadata.outputTokens = ((parsed.usage as Record<string, unknown>)?.output_tokens ?? 0) as number;
      metadata.turnCount = (parsed.num_turns ?? 0) as number;
      metadata.durationMs = (parsed.duration_ms ?? 0) as number;

      if (parsed.subtype !== 'success') {
        metadata.errorCount += 1;
      }

      // If no assistant messages yet but result has text, create one
      if (messages.length === 0 && typeof parsed.result === 'string' && parsed.result !== '') {
        messages.push({
          role: 'assistant',
          content: parsed.result,
        });
      }
    }
  }

  return { messages, metadata };
};

export const executeSessionInContainer = async (
  params: ExecutionParams,
  container: ContainerInstance,
): Promise<ExecutionResult> => {
  const { prompt, workspacePath, model, maxTurns } = params;

  const claudeArgs = [
    '--dangerously-skip-permissions',
    '--output-format', 'stream-json',
    '-p', prompt,
  ];
  if (model) claudeArgs.push('--model', model);
  if (maxTurns) claudeArgs.push('--max-turns', String(maxTurns));

  const agentboxArgs = ['shell', 'claude', ...claudeArgs];

  return new Promise<ExecutionResult>((resolve, reject) => {
    try {
      const child = spawn(container.agentboxPath, agentboxArgs, {
        cwd: workspacePath,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('close', (code: number | null) => {
        if (code !== 0 && code !== null) {
          reject(new ExecutionError(
            `Container execution failed (exit code ${code}): ${stderr.slice(0, 500)}`,
            'CONTAINER_EXEC_FAILED',
            'Failed to execute Claude Code inside container. Check container logs and ANTHROPIC_API_KEY.',
          ));
          return;
        }

        try {
          const transcript = parseClaudeCliOutput(stdout);
          resolve({ transcript });
        } catch (e) {
          reject(e);
        }
      });
    } catch (e) {
      reject(new ExecutionError(
        `Failed to spawn container process: ${e instanceof Error ? e.message : String(e)}`,
        'CONTAINER_EXEC_FAILED',
        'Failed to execute command inside container.',
      ));
    }
  });
};
