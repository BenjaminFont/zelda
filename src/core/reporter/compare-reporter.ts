// Compare reporter — side-by-side comparison display for two runs

import chalk from 'chalk';
import type { ComparisonResult, MetricDelta } from '../compare/compare-runs.js';

const LABEL_WIDTH = 28;

const padLabel = (label: string): string =>
  label.padEnd(LABEL_WIDTH);

const formatScore = (score: number | undefined): string => {
  if (score === undefined) return chalk.dim('N/A'.padStart(7));
  return `${score.toFixed(1)}%`.padStart(7);
};

const formatDelta = (delta: MetricDelta): string => {
  if (delta.delta === undefined) return chalk.dim('  ---');
  if (delta.delta === 0) return chalk.dim('  0.0%');
  const sign = delta.delta > 0 ? '+' : '';
  const text = `${sign}${delta.delta.toFixed(1)}%`;
  if (delta.delta > 0) return chalk.green(text.padStart(7));
  return chalk.red(text.padStart(7));
};

const metricLabel = (metric: string): string => {
  const labels: Record<string, string> = {
    efficiency: 'Efficiency',
    requirementFulfillment: 'Requirement Fulfillment',
    toolUsage: 'Tool Usage',
    functionalCorrectness: 'Functional Correctness',
  };
  return labels[metric] ?? metric;
};

export const renderComparison = (comparison: ComparisonResult): string => {
  const { runA, runB, deltas } = comparison;
  const lines: string[] = [];

  lines.push(chalk.bold('\n Zelda Run Comparison\n'));

  // Header row
  const headerLabel = padLabel('');
  const runALabel = chalk.cyan(runA.id.slice(0, 20).padStart(20));
  const runBLabel = chalk.cyan(runB.id.slice(0, 20).padStart(20));
  lines.push(`  ${headerLabel} ${runALabel}  ${runBLabel}  ${chalk.cyan('Delta'.padStart(7))}`);

  // Separator
  lines.push(`  ${''.padEnd(LABEL_WIDTH + 58, '-')}`);

  // Metric rows
  for (const delta of deltas) {
    const label = chalk.cyan(padLabel(metricLabel(delta.metric)));
    const scoreA = formatScore(delta.scoreA);
    const scoreB = formatScore(delta.scoreB);
    const deltaStr = formatDelta(delta);
    lines.push(`  ${label} ${scoreA}  ${scoreB}  ${deltaStr}`);
  }

  lines.push('');

  // Suite info
  lines.push(`  ${chalk.dim('Run A:')} ${chalk.dim(runA.id)} (${runA.testSuite.name})`);
  lines.push(`  ${chalk.dim('Run B:')} ${chalk.dim(runB.id)} (${runB.testSuite.name})`);

  // Execution mode difference warning
  const modeA = runA.executionBackend ?? 'local';
  const modeB = runB.executionBackend ?? 'local';
  if (modeA !== modeB) {
    lines.push(`  ${chalk.yellow('Note:')} Runs used different execution modes (${modeA} vs ${modeB})`);
  }

  lines.push('');

  return lines.join('\n');
};
