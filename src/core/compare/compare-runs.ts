// Compare runs — compute metric deltas between two evaluation runs

import type { RunResult } from '../types.js';

export type MetricDelta = {
  metric: string;
  scoreA: number | undefined;
  scoreB: number | undefined;
  delta: number | undefined; // B - A, undefined if either is missing
};

export type ComparisonResult = {
  runA: RunResult;
  runB: RunResult;
  deltas: MetricDelta[];
};

export const compareRuns = (
  runA: RunResult,
  runB: RunResult,
): ComparisonResult => {
  // Collect all unique metric names from both runs
  const allMetrics = new Set([
    ...Object.keys(runA.metrics),
    ...Object.keys(runB.metrics),
  ]);

  const deltas: MetricDelta[] = [];

  for (const metric of [...allMetrics].sort()) {
    const scoreA = runA.metrics[metric]?.score;
    const scoreB = runB.metrics[metric]?.score;
    const delta = scoreA !== undefined && scoreB !== undefined
      ? scoreB - scoreA
      : undefined;

    deltas.push({ metric, scoreA, scoreB, delta });
  }

  return { runA, runB, deltas };
};
