// List reporter — formats run list for terminal display

import chalk from 'chalk';
import type { RunResult } from '../types.js';

const formatDate = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return timestamp;
  }
};

const formatScore = (score: number | undefined): string => {
  if (score === undefined) return chalk.dim('N/A');
  const formatted = `${score.toFixed(1)}%`;
  if (score >= 80) return chalk.green(formatted);
  if (score >= 50) return chalk.yellow(formatted);
  return chalk.red(formatted);
};

const getMetricScore = (run: RunResult, metric: string): number | undefined =>
  run.metrics[metric]?.score;

export const renderRunList = (runs: RunResult[]): string => {
  if (runs.length === 0) {
    return 'No runs found. Run "zelda run" to create your first evaluation.';
  }

  const lines: string[] = [];
  lines.push(chalk.bold(` Zelda Evaluation Runs (${runs.length})\n`));

  for (const run of runs) {
    const date = formatDate(run.timestamp);
    const suite = run.testSuite.name;
    const fulfillment = formatScore(getMetricScore(run, 'requirementFulfillment'));
    const toolUsage = formatScore(getMetricScore(run, 'toolUsage'));
    const efficiency = formatScore(getMetricScore(run, 'efficiency'));

    lines.push(`  ${chalk.dim(run.id)}`);
    lines.push(`    ${chalk.cyan('Suite:')} ${suite}  ${chalk.cyan('Date:')} ${date}`);
    lines.push(`    ${chalk.cyan('Fulfillment:')} ${fulfillment}  ${chalk.cyan('Tool Usage:')} ${toolUsage}  ${chalk.cyan('Efficiency:')} ${efficiency}`);
    lines.push('');
  }

  return lines.join('\n');
};
