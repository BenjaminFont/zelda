import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  codeQualityEvaluator,
  parseErrorsAndWarnings,
} from '../../../src/core/evaluators/code-quality.js';
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
    metrics: { codeQuality: true },
    testSuiteName: 'test-api',
    prompt: 'Build an API',
    acceptanceCriteria: ['Works correctly'],
    staticAnalysis: ['npx eslint .', 'npx tsc --noEmit'],
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

describe('evaluators/code-quality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseErrorsAndWarnings', () => {
    it('parses ESLint summary format', () => {
      const output = '\n✖ 12 problems (5 errors, 7 warnings)\n';
      expect(parseErrorsAndWarnings(output)).toEqual({
        errors: 5,
        warnings: 7,
      });
    });

    it('parses ESLint shorthand "X errors, Y warnings"', () => {
      const output = '3 errors and 2 warnings found\n';
      expect(parseErrorsAndWarnings(output)).toEqual({
        errors: 3,
        warnings: 2,
      });
    });

    it('parses TypeScript error lines', () => {
      const output = [
        'src/index.ts(1,5): error TS2304: Cannot find name "foo".',
        'src/index.ts(3,10): error TS2345: Argument of type...',
        'src/utils.ts(7,1): error TS7006: Parameter implicitly has an any type.',
      ].join('\n');
      expect(parseErrorsAndWarnings(output)).toEqual({
        errors: 3,
        warnings: 0,
      });
    });

    it('parses generic error/warning lines', () => {
      const output = [
        '[INFO] Starting analysis...',
        '[WARNING] unused import at line 5',
        '[WARNING] unused variable at line 12',
        '[INFO] Done.',
      ].join('\n');
      expect(parseErrorsAndWarnings(output)).toEqual({
        errors: 0,
        warnings: 2,
      });
    });

    it('returns zeros for clean output', () => {
      const output = 'All checks passed.\nNo issues found.\n';
      expect(parseErrorsAndWarnings(output)).toEqual({
        errors: 0,
        warnings: 0,
      });
    });
  });

  describe('codeQualityEvaluator', () => {
    it('returns metric "codeQuality"', async () => {
      const { execSync } = await import('node:child_process');
      (execSync as any)
        .mockReturnValueOnce('No issues found.\n')
        .mockReturnValueOnce('No errors.\n');

      const result = await codeQualityEvaluator(makeContext());
      expect(result.metric).toBe('codeQuality');
    });

    it('skips when no staticAnalysis configured (score 100)', async () => {
      const ctx = makeContext({
        config: {
          ...makeContext().config,
          staticAnalysis: undefined,
        },
      });

      const result = await codeQualityEvaluator(ctx);
      expect(result.score).toBe(100);
      expect(result.reasoning).toContain('not evaluated');
      const details = result.details as any;
      expect(details.commands).toEqual([]);
    });

    it('skips when staticAnalysis is empty array', async () => {
      const ctx = makeContext({
        config: {
          ...makeContext().config,
          staticAnalysis: [],
        },
      });

      const result = await codeQualityEvaluator(ctx);
      expect(result.score).toBe(100);
      expect(result.reasoning).toContain('not evaluated');
    });

    it('reports pass when all commands exit 0 with no errors', async () => {
      const { execSync } = await import('node:child_process');
      (execSync as any)
        .mockReturnValueOnce('All good.\n')
        .mockReturnValueOnce('No errors.\n');

      const result = await codeQualityEvaluator(makeContext());
      expect(result.score).toBe(100);
      const details = result.details as any;
      expect(details.totalErrors).toBe(0);
      expect(details.totalWarnings).toBe(0);
      expect(details.commands).toHaveLength(2);
      expect(details.commands[0].passed).toBe(true);
      expect(details.commands[1].passed).toBe(true);
    });

    it('parses errors from failing command', async () => {
      const { execSync } = await import('node:child_process');
      const error = new Error('eslint failed') as any;
      error.status = 1;
      error.stdout = '\n✖ 5 problems (3 errors, 2 warnings)\n';
      error.stderr = '';
      (execSync as any)
        .mockImplementationOnce(() => { throw error; })
        .mockReturnValueOnce('No errors.\n');

      const result = await codeQualityEvaluator(makeContext());
      const details = result.details as any;
      expect(details.totalErrors).toBe(3);
      expect(details.totalWarnings).toBe(2);
      expect(details.commands[0].passed).toBe(false);
      expect(details.commands[0].errors).toBe(3);
      expect(details.commands[0].warnings).toBe(2);
    });

    it('handles multiple commands and aggregates results', async () => {
      const { execSync } = await import('node:child_process');
      // eslint: 2 errors, 1 warning
      const eslintError = new Error('eslint') as any;
      eslintError.status = 1;
      eslintError.stdout = '2 errors, 1 warning\n';
      eslintError.stderr = '';
      // tsc: 3 TS errors
      const tscError = new Error('tsc') as any;
      tscError.status = 1;
      tscError.stdout = 'error TS2304: x\nerror TS2304: y\nerror TS2304: z\n';
      tscError.stderr = '';

      (execSync as any)
        .mockImplementationOnce(() => { throw eslintError; })
        .mockImplementationOnce(() => { throw tscError; });

      const result = await codeQualityEvaluator(makeContext());
      const details = result.details as any;
      expect(details.totalErrors).toBe(5); // 2 + 3
      expect(details.totalWarnings).toBe(1); // 1 + 0
      expect(details.commands).toHaveLength(2);
    });

    it('computes score: errors reduce by 10, warnings by 2', async () => {
      const { execSync } = await import('node:child_process');
      // 2 errors, 3 warnings → 100 - 20 - 6 = 74
      const error = new Error('eslint') as any;
      error.status = 1;
      error.stdout = '2 errors, 3 warnings\n';
      error.stderr = '';
      (execSync as any).mockImplementationOnce(() => { throw error; });

      const ctx = makeContext({
        config: {
          ...makeContext().config,
          staticAnalysis: ['npx eslint .'],
        },
      });
      const result = await codeQualityEvaluator(ctx);
      expect(result.score).toBe(74);
    });

    it('clamps score to 0 minimum', async () => {
      const { execSync } = await import('node:child_process');
      // 15 errors → 100 - 150 = -50 → clamped to 0
      const error = new Error('eslint') as any;
      error.status = 1;
      error.stdout = '15 errors, 0 warnings\n';
      error.stderr = '';
      (execSync as any).mockImplementationOnce(() => { throw error; });

      const ctx = makeContext({
        config: {
          ...makeContext().config,
          staticAnalysis: ['npx eslint .'],
        },
      });
      const result = await codeQualityEvaluator(ctx);
      expect(result.score).toBe(0);
    });

    it('handles command execution failure (tool not installed)', async () => {
      const { execSync } = await import('node:child_process');
      const error = new Error('command not found: biome') as any;
      error.status = 127;
      error.stdout = '';
      error.stderr = '';
      (execSync as any).mockImplementationOnce(() => { throw error; });

      const ctx = makeContext({
        config: {
          ...makeContext().config,
          staticAnalysis: ['biome check .'],
        },
      });
      const result = await codeQualityEvaluator(ctx);
      const details = result.details as any;
      // No errors parsed from output, but exit code non-zero → 1 error counted
      expect(details.totalErrors).toBe(1);
      expect(details.commands[0].passed).toBe(false);
      // Score: 100 - 10 = 90
      expect(result.score).toBe(90);
    });

    it('truncates long output in details', async () => {
      const { execSync } = await import('node:child_process');
      const longOutput = 'x'.repeat(5000) + '\n';
      (execSync as any).mockReturnValueOnce(longOutput);

      const ctx = makeContext({
        config: {
          ...makeContext().config,
          staticAnalysis: ['npx eslint .'],
        },
      });
      const result = await codeQualityEvaluator(ctx);
      const details = result.details as any;
      expect(details.commands[0].output.length).toBeLessThanOrEqual(2000);
    });
  });
});
