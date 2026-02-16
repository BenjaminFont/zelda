import { describe, it, expect, vi } from 'vitest';
import { ExecutionError } from '../../../src/core/errors.js';

// Mock the Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

import { executeSession } from '../../../src/core/execution/execution-client.js';
import { query } from '@anthropic-ai/claude-agent-sdk';

const mockQuery = vi.mocked(query);

// Helper to create an async generator from an array of messages
async function* asyncMessages(messages: unknown[]) {
  for (const msg of messages) {
    yield msg;
  }
}

describe('execution/execution-client', () => {
  it('executes a session and returns a structured transcript', async () => {
    const sdkMessages = [
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'I will create the file.' },
            { type: 'tool_use', name: 'Write', input: { path: 'src/index.ts', content: 'hello' } },
          ],
        },
      },
      {
        type: 'result',
        subtype: 'success',
        total_cost_usd: 0.05,
        usage: { input_tokens: 500, output_tokens: 1000 },
        num_turns: 2,
        duration_ms: 30000,
      },
    ];

    mockQuery.mockReturnValue(asyncMessages(sdkMessages) as ReturnType<typeof query>);

    const result = await executeSession({
      prompt: 'Build a REST API',
      workspacePath: '/tmp/workspace',
      model: 'claude-sonnet-4-5-20250929',
      maxTurns: 10,
    });

    expect(result.transcript.messages).toHaveLength(1);
    expect(result.transcript.messages[0].role).toBe('assistant');
    expect(result.transcript.messages[0].content).toBe('I will create the file.');
    expect(result.transcript.messages[0].toolCalls).toHaveLength(1);
    expect(result.transcript.messages[0].toolCalls![0].toolName).toBe('Write');

    expect(result.transcript.metadata.costUsd).toBe(0.05);
    expect(result.transcript.metadata.inputTokens).toBe(500);
    expect(result.transcript.metadata.outputTokens).toBe(1000);
    expect(result.transcript.metadata.turnCount).toBe(2);
    expect(result.transcript.metadata.durationMs).toBe(30000);
    expect(result.transcript.metadata.errorCount).toBe(0);
  });

  it('captures error count from non-success results', async () => {
    const sdkMessages = [
      {
        type: 'result',
        subtype: 'error_max_turns',
        total_cost_usd: 0.10,
        usage: { input_tokens: 1000, output_tokens: 2000 },
        num_turns: 25,
        duration_ms: 60000,
      },
    ];

    mockQuery.mockReturnValue(asyncMessages(sdkMessages) as ReturnType<typeof query>);

    const result = await executeSession({
      prompt: 'Build something complex',
      workspacePath: '/tmp/workspace',
    });

    expect(result.transcript.metadata.errorCount).toBe(1);
  });

  it('handles multiple assistant messages', async () => {
    const sdkMessages = [
      {
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'First response' }],
        },
      },
      {
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'Second response' }],
        },
      },
      {
        type: 'result',
        subtype: 'success',
        total_cost_usd: 0.03,
        usage: { input_tokens: 300, output_tokens: 600 },
        num_turns: 2,
        duration_ms: 15000,
      },
    ];

    mockQuery.mockReturnValue(asyncMessages(sdkMessages) as ReturnType<typeof query>);

    const result = await executeSession({
      prompt: 'Test',
      workspacePath: '/tmp/workspace',
    });

    expect(result.transcript.messages).toHaveLength(2);
    expect(result.transcript.messages[0].content).toBe('First response');
    expect(result.transcript.messages[1].content).toBe('Second response');
  });

  it('omits toolCalls when none present', async () => {
    const sdkMessages = [
      {
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'Just text, no tools' }],
        },
      },
      {
        type: 'result',
        subtype: 'success',
        total_cost_usd: 0.01,
        usage: { input_tokens: 100, output_tokens: 200 },
        num_turns: 1,
        duration_ms: 5000,
      },
    ];

    mockQuery.mockReturnValue(asyncMessages(sdkMessages) as ReturnType<typeof query>);

    const result = await executeSession({
      prompt: 'Question only',
      workspacePath: '/tmp/workspace',
    });

    expect(result.transcript.messages[0].toolCalls).toBeUndefined();
  });

  it('throws ExecutionError when SDK throws', async () => {
    mockQuery.mockImplementation(() => {
      throw new Error('API key invalid');
    });

    await expect(
      executeSession({
        prompt: 'Test',
        workspacePath: '/tmp/workspace',
      }),
    ).rejects.toThrow(ExecutionError);

    try {
      await executeSession({
        prompt: 'Test',
        workspacePath: '/tmp/workspace',
      });
    } catch (e) {
      const err = e as ExecutionError;
      expect(err.code).toBe('EXECUTION_SESSION_FAILED');
      expect(err.userMessage).toContain('ANTHROPIC_API_KEY');
    }
  });

  it('passes correct options to SDK query', async () => {
    const sdkMessages = [
      {
        type: 'result',
        subtype: 'success',
        total_cost_usd: 0,
        usage: { input_tokens: 0, output_tokens: 0 },
        num_turns: 0,
        duration_ms: 0,
      },
    ];

    mockQuery.mockReturnValue(asyncMessages(sdkMessages) as ReturnType<typeof query>);

    await executeSession({
      prompt: 'Build it',
      workspacePath: '/tmp/ws',
      model: 'claude-opus-4-6',
      maxTurns: 5,
    });

    expect(mockQuery).toHaveBeenCalledWith({
      prompt: 'Build it',
      options: {
        cwd: '/tmp/ws',
        model: 'claude-opus-4-6',
        maxTurns: 5,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        persistSession: false,
      },
    });
  });

  it('skips non-assistant non-result messages', async () => {
    const sdkMessages = [
      { type: 'system', subtype: 'init', model: 'claude-sonnet-4-5-20250929' },
      {
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'Working on it' }],
        },
      },
      { type: 'tool_progress', tool_use_id: '123', tool_name: 'Bash', elapsed_time_seconds: 5 },
      {
        type: 'result',
        subtype: 'success',
        total_cost_usd: 0.02,
        usage: { input_tokens: 200, output_tokens: 400 },
        num_turns: 1,
        duration_ms: 10000,
      },
    ];

    mockQuery.mockReturnValue(asyncMessages(sdkMessages) as ReturnType<typeof query>);

    const result = await executeSession({
      prompt: 'Test',
      workspacePath: '/tmp/workspace',
    });

    expect(result.transcript.messages).toHaveLength(1);
    expect(result.transcript.messages[0].content).toBe('Working on it');
  });
});
