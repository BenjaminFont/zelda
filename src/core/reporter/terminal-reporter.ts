// Terminal reporter — vitest-style colored output for evaluation results

import chalk from 'chalk';
import type { EvalResult, RunResult } from '../types.js';
import type { EfficiencyDetails } from '../evaluators/efficiency.js';

const LABEL_WIDTH = 16;

const padLabel = (label: string): string =>
  `${label}:`.padEnd(LABEL_WIDTH);

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
};

const formatScore = (score: number): string => {
  const formatted = `${score.toFixed(1)}%`;
  if (score >= 80) return chalk.green(formatted);
  if (score >= 50) return chalk.yellow(formatted);
  return chalk.red(formatted);
};

const formatCost = (usd: number): string =>
  `$${usd.toFixed(4)}`;

const sectionHeader = (title: string): string =>
  chalk.bold(`\n ${title}`);

const renderEfficiency = (result: EvalResult): string => {
  const details = result.details as EfficiencyDetails;
  const lines: string[] = [];

  lines.push(sectionHeader('Efficiency'));
  lines.push(`  ${chalk.cyan(padLabel('Score'))} ${formatScore(result.score)}`);
  lines.push(`  ${chalk.cyan(padLabel('Total Tokens'))} ${details.totalTokens.toLocaleString()}`);
  lines.push(`  ${chalk.cyan(padLabel('Input Tokens'))} ${details.inputTokens.toLocaleString()}`);
  lines.push(`  ${chalk.cyan(padLabel('Output Tokens'))} ${details.outputTokens.toLocaleString()}`);
  lines.push(`  ${chalk.cyan(padLabel('Cost'))} ${formatCost(details.costUsd)}`);
  lines.push(`  ${chalk.cyan(padLabel('Turns'))} ${details.turnCount}`);
  lines.push(`  ${chalk.cyan(padLabel('Duration'))} ${formatDuration(details.durationMs)}`);

  if (details.errorCount > 0) {
    lines.push(`  ${chalk.cyan(padLabel('Errors'))} ${chalk.red(String(details.errorCount))}`);
  } else {
    lines.push(`  ${chalk.cyan(padLabel('Errors'))} ${chalk.green('0')}`);
  }

  const toolEntries = Object.entries(details.toolCallCounts);
  if (toolEntries.length > 0) {
    lines.push(`  ${chalk.cyan(padLabel('Tool Calls'))}`);
    for (const [tool, count] of toolEntries.sort((a, b) => b[1] - a[1])) {
      lines.push(`    ${chalk.dim(padLabel(tool))} ${count}`);
    }
  }

  if (result.reasoning) {
    lines.push(`  ${chalk.dim(result.reasoning)}`);
  }

  return lines.join('\n');
};

const metricRenderers: Record<string, (result: EvalResult) => string> = {
  efficiency: renderEfficiency,
};

const renderMetric = (result: EvalResult): string => {
  const renderer = metricRenderers[result.metric];
  if (renderer) return renderer(result);

  // Fallback for unknown metrics
  const lines: string[] = [];
  lines.push(sectionHeader(result.metric));
  lines.push(`  ${chalk.cyan(padLabel('Score'))} ${formatScore(result.score)}`);
  if (result.reasoning) {
    lines.push(`  ${chalk.dim(result.reasoning)}`);
  }
  return lines.join('\n');
};

export const renderRunHeader = (run: RunResult): string => {
  const lines: string[] = [];
  lines.push(chalk.bold(`\n Zelda Evaluation Results`));
  lines.push(`  ${chalk.cyan(padLabel('Run ID'))} ${chalk.dim(run.id)}`);
  lines.push(`  ${chalk.cyan(padLabel('Test Suite'))} ${run.testSuite.name}`);
  lines.push(`  ${chalk.cyan(padLabel('Timestamp'))} ${chalk.dim(run.timestamp)}`);
  lines.push(`  ${chalk.cyan(padLabel('Model'))} ${run.testSuite.execution.model ?? chalk.dim('default')}`);
  return lines.join('\n');
};

export const renderRunReport = (run: RunResult): string => {
  const sections: string[] = [];

  sections.push(renderRunHeader(run));

  for (const result of Object.values(run.metrics)) {
    sections.push(renderMetric(result));
  }

  sections.push(''); // trailing newline
  return sections.join('\n');
};

export const renderEvalResult = renderMetric;

export const printRunReport = (run: RunResult): void => {
  process.stdout.write(renderRunReport(run));
};
