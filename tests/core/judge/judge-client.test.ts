import { describe, it, expect, vi, beforeEach } from 'vitest';
import { judgeQuery } from '../../../src/core/judge/judge-client.js';
import type { JudgeClientOptions, JudgeRequest } from '../../../src/core/judge/judge-client.js';

// Mock the Anthropic SDK
const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = 'APIError';
    }
  }

  class MockAnthropic {
    messages = { create: mockCreate };
    static APIError = APIError;
    constructor() {}
  }

  return { default: MockAnthropic, APIError };
});

const defaultOptions: JudgeClientOptions = {
  gatewayUrl: 'https://api.portkey.ai/v1',
  apiKey: 'test-key',
  maxRetries: 2,
  timeoutMs: 5000,
};

const defaultRequest: JudgeRequest = {
  systemPrompt: 'You are a code evaluator.',
  userPrompt: 'Evaluate this code.',
  model: 'claude-sonnet-4-5-20250929',
};

const makeSuccessResponse = (text = 'Evaluation complete') => ({
  content: [{ type: 'text', text }],
  usage: { input_tokens: 100, output_tokens: 50 },
});

describe('judge/judge-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends system prompt and user prompt to the API', async () => {
    mockCreate.mockResolvedValueOnce(makeSuccessResponse());

    await judgeQuery(defaultOptions, defaultRequest);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-5-20250929',
        system: 'You are a code evaluator.',
        messages: [{ role: 'user', content: 'Evaluate this code.' }],
      }),
    );
  });

  it('returns content and token counts from response', async () => {
    mockCreate.mockResolvedValueOnce(makeSuccessResponse('Code looks good'));

    const result = await judgeQuery(defaultOptions, defaultRequest);

    expect(result.content).toBe('Code looks good');
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(50);
  });

  it('concatenates multiple text blocks', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: 'text', text: 'Part 1. ' },
        { type: 'thinking', thinking: 'internal' },
        { type: 'text', text: 'Part 2.' },
      ],
      usage: { input_tokens: 100, output_tokens: 80 },
    });

    const result = await judgeQuery(defaultOptions, defaultRequest);
    expect(result.content).toBe('Part 1. Part 2.');
  });

  it('uses default max_tokens when not specified', async () => {
    mockCreate.mockResolvedValueOnce(makeSuccessResponse());

    await judgeQuery(defaultOptions, defaultRequest);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ max_tokens: 4096 }),
    );
  });

  it('uses custom max_tokens when specified', async () => {
    mockCreate.mockResolvedValueOnce(makeSuccessResponse());

    await judgeQuery(defaultOptions, { ...defaultRequest, maxTokens: 2048 });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ max_tokens: 2048 }),
    );
  });

  it('throws JudgeError after retries on transient failure', async () => {
    const { APIError } = await import('@anthropic-ai/sdk');
    mockCreate
      .mockRejectedValueOnce(new (APIError as any)(429, 'Rate limited'))
      .mockRejectedValueOnce(new (APIError as any)(500, 'Server error'))
      .mockRejectedValueOnce(new (APIError as any)(503, 'Unavailable'));

    await expect(
      judgeQuery({ ...defaultOptions, maxRetries: 2 }, defaultRequest),
    ).rejects.toThrow('Judge API call failed');

    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it('succeeds on retry after transient failure', async () => {
    const { APIError } = await import('@anthropic-ai/sdk');
    mockCreate
      .mockRejectedValueOnce(new (APIError as any)(429, 'Rate limited'))
      .mockResolvedValueOnce(makeSuccessResponse('Recovered'));

    const result = await judgeQuery(defaultOptions, defaultRequest);
    expect(result.content).toBe('Recovered');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('does not retry on non-transient errors', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Invalid API key'));

    await expect(
      judgeQuery(defaultOptions, defaultRequest),
    ).rejects.toThrow('Judge API call failed');

    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('exposes only Zelda-owned types (JudgeResponse)', async () => {
    mockCreate.mockResolvedValueOnce(makeSuccessResponse());

    const result = await judgeQuery(defaultOptions, defaultRequest);

    // Result should only have our Zelda-owned fields
    expect(Object.keys(result).sort()).toEqual(['content', 'inputTokens', 'outputTokens']);
  });

  it('throws JudgeError with clear userMessage', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Connection refused'));

    try {
      await judgeQuery({ ...defaultOptions, maxRetries: 0 }, defaultRequest);
      expect.unreachable('Should have thrown');
    } catch (e: any) {
      expect(e.name).toBe('JudgeError');
      expect(e.userMessage).toContain('LLM judge evaluation failed');
      expect(e.code).toBe('JUDGE_API_FAILED');
    }
  });
});
