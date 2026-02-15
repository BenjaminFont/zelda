import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  toolUsageEvaluator,
  buildSystemPrompt,
  buildUserPrompt,
  parseJudgeResponse,
  formatManifest,
} from '../../../src/core/evaluators/tool-usage.js';
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
    metrics: { toolUsage: true },
    testSuiteName: 'test-api',
    prompt: 'Build an API',
    acceptanceCriteria: ['Works correctly'],
  },
  transcript: {
    messages: [
      { role: 'assistant', content: 'Building the API' },
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
  toolsManifest: {
    skills: [
      { name: 'deploy', path: '/tmp/.claude/commands/deploy.md', contentSummary: 'Deploy to production' },
      { name: 'test', path: '/tmp/.claude/commands/test.md', contentSummary: 'Run test suite' },
    ],
    rules: [
      { name: 'no-console', path: '/tmp/.claude/rules/no-console.md', contentSummary: 'No console.log' },
    ],
    subAgents: [],
    mcpConfigs: [],
  },
  ...overrides,
});

describe('evaluators/tool-usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildSystemPrompt', () => {
    it('instructs judge to return JSON with usedTools and missedTools', () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain('usedTools');
      expect(prompt).toContain('missedTools');
      expect(prompt).toContain('assessment');
    });
  });

  describe('formatManifest', () => {
    it('includes skills, rules in formatted output', () => {
      const output = formatManifest(makeContext());
      expect(output).toContain('deploy');
      expect(output).toContain('test');
      expect(output).toContain('no-console');
      expect(output).toContain('Skills');
      expect(output).toContain('Rules');
    });

    it('returns "No tools configured" for empty manifest', () => {
      const ctx = makeContext({
        toolsManifest: { skills: [], rules: [], subAgents: [], mcpConfigs: [] },
      });
      expect(formatManifest(ctx)).toBe('No tools configured.');
    });
  });

  describe('buildUserPrompt', () => {
    it('includes manifest and transcript', () => {
      const prompt = buildUserPrompt(makeContext());
      expect(prompt).toContain('deploy');
      expect(prompt).toContain('Building the API');
    });
  });

  describe('parseJudgeResponse', () => {
    it('parses valid JSON response', () => {
      const json = JSON.stringify({
        usedTools: [{ name: 'deploy', count: 2 }],
        missedTools: [{ name: 'test', reasoning: 'Tests should have been run' }],
        assessment: 'Partial tool utilization.',
      });

      const result = parseJudgeResponse(json);
      expect(result.usedTools).toHaveLength(1);
      expect(result.usedTools[0].name).toBe('deploy');
      expect(result.missedTools).toHaveLength(1);
      expect(result.missedTools[0].name).toBe('test');
      expect(result.assessment).toBe('Partial tool utilization.');
    });

    it('parses markdown-wrapped JSON', () => {
      const json = '```json\n' + JSON.stringify({
        usedTools: [],
        missedTools: [],
        assessment: 'All good.',
      }) + '\n```';

      const result = parseJudgeResponse(json);
      expect(result.assessment).toBe('All good.');
    });

    it('returns defaults for invalid JSON', () => {
      const result = parseJudgeResponse('not json');
      expect(result.usedTools).toHaveLength(0);
      expect(result.missedTools).toHaveLength(0);
      expect(result.assessment).toContain('could not be parsed');
    });
  });

  describe('toolUsageEvaluator', () => {
    it('returns metric "toolUsage"', async () => {
      const { judgeQuery } = await import('../../../src/core/judge/judge-client.js');
      (judgeQuery as any).mockResolvedValueOnce({
        content: JSON.stringify({
          usedTools: [{ name: 'deploy', count: 1 }],
          missedTools: [],
          assessment: 'Good.',
        }),
        inputTokens: 200,
        outputTokens: 100,
      });

      const result = await toolUsageEvaluator(makeContext());
      expect(result.metric).toBe('toolUsage');
    });

    it('returns 100 when no tools are missed', async () => {
      const { judgeQuery } = await import('../../../src/core/judge/judge-client.js');
      (judgeQuery as any).mockResolvedValueOnce({
        content: JSON.stringify({
          usedTools: [{ name: 'deploy', count: 1 }],
          missedTools: [],
          assessment: 'All tools used effectively.',
        }),
        inputTokens: 200,
        outputTokens: 100,
      });

      const result = await toolUsageEvaluator(makeContext());
      expect(result.score).toBe(100);
    });

    it('deducts score for missed tools', async () => {
      const { judgeQuery } = await import('../../../src/core/judge/judge-client.js');
      (judgeQuery as any).mockResolvedValueOnce({
        content: JSON.stringify({
          usedTools: [{ name: 'deploy', count: 1 }],
          missedTools: [
            { name: 'test', reasoning: 'Should have run tests' },
          ],
          assessment: 'Missed testing.',
        }),
        inputTokens: 200,
        outputTokens: 100,
      });

      const result = await toolUsageEvaluator(makeContext());
      // 1 missed out of 3 available: round((1 - 1/3) * 100) = 67
      expect(result.score).toBe(67);
    });

    it('returns 100 with neutral assessment for empty manifest', async () => {
      const ctx = makeContext({
        toolsManifest: { skills: [], rules: [], subAgents: [], mcpConfigs: [] },
      });

      const result = await toolUsageEvaluator(ctx);
      expect(result.score).toBe(100);
      expect(result.reasoning).toContain('No custom tools configured');
    });

    it('includes details with usedTools, missedTools, assessment', async () => {
      const { judgeQuery } = await import('../../../src/core/judge/judge-client.js');
      (judgeQuery as any).mockResolvedValueOnce({
        content: JSON.stringify({
          usedTools: [{ name: 'deploy', count: 3 }],
          missedTools: [{ name: 'test', reasoning: 'Missing' }],
          assessment: 'Partial.',
        }),
        inputTokens: 200,
        outputTokens: 100,
      });

      const result = await toolUsageEvaluator(makeContext());
      const details = result.details as any;
      expect(details.usedTools).toHaveLength(1);
      expect(details.missedTools).toHaveLength(1);
      expect(details.availableToolCount).toBe(3);
      expect(details.assessment).toBe('Partial.');
    });
  });
});
