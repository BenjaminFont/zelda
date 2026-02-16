import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fulfillmentEvaluator,
  buildSystemPrompt,
  buildUserPrompt,
  parseJudgeResponse,
} from '../../../src/core/evaluators/fulfillment.js';
import type { EvalContext } from '../../../src/core/types.js';

// Mock the judge client
vi.mock('../../../src/core/judge/judge-client.js', () => ({
  judgeQuery: vi.fn(),
}));

const makeContext = (overrides?: Partial<EvalContext>): EvalContext => ({
  config: {
    judgeModel: 'claude-sonnet-4-5-20250929',
    gatewayUrl: 'https://api.portkey.ai/v1',
    resultsDir: '.zelda/runs',
    testDir: 'zelda',
    execution: {},
    metrics: { requirementFulfillment: true },
    testSuiteName: 'test-api',
    prompt: 'Build an API',
    acceptanceCriteria: [
      'GET /api/hello returns 200',
      'Response is valid JSON',
      'Response contains message field',
    ],
  },
  transcript: {
    messages: [
      {
        role: 'assistant',
        content: 'I will create the API endpoint.',
        toolCalls: [
          { toolName: 'Write', input: { path: 'server.ts', content: 'code' } },
        ],
      },
    ],
    metadata: {
      costUsd: 0.05,
      inputTokens: 500,
      outputTokens: 1000,
      turnCount: 3,
      durationMs: 15000,
      errorCount: 0,
    },
  },
  workspacePath: '/tmp/workspace',
  toolsManifest: { skills: [], rules: [], subAgents: [], mcpConfigs: [] },
  ...overrides,
});

describe('evaluators/fulfillment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildSystemPrompt', () => {
    it('instructs judge to respond with JSON array', () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain('JSON array');
      expect(prompt).toContain('criterion');
      expect(prompt).toContain('passed');
      expect(prompt).toContain('reasoning');
    });
  });

  describe('buildUserPrompt', () => {
    it('includes transcript messages', () => {
      const ctx = makeContext();
      const prompt = buildUserPrompt(ctx);
      expect(prompt).toContain('I will create the API endpoint.');
    });

    it('includes acceptance criteria numbered', () => {
      const ctx = makeContext();
      const prompt = buildUserPrompt(ctx);
      expect(prompt).toContain('1. GET /api/hello returns 200');
      expect(prompt).toContain('2. Response is valid JSON');
      expect(prompt).toContain('3. Response contains message field');
    });

    it('includes tool calls in transcript', () => {
      const ctx = makeContext();
      const prompt = buildUserPrompt(ctx);
      expect(prompt).toContain('Write');
    });
  });

  describe('parseJudgeResponse', () => {
    const criteria = ['Criterion A', 'Criterion B', 'Criterion C'];

    it('parses valid JSON response', () => {
      const json = JSON.stringify([
        { criterion: 'Criterion A', passed: true, reasoning: 'Works' },
        { criterion: 'Criterion B', passed: false, reasoning: 'Missing' },
        { criterion: 'Criterion C', passed: true, reasoning: 'OK' },
      ]);

      const results = parseJudgeResponse(json, criteria);
      expect(results).toHaveLength(3);
      expect(results[0].passed).toBe(true);
      expect(results[0].reasoning).toBe('Works');
      expect(results[1].passed).toBe(false);
      expect(results[1].reasoning).toBe('Missing');
    });

    it('parses markdown-wrapped JSON', () => {
      const json = '```json\n' + JSON.stringify([
        { criterion: 'Criterion A', passed: true, reasoning: 'OK' },
        { criterion: 'Criterion B', passed: true, reasoning: 'OK' },
        { criterion: 'Criterion C', passed: true, reasoning: 'OK' },
      ]) + '\n```';

      const results = parseJudgeResponse(json, criteria);
      expect(results).toHaveLength(3);
      expect(results.every((r) => r.passed)).toBe(true);
    });

    it('returns all failed for invalid JSON', () => {
      const results = parseJudgeResponse('not json at all', criteria);
      expect(results).toHaveLength(3);
      expect(results.every((r) => !r.passed)).toBe(true);
      expect(results[0].reasoning).toContain('could not be parsed');
    });

    it('returns all failed for non-array JSON', () => {
      const results = parseJudgeResponse('{"not": "array"}', criteria);
      expect(results).toHaveLength(3);
      expect(results.every((r) => !r.passed)).toBe(true);
      expect(results[0].reasoning).toContain('not a JSON array');
    });

    it('handles missing criteria in judge response', () => {
      const json = JSON.stringify([
        { criterion: 'Criterion A', passed: true, reasoning: 'OK' },
        // B and C missing
      ]);

      const results = parseJudgeResponse(json, criteria);
      expect(results[0].passed).toBe(true);
      expect(results[1].passed).toBe(false);
      expect(results[1].reasoning).toContain('not evaluated');
      expect(results[2].passed).toBe(false);
    });

    it('fuzzy matches criteria (case insensitive)', () => {
      const json = JSON.stringify([
        { criterion: 'criterion a', passed: true, reasoning: 'Matched' },
        { criterion: 'CRITERION B', passed: true, reasoning: 'Matched' },
        { criterion: '  Criterion C  ', passed: true, reasoning: 'Matched' },
      ]);

      const results = parseJudgeResponse(json, criteria);
      expect(results.every((r) => r.passed)).toBe(true);
    });
  });

  describe('fulfillmentEvaluator', () => {
    it('returns metric "requirementFulfillment"', async () => {
      const { judgeQuery } = await import('../../../src/core/judge/judge-client.js');
      (judgeQuery as any).mockResolvedValueOnce({
        content: JSON.stringify([
          { criterion: 'GET /api/hello returns 200', passed: true, reasoning: 'OK' },
          { criterion: 'Response is valid JSON', passed: true, reasoning: 'OK' },
          { criterion: 'Response contains message field', passed: true, reasoning: 'OK' },
        ]),
        inputTokens: 200,
        outputTokens: 100,
      });

      const result = await fulfillmentEvaluator(makeContext());
      expect(result.metric).toBe('requirementFulfillment');
    });

    it('computes score as percentage of passed criteria', async () => {
      const { judgeQuery } = await import('../../../src/core/judge/judge-client.js');
      (judgeQuery as any).mockResolvedValueOnce({
        content: JSON.stringify([
          { criterion: 'GET /api/hello returns 200', passed: true, reasoning: 'OK' },
          { criterion: 'Response is valid JSON', passed: false, reasoning: 'Not JSON' },
          { criterion: 'Response contains message field', passed: true, reasoning: 'OK' },
        ]),
        inputTokens: 200,
        outputTokens: 100,
      });

      const result = await fulfillmentEvaluator(makeContext());
      // 2/3 = 66.7%
      expect(result.score).toBeCloseTo(66.7, 0);
    });

    it('returns 100 when all criteria pass', async () => {
      const { judgeQuery } = await import('../../../src/core/judge/judge-client.js');
      (judgeQuery as any).mockResolvedValueOnce({
        content: JSON.stringify([
          { criterion: 'GET /api/hello returns 200', passed: true, reasoning: 'OK' },
          { criterion: 'Response is valid JSON', passed: true, reasoning: 'OK' },
          { criterion: 'Response contains message field', passed: true, reasoning: 'OK' },
        ]),
        inputTokens: 200,
        outputTokens: 100,
      });

      const result = await fulfillmentEvaluator(makeContext());
      expect(result.score).toBe(100);
    });

    it('includes per-criterion details in result', async () => {
      const { judgeQuery } = await import('../../../src/core/judge/judge-client.js');
      (judgeQuery as any).mockResolvedValueOnce({
        content: JSON.stringify([
          { criterion: 'GET /api/hello returns 200', passed: true, reasoning: 'Endpoint works' },
          { criterion: 'Response is valid JSON', passed: true, reasoning: 'Valid' },
          { criterion: 'Response contains message field', passed: false, reasoning: 'Missing field' },
        ]),
        inputTokens: 200,
        outputTokens: 100,
      });

      const result = await fulfillmentEvaluator(makeContext());
      const details = result.details as { criteria: any[]; passedCount: number; totalCount: number };
      expect(details.criteria).toHaveLength(3);
      expect(details.passedCount).toBe(2);
      expect(details.totalCount).toBe(3);
      expect(details.criteria[2].reasoning).toBe('Missing field');
    });

    it('includes reasoning with pass/fail summary', async () => {
      const { judgeQuery } = await import('../../../src/core/judge/judge-client.js');
      (judgeQuery as any).mockResolvedValueOnce({
        content: JSON.stringify([
          { criterion: 'GET /api/hello returns 200', passed: true, reasoning: 'OK' },
          { criterion: 'Response is valid JSON', passed: true, reasoning: 'OK' },
          { criterion: 'Response contains message field', passed: true, reasoning: 'OK' },
        ]),
        inputTokens: 200,
        outputTokens: 100,
      });

      const result = await fulfillmentEvaluator(makeContext());
      expect(result.reasoning).toContain('3/3 criteria passed');
    });

    it('sends correct model and gateway to judgeQuery', async () => {
      const { judgeQuery } = await import('../../../src/core/judge/judge-client.js');
      (judgeQuery as any).mockResolvedValueOnce({
        content: '[]',
        inputTokens: 100,
        outputTokens: 50,
      });

      await fulfillmentEvaluator(makeContext());

      expect(judgeQuery).toHaveBeenCalledWith(
        expect.objectContaining({ gatewayUrl: 'https://api.portkey.ai/v1' }),
        expect.objectContaining({ model: 'claude-sonnet-4-5-20250929' }),
      );
    });
  });
});
