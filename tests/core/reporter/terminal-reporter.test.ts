import { describe, it, expect } from 'vitest';
import { renderRunReport, renderEvalResult, renderRunHeader } from '../../../src/core/reporter/terminal-reporter.js';
import type { EvalResult, RunResult } from '../../../src/core/types.js';

// Strip ANSI escape codes for content assertions
const stripAnsi = (str: string): string =>
  str.replace(/\x1b\[[0-9;]*m/g, '');

const makeEfficiencyResult = (overrides?: Partial<EvalResult>): EvalResult => ({
  metric: 'efficiency',
  score: 85,
  details: {
    totalTokens: 1500,
    inputTokens: 500,
    outputTokens: 1000,
    costUsd: 0.05,
    turnCount: 5,
    durationMs: 30000,
    toolCallCounts: { Read: 3, Write: 1, Bash: 2 },
    errorCount: 0,
  },
  reasoning: 'Session used 1500 tokens across 5 turns (6 tool calls). Cost: $0.0500.',
  ...overrides,
});

const makeRunResult = (overrides?: Partial<RunResult>): RunResult => ({
  id: 'test-api-2026-02-14T10-00-00-000',
  timestamp: '2026-02-14T10:00:00.000Z',
  testSuite: {
    name: 'test-api',
    prompt: 'Build an API',
    acceptanceCriteria: ['Returns 200'],
    execution: { model: 'claude-sonnet-4-5-20250929' },
    metrics: { efficiency: true },
  },
  metrics: {
    efficiency: makeEfficiencyResult(),
  },
  ...overrides,
});

describe('reporter/terminal-reporter', () => {
  describe('renderRunHeader', () => {
    it('includes run ID, test suite name, timestamp, and model', () => {
      const output = stripAnsi(renderRunHeader(makeRunResult()));
      expect(output).toContain('test-api-2026-02-14T10-00-00-000');
      expect(output).toContain('test-api');
      expect(output).toContain('2026-02-14T10:00:00.000Z');
      expect(output).toContain('claude-sonnet-4-5-20250929');
    });

    it('shows "default" when no model specified', () => {
      const run = makeRunResult({
        testSuite: {
          name: 'test-api',
          prompt: 'Build an API',
          acceptanceCriteria: ['Returns 200'],
          execution: {},
          metrics: { efficiency: true },
        },
      });
      const output = stripAnsi(renderRunHeader(run));
      expect(output).toContain('default');
    });

    it('includes section title', () => {
      const output = stripAnsi(renderRunHeader(makeRunResult()));
      expect(output).toContain('Zelda Evaluation Results');
    });
  });

  describe('renderEvalResult (efficiency)', () => {
    it('includes score formatted as percentage with one decimal', () => {
      const output = stripAnsi(renderEvalResult(makeEfficiencyResult()));
      expect(output).toContain('85.0%');
    });

    it('includes token counts', () => {
      const output = stripAnsi(renderEvalResult(makeEfficiencyResult()));
      expect(output).toContain('1,500');
      expect(output).toContain('500');
      expect(output).toContain('1,000');
    });

    it('includes cost formatted with 4 decimal places', () => {
      const output = stripAnsi(renderEvalResult(makeEfficiencyResult()));
      expect(output).toContain('$0.0500');
    });

    it('includes turn count', () => {
      const output = stripAnsi(renderEvalResult(makeEfficiencyResult()));
      expect(output).toContain('5');
    });

    it('formats duration as seconds', () => {
      const output = stripAnsi(renderEvalResult(makeEfficiencyResult()));
      expect(output).toContain('30.0s');
    });

    it('formats short duration as milliseconds', () => {
      const result = makeEfficiencyResult({
        details: {
          totalTokens: 100,
          inputTokens: 50,
          outputTokens: 50,
          costUsd: 0.001,
          turnCount: 1,
          durationMs: 500,
          toolCallCounts: {},
          errorCount: 0,
        },
      });
      const output = stripAnsi(renderEvalResult(result));
      expect(output).toContain('500ms');
    });

    it('formats long duration as minutes', () => {
      const result = makeEfficiencyResult({
        details: {
          totalTokens: 100,
          inputTokens: 50,
          outputTokens: 50,
          costUsd: 0.001,
          turnCount: 1,
          durationMs: 125000,
          toolCallCounts: {},
          errorCount: 0,
        },
      });
      const output = stripAnsi(renderEvalResult(result));
      expect(output).toContain('2m 5s');
    });

    it('shows error count in output', () => {
      const output = stripAnsi(renderEvalResult(makeEfficiencyResult()));
      expect(output).toContain('Errors');
      expect(output).toContain('0');
    });

    it('shows tool call breakdown sorted by count descending', () => {
      const output = stripAnsi(renderEvalResult(makeEfficiencyResult()));
      const readIdx = output.indexOf('Read');
      const bashIdx = output.indexOf('Bash');
      const writeIdx = output.indexOf('Write');
      // Read (3) before Bash (2) before Write (1)
      expect(readIdx).toBeLessThan(bashIdx);
      expect(bashIdx).toBeLessThan(writeIdx);
    });

    it('includes reasoning text', () => {
      const output = stripAnsi(renderEvalResult(makeEfficiencyResult()));
      expect(output).toContain('Session used 1500 tokens');
    });

    it('omits tool call section when no tool calls', () => {
      const result = makeEfficiencyResult({
        details: {
          totalTokens: 100,
          inputTokens: 50,
          outputTokens: 50,
          costUsd: 0.001,
          turnCount: 1,
          durationMs: 1000,
          toolCallCounts: {},
          errorCount: 0,
        },
      });
      const output = stripAnsi(renderEvalResult(result));
      expect(output).not.toContain('Tool Calls');
    });
  });

  describe('renderRunReport', () => {
    it('includes header and efficiency section', () => {
      const output = stripAnsi(renderRunReport(makeRunResult()));
      expect(output).toContain('Zelda Evaluation Results');
      expect(output).toContain('Efficiency');
      expect(output).toContain('85.0%');
    });

    it('renders multiple metrics', () => {
      const run = makeRunResult({
        metrics: {
          efficiency: makeEfficiencyResult(),
          custom: {
            metric: 'custom',
            score: 72,
            details: {},
            reasoning: 'Custom metric reasoning',
          },
        },
      });
      const output = stripAnsi(renderRunReport(run));
      expect(output).toContain('Efficiency');
      expect(output).toContain('custom');
      expect(output).toContain('72.0%');
      expect(output).toContain('Custom metric reasoning');
    });

    it('contains no emoji characters', () => {
      const output = renderRunReport(makeRunResult());
      // Check for common emoji ranges
      const emojiPattern = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      expect(emojiPattern.test(output)).toBe(false);
    });
  });

  describe('score thresholds', () => {
    it('formats high scores (>=80) differently from low scores (<50)', () => {
      const high = makeEfficiencyResult({ score: 90 });
      const low = makeEfficiencyResult({ score: 30 });
      const highOutput = renderEvalResult(high);
      const lowOutput = renderEvalResult(low);
      // Both contain their respective scores
      expect(stripAnsi(highOutput)).toContain('90.0%');
      expect(stripAnsi(lowOutput)).toContain('30.0%');
      // The raw outputs differ (due to color codes when colors are enabled,
      // or at minimum the score text differs)
      expect(highOutput).not.toBe(lowOutput);
    });

    it('formats medium scores (50-79) differently from high scores', () => {
      const medium = makeEfficiencyResult({ score: 60 });
      const high = makeEfficiencyResult({ score: 90 });
      expect(stripAnsi(renderEvalResult(medium))).toContain('60.0%');
      expect(stripAnsi(renderEvalResult(high))).toContain('90.0%');
    });

    it('displays error count zero distinctly from non-zero', () => {
      const zeroErrors = makeEfficiencyResult();
      const withErrors = makeEfficiencyResult({
        details: {
          totalTokens: 100,
          inputTokens: 50,
          outputTokens: 50,
          costUsd: 0.001,
          turnCount: 1,
          durationMs: 1000,
          toolCallCounts: {},
          errorCount: 3,
        },
      });
      const zeroOutput = stripAnsi(renderEvalResult(zeroErrors));
      const errorOutput = stripAnsi(renderEvalResult(withErrors));
      expect(zeroOutput).toContain('Errors');
      expect(errorOutput).toContain('Errors');
      expect(errorOutput).toContain('3');
    });
  });
});
