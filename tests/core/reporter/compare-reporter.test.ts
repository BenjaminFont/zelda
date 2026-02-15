import { describe, it, expect } from 'vitest';
import { renderComparison } from '../../../src/core/reporter/compare-reporter.js';
import type { ComparisonResult } from '../../../src/core/compare/compare-runs.js';
import type { RunResult } from '../../../src/core/types.js';

const stripAnsi = (str: string): string =>
  str.replace(/\x1b\[[0-9;]*m/g, '');

const makeRun = (id: string, name: string): RunResult => ({
  id,
  timestamp: '2026-02-14T10:00:00.000Z',
  testSuite: {
    name,
    prompt: 'Build an API',
    acceptanceCriteria: ['Returns 200'],
    execution: {},
    metrics: {},
  },
  metrics: {},
});

const makeComparison = (): ComparisonResult => ({
  runA: makeRun('run-a-20260214', 'test-api'),
  runB: makeRun('run-b-20260214', 'test-api'),
  deltas: [
    { metric: 'efficiency', scoreA: 80, scoreB: 90, delta: 10 },
    { metric: 'requirementFulfillment', scoreA: 60, scoreB: 55, delta: -5 },
    { metric: 'toolUsage', scoreA: 100, scoreB: undefined, delta: undefined },
  ],
});

describe('reporter/compare-reporter', () => {
  it('shows comparison header', () => {
    const output = stripAnsi(renderComparison(makeComparison()));
    expect(output).toContain('Comparison');
  });

  it('shows run IDs', () => {
    const output = stripAnsi(renderComparison(makeComparison()));
    expect(output).toContain('run-a-20260214');
    expect(output).toContain('run-b-20260214');
  });

  it('shows metric labels', () => {
    const output = stripAnsi(renderComparison(makeComparison()));
    expect(output).toContain('Efficiency');
    expect(output).toContain('Requirement Fulfillment');
    expect(output).toContain('Tool Usage');
  });

  it('shows scores for both runs', () => {
    const output = stripAnsi(renderComparison(makeComparison()));
    expect(output).toContain('80.0%');
    expect(output).toContain('90.0%');
    expect(output).toContain('60.0%');
    expect(output).toContain('55.0%');
  });

  it('shows positive delta', () => {
    const output = stripAnsi(renderComparison(makeComparison()));
    expect(output).toContain('+10.0%');
  });

  it('shows negative delta', () => {
    const output = stripAnsi(renderComparison(makeComparison()));
    expect(output).toContain('-5.0%');
  });

  it('shows N/A for missing scores', () => {
    const output = stripAnsi(renderComparison(makeComparison()));
    expect(output).toContain('N/A');
  });

  it('shows --- for undefined delta', () => {
    const output = stripAnsi(renderComparison(makeComparison()));
    expect(output).toContain('---');
  });

  it('shows suite name in run info', () => {
    const output = stripAnsi(renderComparison(makeComparison()));
    expect(output).toContain('test-api');
  });

  it('contains no emoji characters', () => {
    const output = renderComparison(makeComparison());
    const emojiPattern = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiPattern.test(output)).toBe(false);
  });
});
