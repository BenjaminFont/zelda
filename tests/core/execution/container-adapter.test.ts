import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import {
  executeSessionInContainer,
  parseClaudeCliOutput,
  resolveExecutionBackend,
} from '../../../src/core/execution/container-adapter.js';
import { executeSession } from '../../../src/core/execution/execution-client.js';
import { ExecutionError } from '../../../src/core/errors.js';
import type { ContainerInstance } from '../../../src/core/types.js';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('../../../src/core/execution/execution-client.js', () => ({
  executeSession: vi.fn(),
}));

const containerInstance: ContainerInstance = {
  containerId: 'agentbox-abc123',
  containerName: 'agentbox-abc123',
  workspacePath: '/tmp/workspace',
  agentboxPath: '/usr/local/bin/agentbox',
};

const sampleCliOutput = JSON.stringify({
  type: 'result',
  subtype: 'success',
  cost_usd: 0.05,
  duration_ms: 30000,
  duration_api_ms: 25000,
  is_error: false,
  num_turns: 3,
  result: 'I created the REST API with the following endpoints...',
  session_id: 'session-123',
  total_cost_usd: 0.05,
  usage: {
    input_tokens: 500,
    output_tokens: 1000,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  },
});

// Helper to create a mock child process
const createMockProcess = (stdout: string, exitCode = 0) => {
  const proc = new EventEmitter() as ReturnType<typeof spawn>;
  const stdoutEmitter = new EventEmitter();
  const stderrEmitter = new EventEmitter();
  (proc as unknown as Record<string, unknown>).stdout = stdoutEmitter;
  (proc as unknown as Record<string, unknown>).stderr = stderrEmitter;
  (proc as unknown as Record<string, unknown>).stdin = null;
  (proc as unknown as Record<string, unknown>).pid = 12345;

  // Emit data and close in next tick (after listeners are attached)
  process.nextTick(() => {
    if (stdout) {
      stdoutEmitter.emit('data', Buffer.from(stdout));
    }
    proc.emit('close', exitCode);
  });

  return proc;
};

describe('execution/container-adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveExecutionBackend', () => {
    it('returns local executeSession when backend is local', () => {
      const backend = resolveExecutionBackend('local');
      expect(backend).toBe(executeSession);
    });

    it('returns container adapter when backend is container with instance', () => {
      const backend = resolveExecutionBackend('container', containerInstance);
      expect(backend).not.toBe(executeSession);
      expect(typeof backend).toBe('function');
    });

    it('falls back to local when container specified but no instance', () => {
      const backend = resolveExecutionBackend('container');
      expect(backend).toBe(executeSession);
    });
  });

  describe('parseClaudeCliOutput', () => {
    it('parses result JSON with messages and metadata', () => {
      const transcript = parseClaudeCliOutput(sampleCliOutput);

      expect(transcript.messages).toHaveLength(1);
      expect(transcript.messages[0].role).toBe('assistant');
      expect(transcript.messages[0].content).toContain('REST API');
      expect(transcript.metadata.costUsd).toBe(0.05);
      expect(transcript.metadata.inputTokens).toBe(500);
      expect(transcript.metadata.outputTokens).toBe(1000);
      expect(transcript.metadata.turnCount).toBe(3);
      expect(transcript.metadata.durationMs).toBe(30000);
      expect(transcript.metadata.errorCount).toBe(0);
    });

    it('sets errorCount when subtype is not success', () => {
      const output = JSON.stringify({
        type: 'result',
        subtype: 'error_max_turns',
        cost_usd: 0.10,
        duration_ms: 60000,
        is_error: true,
        num_turns: 25,
        result: 'Ran out of turns',
        total_cost_usd: 0.10,
        usage: { input_tokens: 1000, output_tokens: 2000 },
      });

      const transcript = parseClaudeCliOutput(output);
      expect(transcript.metadata.errorCount).toBe(1);
    });

    it('handles empty result text gracefully', () => {
      const output = JSON.stringify({
        type: 'result',
        subtype: 'success',
        cost_usd: 0,
        duration_ms: 0,
        is_error: false,
        num_turns: 0,
        result: '',
        total_cost_usd: 0,
        usage: { input_tokens: 0, output_tokens: 0 },
      });

      const transcript = parseClaudeCliOutput(output);
      expect(transcript.messages).toHaveLength(0);
      expect(transcript.metadata.turnCount).toBe(0);
    });

    it('handles multi-line JSONL output (stream-json format)', () => {
      const lines = [
        JSON.stringify({ type: 'assistant', content: [{ type: 'text', text: 'Working on it...' }], model: 'claude-sonnet-4-5-20250929' }),
        JSON.stringify({ type: 'assistant', content: [{ type: 'text', text: 'Done!' }, { type: 'tool_use', name: 'Write', input: { path: 'file.ts' } }], model: 'claude-sonnet-4-5-20250929' }),
        JSON.stringify({
          type: 'result',
          subtype: 'success',
          cost_usd: 0.03,
          duration_ms: 15000,
          is_error: false,
          num_turns: 2,
          result: 'Done!',
          total_cost_usd: 0.03,
          usage: { input_tokens: 300, output_tokens: 600 },
        }),
      ].join('\n');

      const transcript = parseClaudeCliOutput(lines);
      expect(transcript.messages).toHaveLength(2);
      expect(transcript.messages[0].content).toBe('Working on it...');
      expect(transcript.messages[0].toolCalls).toBeUndefined();
      expect(transcript.messages[1].content).toBe('Done!');
      expect(transcript.messages[1].toolCalls).toHaveLength(1);
      expect(transcript.messages[1].toolCalls![0].toolName).toBe('Write');
      expect(transcript.metadata.turnCount).toBe(2);
    });

    it('throws ExecutionError on invalid JSON', () => {
      try {
        parseClaudeCliOutput('not json at all');
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ExecutionError);
        expect((e as ExecutionError).code).toBe('EXECUTION_PARSE_FAILED');
      }
    });
  });

  describe('executeSessionInContainer', () => {
    it('spawns agentbox with correct claude CLI args', async () => {
      const mockProc = createMockProcess(sampleCliOutput);
      vi.mocked(spawn).mockReturnValue(mockProc);

      await executeSessionInContainer(
        {
          prompt: 'Build a REST API',
          workspacePath: '/tmp/workspace',
          model: 'claude-sonnet-4-5-20250929',
          maxTurns: 10,
        },
        containerInstance,
      );

      expect(spawn).toHaveBeenCalledWith(
        '/usr/local/bin/agentbox',
        [
          'shell', 'claude',
          '--dangerously-skip-permissions',
          '--output-format', 'stream-json',
          '-p', 'Build a REST API',
          '--model', 'claude-sonnet-4-5-20250929',
          '--max-turns', '10',
        ],
        expect.objectContaining({
          cwd: '/tmp/workspace',
        }),
      );
    });

    it('returns ExecutionResult with valid SessionTranscript', async () => {
      const mockProc = createMockProcess(sampleCliOutput);
      vi.mocked(spawn).mockReturnValue(mockProc);

      const result = await executeSessionInContainer(
        { prompt: 'Build it', workspacePath: '/tmp/workspace' },
        containerInstance,
      );

      expect(result.transcript.messages).toHaveLength(1);
      expect(result.transcript.metadata.costUsd).toBe(0.05);
    });

    it('throws ExecutionError on non-zero exit code', async () => {
      const mockProc = createMockProcess('', 1);
      vi.mocked(spawn).mockReturnValue(mockProc);

      await expect(
        executeSessionInContainer(
          { prompt: 'Fail', workspacePath: '/tmp/workspace' },
          containerInstance,
        ),
      ).rejects.toThrow(ExecutionError);
    });

    it('passes environment variables through', async () => {
      const mockProc = createMockProcess(sampleCliOutput);
      vi.mocked(spawn).mockReturnValue(mockProc);

      await executeSessionInContainer(
        { prompt: 'Build it', workspacePath: '/tmp/workspace' },
        containerInstance,
      );

      expect(spawn).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          env: expect.objectContaining(process.env),
        }),
      );
    });

    it('omits optional args when not provided', async () => {
      const mockProc = createMockProcess(sampleCliOutput);
      vi.mocked(spawn).mockReturnValue(mockProc);

      await executeSessionInContainer(
        { prompt: 'Simple task', workspacePath: '/tmp/workspace' },
        containerInstance,
      );

      const spawnArgs = vi.mocked(spawn).mock.calls[0][1] as string[];
      expect(spawnArgs).not.toContain('--model');
      expect(spawnArgs).not.toContain('--max-turns');
    });
  });
});
