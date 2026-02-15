import { describe, it, expect } from 'vitest';
import { compareRuns } from '../../../src/core/compare/compare-runs.js';
import type { RunResult } from '../../../src/core/types.js';

const makeRun = (overrides?: Partial<RunResult>): RunResult => ({
  id: 'test-run-1',
  timestamp: '2026-02-14T10:00:00.000Z',
  testSuite: {
    name: 'test-api',
    prompt: 'Build an API',
    acceptanceCriteria: ['Returns 200'],
    execution: {},
    metrics: {},
  },
  metrics: {
    efficiency: { metric: 'efficiency', score: 85, details: {} },
    requirementFulfillment: { metric: 'requirementFulfillment', score: 80, details: {} },
  },
  ...overrides,
});

describe('compare/compare-runs', () => {
  it('computes deltas for shared metrics', () => {
    const runA = makeRun({ metrics: {
      efficiency: { metric: 'efficiency', score: 80, details: {} },
    }});
    const runB = makeRun({ id: 'test-run-2', metrics: {
      efficiency: { metric: 'efficiency', score: 90, details: {} },
    }});

    const result = compareRuns(runA, runB);
    expect(result.deltas).toHaveLength(1);
    expect(result.deltas[0].metric).toBe('efficiency');
    expect(result.deltas[0].delta).toBe(10);
  });

  it('returns undefined delta for metrics only in run A', () => {
    const runA = makeRun({ metrics: {
      efficiency: { metric: 'efficiency', score: 80, details: {} },
    }});
    const runB = makeRun({ id: 'test-run-2', metrics: {} });

    const result = compareRuns(runA, runB);
    const effDelta = result.deltas.find(d => d.metric === 'efficiency');
    expect(effDelta).toBeDefined();
    expect(effDelta!.scoreA).toBe(80);
    expect(effDelta!.scoreB).toBeUndefined();
    expect(effDelta!.delta).toBeUndefined();
  });

  it('returns undefined delta for metrics only in run B', () => {
    const runA = makeRun({ metrics: {} });
    const runB = makeRun({ id: 'test-run-2', metrics: {
      toolUsage: { metric: 'toolUsage', score: 100, details: {} },
    }});

    const result = compareRuns(runA, runB);
    const tuDelta = result.deltas.find(d => d.metric === 'toolUsage');
    expect(tuDelta).toBeDefined();
    expect(tuDelta!.scoreA).toBeUndefined();
    expect(tuDelta!.scoreB).toBe(100);
    expect(tuDelta!.delta).toBeUndefined();
  });

  it('handles negative deltas (regression)', () => {
    const runA = makeRun({ metrics: {
      efficiency: { metric: 'efficiency', score: 90, details: {} },
    }});
    const runB = makeRun({ id: 'test-run-2', metrics: {
      efficiency: { metric: 'efficiency', score: 75, details: {} },
    }});

    const result = compareRuns(runA, runB);
    expect(result.deltas[0].delta).toBe(-15);
  });

  it('handles zero delta', () => {
    const runA = makeRun({ metrics: {
      efficiency: { metric: 'efficiency', score: 80, details: {} },
    }});
    const runB = makeRun({ id: 'test-run-2', metrics: {
      efficiency: { metric: 'efficiency', score: 80, details: {} },
    }});

    const result = compareRuns(runA, runB);
    expect(result.deltas[0].delta).toBe(0);
  });

  it('collects metrics from both runs sorted alphabetically', () => {
    const runA = makeRun({ metrics: {
      toolUsage: { metric: 'toolUsage', score: 90, details: {} },
      efficiency: { metric: 'efficiency', score: 80, details: {} },
    }});
    const runB = makeRun({ id: 'test-run-2', metrics: {
      requirementFulfillment: { metric: 'requirementFulfillment', score: 70, details: {} },
      efficiency: { metric: 'efficiency', score: 85, details: {} },
    }});

    const result = compareRuns(runA, runB);
    expect(result.deltas.map(d => d.metric)).toEqual([
      'efficiency',
      'requirementFulfillment',
      'toolUsage',
    ]);
  });

  it('preserves run references', () => {
    const runA = makeRun();
    const runB = makeRun({ id: 'test-run-2' });
    const result = compareRuns(runA, runB);
    expect(result.runA).toBe(runA);
    expect(result.runB).toBe(runB);
  });
});
