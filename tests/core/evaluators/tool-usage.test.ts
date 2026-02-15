import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  toolUsageEvaluator,
  buildSystemPrompt,
  buildUserPrompt,
  parseJudgeResponse,
  formatManifest,
  computeScore,
  extractTouchedFiles,
  filterApplicableRules,
} from '../../../src/core/evaluators/tool-usage.js';
import type { ToolUsageDetails } from '../../../src/core/evaluators/tool-usage.js';
import type { EvalContext, ToolEntry, TranscriptMessage } from '../../../src/core/types.js';

// Mock the judge client
vi.mock('../../../src/core/judge/judge-client.js', () => ({
  judgeQuery: vi.fn(),
}));

const makeContext = (overrides?: Partial<EvalContext>): EvalContext => ({
  config: {
    judgeModel: 'claude-sonnet-4-5-20250929',
    gatewayUrl: 'https://api.portkey.ai',
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
    it('includes invocable tool instructions when hasInvocable is true', () => {
      const prompt = buildSystemPrompt(true, false);
      expect(prompt).toContain('usedTools');
      expect(prompt).toContain('missedTools');
      expect(prompt).not.toContain('ruleCompliance');
    });

    it('includes rule compliance instructions when hasRules is true', () => {
      const prompt = buildSystemPrompt(false, true);
      expect(prompt).toContain('ruleCompliance');
      expect(prompt).toContain('compliant');
      expect(prompt).not.toContain('usedTools');
    });

    it('includes both when both are true', () => {
      const prompt = buildSystemPrompt(true, true);
      expect(prompt).toContain('usedTools');
      expect(prompt).toContain('missedTools');
      expect(prompt).toContain('ruleCompliance');
      expect(prompt).toContain('assessment');
    });
  });

  describe('formatManifest', () => {
    it('includes skills but separates rules with compliance label', () => {
      const output = formatManifest(makeContext());
      expect(output).toContain('deploy');
      expect(output).toContain('test');
      expect(output).toContain('no-console');
      expect(output).toContain('Skills');
      expect(output).toContain('Rules');
      expect(output).toContain('output compliance');
    });

    it('returns "No tools configured" for empty manifest', () => {
      const ctx = makeContext({
        toolsManifest: { skills: [], rules: [], subAgents: [], mcpConfigs: [] },
      });
      expect(formatManifest(ctx)).toBe('No tools configured.');
    });

    it('shows only invocable tools when no rules', () => {
      const ctx = makeContext({
        toolsManifest: {
          skills: [{ name: 'deploy', path: '/p', contentSummary: 'Deploy' }],
          rules: [],
          subAgents: [],
          mcpConfigs: [],
        },
      });
      const output = formatManifest(ctx);
      expect(output).toContain('deploy');
      expect(output).not.toContain('Rules');
    });

    it('shows only rules when no invocable tools', () => {
      const ctx = makeContext({
        toolsManifest: {
          skills: [],
          rules: [{ name: 'no-console', path: '/p', contentSummary: 'No console' }],
          subAgents: [],
          mcpConfigs: [],
        },
      });
      const output = formatManifest(ctx);
      expect(output).toContain('no-console');
      expect(output).toContain('Rules');
      expect(output).not.toContain('Skills');
    });

    it('uses applicableRules override when provided', () => {
      const ctx = makeContext({
        toolsManifest: {
          skills: [{ name: 'deploy', path: '/p', contentSummary: 'Deploy' }],
          rules: [
            { name: 'rule-a', path: '/p', contentSummary: 'Rule A' },
            { name: 'rule-b', path: '/p', contentSummary: 'Rule B' },
          ],
          subAgents: [],
          mcpConfigs: [],
        },
      });
      // Pass only rule-a as applicable
      const output = formatManifest(ctx, [{ name: 'rule-a', path: '/p', contentSummary: 'Rule A' }]);
      expect(output).toContain('rule-a');
      expect(output).not.toContain('rule-b');
      expect(output).toContain('deploy');
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
    it('parses valid JSON with usedTools, missedTools, and ruleCompliance', () => {
      const json = JSON.stringify({
        usedTools: [{ name: 'deploy', count: 2 }],
        missedTools: [{ name: 'test', reasoning: 'Tests should have been run' }],
        ruleCompliance: [{ name: 'no-console', compliant: true, reasoning: 'No console.log found' }],
        assessment: 'Partial tool utilization.',
      });

      const result = parseJudgeResponse(json);
      expect(result.usedTools).toHaveLength(1);
      expect(result.missedTools).toHaveLength(1);
      expect(result.ruleCompliance).toHaveLength(1);
      expect(result.ruleCompliance[0].compliant).toBe(true);
    });

    it('parses markdown-wrapped JSON', () => {
      const json = '```json\n' + JSON.stringify({
        usedTools: [],
        missedTools: [],
        ruleCompliance: [],
        assessment: 'All good.',
      }) + '\n```';

      const result = parseJudgeResponse(json);
      expect(result.assessment).toBe('All good.');
    });

    it('returns defaults for invalid JSON', () => {
      const result = parseJudgeResponse('not json');
      expect(result.usedTools).toHaveLength(0);
      expect(result.missedTools).toHaveLength(0);
      expect(result.ruleCompliance).toHaveLength(0);
      expect(result.assessment).toContain('could not be parsed');
    });

    it('filters malformed ruleCompliance entries', () => {
      const json = JSON.stringify({
        usedTools: [],
        missedTools: [],
        ruleCompliance: [
          { name: 'valid', compliant: true, reasoning: 'OK' },
          { name: 'missing-compliant', reasoning: 'No bool field' },
          { compliant: true, reasoning: 'No name field' },
          'not-an-object',
          42,
        ],
        assessment: 'Test.',
      });
      const result = parseJudgeResponse(json);
      expect(result.ruleCompliance).toHaveLength(1);
      expect(result.ruleCompliance[0].name).toBe('valid');
    });

    it('returns empty ruleCompliance when field is missing', () => {
      const json = JSON.stringify({
        usedTools: [],
        missedTools: [],
        assessment: 'No rules.',
      });
      const result = parseJudgeResponse(json);
      expect(result.ruleCompliance).toHaveLength(0);
    });
  });

  describe('computeScore', () => {
    it('returns 100 when no tools and no rules', () => {
      const details: ToolUsageDetails = {
        usedTools: [],
        missedTools: [],
        ruleCompliance: [],
        availableToolCount: 0,
        assessment: '',
      };
      expect(computeScore(details, 0, 0)).toBe(100);
    });

    it('returns 100 when all invocable tools used and no rules', () => {
      const details: ToolUsageDetails = {
        usedTools: [{ name: 'deploy', count: 1 }],
        missedTools: [],
        ruleCompliance: [],
        availableToolCount: 1,
        assessment: '',
      };
      expect(computeScore(details, 1, 0)).toBe(100);
    });

    it('penalizes missed invocable tools', () => {
      const details: ToolUsageDetails = {
        usedTools: [],
        missedTools: [{ name: 'deploy', reasoning: 'Not used' }],
        ruleCompliance: [],
        availableToolCount: 2,
        assessment: '',
      };
      // 1 missed out of 2: round((1 - 1/2) * 100) = 50
      expect(computeScore(details, 2, 0)).toBe(50);
    });

    it('returns 100 when all rules compliant and no invocable tools', () => {
      const details: ToolUsageDetails = {
        usedTools: [],
        missedTools: [],
        ruleCompliance: [
          { name: 'no-console', compliant: true, reasoning: 'OK' },
        ],
        availableToolCount: 1,
        assessment: '',
      };
      expect(computeScore(details, 0, 1)).toBe(100);
    });

    it('penalizes non-compliant rules', () => {
      const details: ToolUsageDetails = {
        usedTools: [],
        missedTools: [],
        ruleCompliance: [
          { name: 'no-console', compliant: false, reasoning: 'Used console.log' },
          { name: 'style', compliant: true, reasoning: 'OK' },
        ],
        availableToolCount: 2,
        assessment: '',
      };
      // 1/2 compliant = 50
      expect(computeScore(details, 0, 2)).toBe(50);
    });

    it('uses 50/50 weighting when both invocable and rules present', () => {
      const details: ToolUsageDetails = {
        usedTools: [{ name: 'deploy', count: 1 }],
        missedTools: [],
        ruleCompliance: [
          { name: 'no-console', compliant: true, reasoning: 'OK' },
        ],
        availableToolCount: 2,
        assessment: '',
      };
      // invocableScore: 100, ruleScore: 100 => round(100*0.5 + 100*0.5) = 100
      expect(computeScore(details, 1, 1)).toBe(100);
    });

    it('applies weighted average for mixed results', () => {
      const details: ToolUsageDetails = {
        usedTools: [],
        missedTools: [{ name: 'test', reasoning: 'Not used' }],
        ruleCompliance: [
          { name: 'no-console', compliant: true, reasoning: 'OK' },
        ],
        availableToolCount: 2,
        assessment: '',
      };
      // invocableScore: round((1-1/1)*100) = 0, ruleScore: 100
      // combined: round(0*0.5 + 100*0.5) = 50
      expect(computeScore(details, 1, 1)).toBe(50);
    });
  });

  describe('extractTouchedFiles', () => {
    it('extracts file paths from Read, Write, Edit tool calls', () => {
      const messages: TranscriptMessage[] = [
        {
          role: 'assistant',
          content: 'Reading files',
          toolCalls: [
            { toolName: 'Read', input: { file_path: '/tmp/workspace/src/api.ts' } },
            { toolName: 'Write', input: { file_path: '/tmp/workspace/src/index.ts' } },
            { toolName: 'Edit', input: { file_path: '/tmp/workspace/tests/api.test.ts' } },
          ],
        },
      ];
      const result = extractTouchedFiles(messages, '/tmp/workspace');
      expect(result).toContain('src/api.ts');
      expect(result).toContain('src/index.ts');
      expect(result).toContain('tests/api.test.ts');
    });

    it('ignores non-file tool calls', () => {
      const messages: TranscriptMessage[] = [
        {
          role: 'assistant',
          content: 'Running bash',
          toolCalls: [
            { toolName: 'Bash', input: { command: 'npm test' } },
          ],
        },
      ];
      const result = extractTouchedFiles(messages, '/tmp/workspace');
      expect(result).toHaveLength(0);
    });

    it('deduplicates file paths', () => {
      const messages: TranscriptMessage[] = [
        {
          role: 'assistant',
          content: 'Editing',
          toolCalls: [
            { toolName: 'Read', input: { file_path: '/tmp/workspace/src/api.ts' } },
            { toolName: 'Edit', input: { file_path: '/tmp/workspace/src/api.ts' } },
          ],
        },
      ];
      const result = extractTouchedFiles(messages, '/tmp/workspace');
      expect(result).toHaveLength(1);
    });

    it('extracts file paths from Glob tool output (array)', () => {
      const messages: TranscriptMessage[] = [
        {
          role: 'assistant',
          content: 'Searching',
          toolCalls: [
            {
              toolName: 'Glob',
              input: { pattern: 'src/**/*.ts' },
              output: ['/tmp/workspace/src/api.ts', '/tmp/workspace/src/index.ts'],
            },
          ],
        },
      ];
      const result = extractTouchedFiles(messages, '/tmp/workspace');
      expect(result).toContain('src/api.ts');
      expect(result).toContain('src/index.ts');
    });

    it('extracts file paths from Glob tool output (string)', () => {
      const messages: TranscriptMessage[] = [
        {
          role: 'assistant',
          content: 'Searching',
          toolCalls: [
            {
              toolName: 'Glob',
              input: { pattern: 'src/**/*.ts' },
              output: '/tmp/workspace/src/api.ts\n/tmp/workspace/src/index.ts',
            },
          ],
        },
      ];
      const result = extractTouchedFiles(messages, '/tmp/workspace');
      expect(result).toContain('src/api.ts');
      expect(result).toContain('src/index.ts');
    });

    it('ignores Glob tool calls without output', () => {
      const messages: TranscriptMessage[] = [
        {
          role: 'assistant',
          content: 'Searching',
          toolCalls: [
            { toolName: 'Glob', input: { pattern: 'src/**/*.ts' } },
          ],
        },
      ];
      const result = extractTouchedFiles(messages, '/tmp/workspace');
      expect(result).toHaveLength(0);
    });
  });

  describe('filterApplicableRules', () => {
    it('includes rules without pathPatterns', () => {
      const rules: ToolEntry[] = [
        { name: 'no-console', path: '/p', contentSummary: 'No console' },
      ];
      const result = filterApplicableRules(rules, []);
      expect(result).toHaveLength(1);
    });

    it('includes path-scoped rules when files match', () => {
      const rules: ToolEntry[] = [
        { name: 'api-rules', path: '/p', contentSummary: 'API', pathPatterns: ['src/api/**/*.ts'] },
      ];
      const result = filterApplicableRules(rules, ['src/api/handler.ts']);
      expect(result).toHaveLength(1);
    });

    it('excludes path-scoped rules when no files match', () => {
      const rules: ToolEntry[] = [
        { name: 'api-rules', path: '/p', contentSummary: 'API', pathPatterns: ['src/api/**/*.ts'] },
      ];
      const result = filterApplicableRules(rules, ['docs/readme.md']);
      expect(result).toHaveLength(0);
    });

    it('handles mix of scoped and unscoped rules', () => {
      const rules: ToolEntry[] = [
        { name: 'global', path: '/p', contentSummary: 'Always applies' },
        { name: 'api-only', path: '/p', contentSummary: 'API', pathPatterns: ['src/api/**/*.ts'] },
        { name: 'test-only', path: '/p', contentSummary: 'Tests', pathPatterns: ['tests/**/*.ts'] },
      ];
      const result = filterApplicableRules(rules, ['src/api/handler.ts']);
      expect(result).toHaveLength(2); // global + api-only
      expect(result.map(r => r.name)).toContain('global');
      expect(result.map(r => r.name)).toContain('api-only');
    });

    it('returns empty array for no rules', () => {
      expect(filterApplicableRules([], ['src/api.ts'])).toHaveLength(0);
    });
  });

  describe('toolUsageEvaluator', () => {
    it('returns metric "toolUsage"', async () => {
      const { judgeQuery } = await import('../../../src/core/judge/judge-client.js');
      (judgeQuery as any).mockResolvedValueOnce({
        content: JSON.stringify({
          usedTools: [{ name: 'deploy', count: 1 }],
          missedTools: [],
          ruleCompliance: [{ name: 'no-console', compliant: true, reasoning: 'OK' }],
          assessment: 'Good.',
        }),
        inputTokens: 200,
        outputTokens: 100,
      });

      const result = await toolUsageEvaluator(makeContext());
      expect(result.metric).toBe('toolUsage');
    });

    it('returns 100 when no tools missed and all rules compliant', async () => {
      const { judgeQuery } = await import('../../../src/core/judge/judge-client.js');
      (judgeQuery as any).mockResolvedValueOnce({
        content: JSON.stringify({
          usedTools: [{ name: 'deploy', count: 1 }],
          missedTools: [],
          ruleCompliance: [{ name: 'no-console', compliant: true, reasoning: 'OK' }],
          assessment: 'All tools used effectively.',
        }),
        inputTokens: 200,
        outputTokens: 100,
      });

      const result = await toolUsageEvaluator(makeContext());
      expect(result.score).toBe(100);
    });

    it('deducts score for missed tools and non-compliant rules', async () => {
      const { judgeQuery } = await import('../../../src/core/judge/judge-client.js');
      (judgeQuery as any).mockResolvedValueOnce({
        content: JSON.stringify({
          usedTools: [{ name: 'deploy', count: 1 }],
          missedTools: [
            { name: 'test', reasoning: 'Should have run tests' },
          ],
          ruleCompliance: [
            { name: 'no-console', compliant: false, reasoning: 'Used console.log' },
          ],
          assessment: 'Missed testing and violated rule.',
        }),
        inputTokens: 200,
        outputTokens: 100,
      });

      const result = await toolUsageEvaluator(makeContext());
      // invocableCount = 2 (deploy + test), ruleCount = 1 (no-console)
      // invocableScore = round((1 - 1/2) * 100) = 50
      // ruleScore = round(0/1 * 100) = 0
      // combined = round(50*0.5 + 0*0.5) = 25
      expect(result.score).toBe(25);
    });

    it('returns 100 with neutral assessment for empty manifest', async () => {
      const ctx = makeContext({
        toolsManifest: { skills: [], rules: [], subAgents: [], mcpConfigs: [] },
      });

      const result = await toolUsageEvaluator(ctx);
      expect(result.score).toBe(100);
      expect(result.reasoning).toContain('No custom tools configured');
    });

    it('includes details with usedTools, missedTools, ruleCompliance, assessment', async () => {
      const { judgeQuery } = await import('../../../src/core/judge/judge-client.js');
      (judgeQuery as any).mockResolvedValueOnce({
        content: JSON.stringify({
          usedTools: [{ name: 'deploy', count: 3 }],
          missedTools: [{ name: 'test', reasoning: 'Missing' }],
          ruleCompliance: [{ name: 'no-console', compliant: true, reasoning: 'Clean' }],
          assessment: 'Partial.',
        }),
        inputTokens: 200,
        outputTokens: 100,
      });

      const result = await toolUsageEvaluator(makeContext());
      const details = result.details as ToolUsageDetails;
      expect(details.usedTools).toHaveLength(1);
      expect(details.missedTools).toHaveLength(1);
      expect(details.ruleCompliance).toHaveLength(1);
      expect(details.availableToolCount).toBe(3); // 2 skills + 1 rule
      expect(details.assessment).toBe('Partial.');
    });

    it('evaluates rules-only manifest without invocable tools', async () => {
      const ctx = makeContext({
        toolsManifest: {
          skills: [],
          rules: [
            { name: 'no-console', path: '/p', contentSummary: 'No console.log' },
            { name: 'style', path: '/p', contentSummary: 'Style guide' },
          ],
          subAgents: [],
          mcpConfigs: [],
        },
      });

      const { judgeQuery } = await import('../../../src/core/judge/judge-client.js');
      (judgeQuery as any).mockResolvedValueOnce({
        content: JSON.stringify({
          ruleCompliance: [
            { name: 'no-console', compliant: true, reasoning: 'OK' },
            { name: 'style', compliant: true, reasoning: 'OK' },
          ],
          assessment: 'All rules followed.',
        }),
        inputTokens: 200,
        outputTokens: 100,
      });

      const result = await toolUsageEvaluator(ctx);
      expect(result.score).toBe(100);
      expect(result.reasoning).toContain('2/2 rules compliant');
    });

    it('evaluates skills-only manifest without rules', async () => {
      const ctx = makeContext({
        toolsManifest: {
          skills: [{ name: 'deploy', path: '/p', contentSummary: 'Deploy' }],
          rules: [],
          subAgents: [],
          mcpConfigs: [],
        },
      });

      const { judgeQuery } = await import('../../../src/core/judge/judge-client.js');
      (judgeQuery as any).mockResolvedValueOnce({
        content: JSON.stringify({
          usedTools: [{ name: 'deploy', count: 1 }],
          missedTools: [],
          assessment: 'All tools used.',
        }),
        inputTokens: 200,
        outputTokens: 100,
      });

      const result = await toolUsageEvaluator(ctx);
      expect(result.score).toBe(100);
      expect(result.reasoning).toContain('0 missed');
    });

    it('filters path-scoped rules based on touched files', async () => {
      const ctx = makeContext({
        transcript: {
          messages: [
            {
              role: 'assistant',
              content: 'Editing docs',
              toolCalls: [
                { toolName: 'Write', input: { file_path: '/tmp/workspace/docs/readme.md' } },
              ],
            },
          ],
          metadata: { costUsd: 0, inputTokens: 0, outputTokens: 0, turnCount: 1, durationMs: 0, errorCount: 0 },
        },
        toolsManifest: {
          skills: [],
          rules: [
            { name: 'api-rules', path: '/p', contentSummary: 'API conventions', pathPatterns: ['src/api/**/*.ts'] },
            { name: 'general', path: '/p', contentSummary: 'General rules' },
          ],
          subAgents: [],
          mcpConfigs: [],
        },
      });

      const { judgeQuery } = await import('../../../src/core/judge/judge-client.js');
      (judgeQuery as any).mockResolvedValueOnce({
        content: JSON.stringify({
          ruleCompliance: [
            { name: 'general', compliant: true, reasoning: 'Followed' },
          ],
          assessment: 'OK.',
        }),
        inputTokens: 200,
        outputTokens: 100,
      });

      const result = await toolUsageEvaluator(ctx);
      // Only 'general' rule applies (api-rules filtered out — no matching files)
      expect(result.score).toBe(100);
      const details = result.details as ToolUsageDetails;
      expect(details.availableToolCount).toBe(1); // Only the general rule
    });
  });
});
