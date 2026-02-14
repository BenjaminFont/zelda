import { describe, it, expect } from 'vitest';
import { efficiencyEvaluator } from '../../../src/core/evaluators/efficiency.js';
import type { EvalContext } from '../../../src/core/types.js';

const makeContext = (overrides?: Partial<EvalContext>): EvalContext => ({
  config: {
    judgeModel: 'claude-sonnet-4-5-20250929',
    gatewayUrl: 'https://api.portkey.ai/v1',
    resultsDir: '.zelda/runs',
    testDir: 'zelda',
    execution: {},
    metrics: {},
    testSuiteName: 'test',
    prompt: 'test',
    acceptanceCriteria: ['works'],
  },
  transcript: {
    messages: [],
    metadata: {
      costUsd: 0.05,
      inputTokens: 500,
      outputTokens: 1000,
      turnCount: 5,
      durationMs: 30000,
      errorCount: 0,
    },
  },
  workspacePath: '/tmp/workspace',
  toolsManifest: { skills: [], rules: [], subAgents: [], mcpConfigs: [] },
  ...overrides,
});

describe('evaluators/efficiency', () => {
  it('returns metric "efficiency"', async () => {
    const result = await efficiencyEvaluator(makeContext());
    expect(result.metric).toBe('efficiency');
  });

  it('returns score between 0 and 100', async () => {
    const result = await efficiencyEvaluator(makeContext());
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('includes all expected detail fields', async () => {
    const result = await efficiencyEvaluator(makeContext());
    const details = result.details as Record<string, unknown>;
    expect(details).toHaveProperty('totalTokens');
    expect(details).toHaveProperty('inputTokens');
    expect(details).toHaveProperty('outputTokens');
    expect(details).toHaveProperty('costUsd');
    expect(details).toHaveProperty('turnCount');
    expect(details).toHaveProperty('durationMs');
    expect(details).toHaveProperty('toolCallCounts');
    expect(details).toHaveProperty('errorCount');
  });

  it('computes totalTokens from input + output', async () => {
    const result = await efficiencyEvaluator(makeContext());
    const details = result.details as { totalTokens: number; inputTokens: number; outputTokens: number };
    expect(details.totalTokens).toBe(1500);
    expect(details.inputTokens).toBe(500);
    expect(details.outputTokens).toBe(1000);
  });

  it('counts tool calls grouped by type', async () => {
    const ctx = makeContext({
      transcript: {
        messages: [
          {
            role: 'assistant',
            content: 'Working on it',
            toolCalls: [
              { toolName: 'Read', input: { path: 'a.ts' } },
              { toolName: 'Write', input: { path: 'b.ts', content: 'x' } },
              { toolName: 'Read', input: { path: 'c.ts' } },
            ],
          },
          {
            role: 'assistant',
            content: 'Done',
            toolCalls: [
              { toolName: 'Bash', input: { command: 'npm test' } },
            ],
          },
        ],
        metadata: {
          costUsd: 0.03,
          inputTokens: 300,
          outputTokens: 600,
          turnCount: 2,
          durationMs: 15000,
          errorCount: 0,
        },
      },
    });

    const result = await efficiencyEvaluator(ctx);
    const details = result.details as { toolCallCounts: Record<string, number> };
    expect(details.toolCallCounts['Read']).toBe(2);
    expect(details.toolCallCounts['Write']).toBe(1);
    expect(details.toolCallCounts['Bash']).toBe(1);
  });

  it('returns empty toolCallCounts when no tool calls', async () => {
    const result = await efficiencyEvaluator(makeContext());
    const details = result.details as { toolCallCounts: Record<string, number> };
    expect(Object.keys(details.toolCallCounts)).toHaveLength(0);
  });

  it('deducts score for errors', async () => {
    const noErrors = await efficiencyEvaluator(makeContext());
    const withErrors = await efficiencyEvaluator(
      makeContext({
        transcript: {
          messages: [],
          metadata: {
            costUsd: 0.05,
            inputTokens: 500,
            outputTokens: 1000,
            turnCount: 5,
            durationMs: 30000,
            errorCount: 3,
          },
        },
      }),
    );

    expect(withErrors.score).toBeLessThan(noErrors.score);
  });

  it('deducts score for excessive turns', async () => {
    const fewTurns = await efficiencyEvaluator(makeContext());
    const manyTurns = await efficiencyEvaluator(
      makeContext({
        transcript: {
          messages: [],
          metadata: {
            costUsd: 0.05,
            inputTokens: 500,
            outputTokens: 1000,
            turnCount: 30,
            durationMs: 30000,
            errorCount: 0,
          },
        },
      }),
    );

    expect(manyTurns.score).toBeLessThan(fewTurns.score);
  });

  it('includes reasoning string', async () => {
    const result = await efficiencyEvaluator(makeContext());
    expect(result.reasoning).toBeDefined();
    expect(result.reasoning).toContain('1500 tokens');
    expect(result.reasoning).toContain('5 turns');
  });

  it('handles zero-turn transcript gracefully', async () => {
    const result = await efficiencyEvaluator(
      makeContext({
        transcript: {
          messages: [],
          metadata: {
            costUsd: 0,
            inputTokens: 0,
            outputTokens: 0,
            turnCount: 0,
            durationMs: 0,
            errorCount: 0,
          },
        },
      }),
    );

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('conforms to Evaluator type signature', async () => {
    const ctx = makeContext();
    const result = await efficiencyEvaluator(ctx);
    expect(result).toHaveProperty('metric');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('details');
  });
});
