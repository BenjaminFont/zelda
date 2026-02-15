import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  functionalCorrectnessEvaluator,
  parseTestCounts,
  parseCoverage,
} from '../../../src/core/evaluators/functional-correctness.js';
import type { EvalContext } from '../../../src/core/types.js';

// Mock child_process.execSync
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

const makeContext = (overrides?: Partial<EvalContext>): EvalContext => ({
  config: {
    judgeModel: 'claude-sonnet-4-5-20250929',
    gatewayUrl: 'https://api.portkey.ai/v1',
    resultsDir: '.zelda/runs',
    testDir: 'zelda',
    execution: {},
    metrics: { functionalCorrectness: true },
    testSuiteName: 'test-api',
    prompt: 'Build an API',
    acceptanceCriteria: ['Works correctly'],
    buildCommand: 'npm run build',
    testCommand: 'npm test',
  },
  transcript: {
    messages: [{ role: 'assistant', content: 'Done building.' }],
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

describe('evaluators/functional-correctness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseTestCounts', () => {
    it('parses Jest/vitest output "X passed, Y failed"', () => {
      const output = 'Tests:  5 passed, 2 failed, 7 total';
      const counts = parseTestCounts(output);
      expect(counts).toEqual({ passed: 5, failed: 2, total: 7 });
    });

    it('parses output with only passed', () => {
      const output = '10 passed';
      const counts = parseTestCounts(output);
      expect(counts).toEqual({ passed: 10, failed: 0, total: 10 });
    });

    it('parses TAP-style ok/not ok lines', () => {
      const output = 'ok 1 - test one\nok 2 - test two\nnot ok 3 - test three\n';
      const counts = parseTestCounts(output);
      expect(counts).toEqual({ passed: 2, failed: 1, total: 3 });
    });

    it('returns undefined for unparseable output', () => {
      expect(parseTestCounts('no test output here')).toBeUndefined();
    });
  });

  describe('parseCoverage', () => {
    it('parses Istanbul/NYC "All files" table', () => {
      const output = 'All files |   85.5 |   90.1 |   80.2 |   85.5';
      expect(parseCoverage(output)).toBe(85.5);
    });

    it('parses "Coverage: XX%" format', () => {
      expect(parseCoverage('Coverage: 92.3%')).toBe(92.3);
    });

    it('parses "Statements: XX%" format', () => {
      expect(parseCoverage('Statements: 78%')).toBe(78);
    });

    it('returns undefined when no coverage found', () => {
      expect(parseCoverage('no coverage info')).toBeUndefined();
    });
  });

  describe('functionalCorrectnessEvaluator', () => {
    it('returns metric "functionalCorrectness"', async () => {
      const { execSync } = await import('node:child_process');
      (execSync as any).mockReturnValue('Build OK\n');

      const result = await functionalCorrectnessEvaluator(makeContext());
      expect(result.metric).toBe('functionalCorrectness');
    });

    it('returns 100 with "not configured" when no build/test commands', async () => {
      const ctx = makeContext({
        config: {
          ...makeContext().config,
          buildCommand: undefined,
          testCommand: undefined,
        },
      });

      const result = await functionalCorrectnessEvaluator(ctx);
      expect(result.score).toBe(100);
      expect(result.reasoning).toContain('not evaluated');
      const details = result.details as any;
      expect(details.buildStatus).toBe('skipped');
    });

    it('reports build pass when exit code 0', async () => {
      const { execSync } = await import('node:child_process');
      // Build succeeds, test succeeds with 3 passed
      (execSync as any)
        .mockReturnValueOnce('Build OK\n')
        .mockReturnValueOnce('3 passed\n');

      const ctx = makeContext({
        config: { ...makeContext().config, testCommand: 'npm test' },
      });
      const result = await functionalCorrectnessEvaluator(ctx);
      const details = result.details as any;
      expect(details.buildStatus).toBe('pass');
    });

    it('reports build fail when exit code non-zero', async () => {
      const { execSync } = await import('node:child_process');
      const error = new Error('Build failed') as any;
      error.status = 1;
      error.stdout = 'Error: missing module\n';
      error.stderr = '';
      (execSync as any)
        .mockImplementationOnce(() => { throw error; })
        .mockReturnValueOnce('3 passed\n');

      const result = await functionalCorrectnessEvaluator(makeContext());
      const details = result.details as any;
      expect(details.buildStatus).toBe('fail');
    });

    it('parses test pass/fail counts from test output', async () => {
      const { execSync } = await import('node:child_process');
      (execSync as any)
        .mockReturnValueOnce('Build OK\n')
        .mockReturnValueOnce('Tests: 8 passed, 2 failed, 10 total\n');

      const result = await functionalCorrectnessEvaluator(makeContext());
      const details = result.details as any;
      expect(details.testCounts).toEqual({ passed: 8, failed: 2, total: 10 });
    });

    it('computes score from build and test results', async () => {
      const { execSync } = await import('node:child_process');
      // Build passes (100), tests 8/10 passed (80%)
      // Score = 0.4 * 100 + 0.6 * 80 = 88
      (execSync as any)
        .mockReturnValueOnce('Build OK\n')
        .mockReturnValueOnce('8 passed, 2 failed\n');

      const result = await functionalCorrectnessEvaluator(makeContext());
      expect(result.score).toBe(88);
    });

    it('scores 0 for build when build fails with tests', async () => {
      const { execSync } = await import('node:child_process');
      const error = new Error('Build failed') as any;
      error.status = 1;
      error.stdout = '';
      error.stderr = 'Error';
      // Build fails (0), tests pass 5/5 (100%)
      // Score = 0.4 * 0 + 0.6 * 100 = 60
      (execSync as any)
        .mockImplementationOnce(() => { throw error; })
        .mockReturnValueOnce('5 passed\n');

      const result = await functionalCorrectnessEvaluator(makeContext());
      expect(result.score).toBe(60);
    });

    it('handles coverage threshold met', async () => {
      const { execSync } = await import('node:child_process');
      (execSync as any)
        .mockReturnValueOnce('Build OK\n')
        .mockReturnValueOnce('5 passed\nCoverage: 90%\n');

      const ctx = makeContext({
        config: { ...makeContext().config, coverageThreshold: 80 },
      });
      const result = await functionalCorrectnessEvaluator(ctx);
      const details = result.details as any;
      expect(details.coveragePercent).toBe(90);
      expect(details.coverageMet).toBe(true);
    });

    it('handles coverage threshold not met', async () => {
      const { execSync } = await import('node:child_process');
      (execSync as any)
        .mockReturnValueOnce('Build OK\n')
        .mockReturnValueOnce('5 passed\nCoverage: 60%\n');

      const ctx = makeContext({
        config: { ...makeContext().config, coverageThreshold: 80 },
      });
      const result = await functionalCorrectnessEvaluator(ctx);
      const details = result.details as any;
      expect(details.coveragePercent).toBe(60);
      expect(details.coverageMet).toBe(false);
    });

    it('computes score with coverage in the mix', async () => {
      const { execSync } = await import('node:child_process');
      // Build passes (100), tests 5/5 (100%), coverage met (100%)
      // Score = 0.3 * 100 + 0.5 * 100 + 0.2 * 100 = 100
      (execSync as any)
        .mockReturnValueOnce('Build OK\n')
        .mockReturnValueOnce('5 passed\nCoverage: 90%\n');

      const ctx = makeContext({
        config: { ...makeContext().config, coverageThreshold: 80 },
      });
      const result = await functionalCorrectnessEvaluator(ctx);
      expect(result.score).toBe(100);
    });

    it('scores build-only correctly', async () => {
      const { execSync } = await import('node:child_process');
      (execSync as any).mockReturnValueOnce('Build OK\n');

      const ctx = makeContext({
        config: { ...makeContext().config, testCommand: undefined },
      });
      const result = await functionalCorrectnessEvaluator(ctx);
      expect(result.score).toBe(100);
    });

    it('scores test-only correctly', async () => {
      const { execSync } = await import('node:child_process');
      (execSync as any).mockReturnValueOnce('3 passed, 1 failed\n');

      const ctx = makeContext({
        config: { ...makeContext().config, buildCommand: undefined },
      });
      const result = await functionalCorrectnessEvaluator(ctx);
      // 3/4 = 75%
      expect(result.score).toBe(75);
    });

    it('includes reasoning with build/test/coverage summary', async () => {
      const { execSync } = await import('node:child_process');
      (execSync as any)
        .mockReturnValueOnce('Build OK\n')
        .mockReturnValueOnce('5 passed\nCoverage: 85%\n');

      const ctx = makeContext({
        config: { ...makeContext().config, coverageThreshold: 80 },
      });
      const result = await functionalCorrectnessEvaluator(ctx);
      expect(result.reasoning).toContain('Build: PASS');
      expect(result.reasoning).toContain('5/5 passed');
      expect(result.reasoning).toContain('Coverage: 85%');
    });

    it('truncates long output in details', async () => {
      const { execSync } = await import('node:child_process');
      const longOutput = 'x'.repeat(5000) + '\n';
      (execSync as any)
        .mockReturnValueOnce(longOutput)
        .mockReturnValueOnce('3 passed\n');

      const result = await functionalCorrectnessEvaluator(makeContext());
      const details = result.details as any;
      expect(details.buildOutput.length).toBeLessThanOrEqual(2000);
    });
  });
});
