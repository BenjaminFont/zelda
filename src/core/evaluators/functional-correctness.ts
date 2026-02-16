// Functional correctness evaluator — build/test runner with coverage checking
// Executes build and test commands in workspace, parses output for pass/fail/coverage

import { execSync } from 'node:child_process';
import type { Evaluator, EvalContext, EvalResult } from '../types.js';

export type CommandResult = {
  passed: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type TestCounts = {
  passed: number;
  failed: number;
  total: number;
};

export type FunctionalCorrectnessDetails = {
  buildStatus?: 'pass' | 'fail' | 'skipped';
  buildOutput?: string;
  testCounts?: TestCounts;
  testOutput?: string;
  coveragePercent?: number;
  coverageThreshold?: number;
  coverageMet?: boolean;
};

const runCommand = (command: string, workspacePath: string): CommandResult => {
  try {
    const stdout = execSync(command, {
      cwd: workspacePath,
      encoding: 'utf-8',
      timeout: 300_000, // 5 minute timeout
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    return { passed: true, exitCode: 0, stdout, stderr: '' };
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return {
      passed: false,
      exitCode: err.status ?? 1,
      stdout: String(err.stdout ?? ''),
      stderr: String(err.stderr ?? ''),
    };
  }
};

const parseTestCounts = (output: string): TestCounts | undefined => {
  // Jest / vitest: "Tests:  5 passed, 2 failed, 7 total" or "X passed (Y)" or "Tests  X passed | Y failed"
  // Pattern 1: "N passed" and optionally "N failed"
  const passedMatch = output.match(/(\d+)\s+passed/i);
  const failedMatch = output.match(/(\d+)\s+failed/i);

  if (passedMatch) {
    const passed = parseInt(passedMatch[1], 10);
    const failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
    return { passed, failed, total: passed + failed };
  }

  // Pattern 2: TAP-style "ok" / "not ok" lines
  const okLines = (output.match(/^ok\s/gm) ?? []).length;
  const notOkLines = (output.match(/^not ok\s/gm) ?? []).length;

  if (okLines > 0 || notOkLines > 0) {
    return { passed: okLines, failed: notOkLines, total: okLines + notOkLines };
  }

  return undefined;
};

const parseCoverage = (output: string): number | undefined => {
  // Common coverage patterns:
  // "All files |   85.5 |" (Istanbul/NYC table)
  // "Coverage: 85.5%" or "Statements: 85.5%"
  // "% Stmts ... 85.5"
  // Look for "All files" line first (Istanbul/NYC)
  const allFilesMatch = output.match(/All files\s*\|\s*([\d.]+)/);
  if (allFilesMatch) {
    return parseFloat(allFilesMatch[1]);
  }

  // Look for "Coverage: XX%" or "Statements: XX%"
  const coverageMatch = output.match(/(?:coverage|statements)\s*:?\s*([\d.]+)\s*%/i);
  if (coverageMatch) {
    return parseFloat(coverageMatch[1]);
  }

  return undefined;
};

export const functionalCorrectnessEvaluator: Evaluator = async (
  context: EvalContext,
): Promise<EvalResult> => {
  const { config, workspacePath } = context;
  const { buildCommand, testCommand, coverageThreshold } = config;

  // If no build or test commands configured, skip gracefully
  if (!buildCommand && !testCommand) {
    return {
      metric: 'functionalCorrectness',
      score: 100,
      details: {
        buildStatus: 'skipped',
      } satisfies FunctionalCorrectnessDetails,
      reasoning: 'No build or test commands configured — functional correctness not evaluated.',
    };
  }

  const details: FunctionalCorrectnessDetails = {};
  let buildPassed = true;

  // Run build command
  if (buildCommand) {
    const buildResult = runCommand(buildCommand, workspacePath);
    buildPassed = buildResult.passed;
    details.buildStatus = buildPassed ? 'pass' : 'fail';
    details.buildOutput = (buildResult.stdout + buildResult.stderr).slice(0, 2000);
  } else {
    details.buildStatus = 'skipped';
  }

  let testRatio = 1;
  let testsPassed = true;

  // Run test command
  if (testCommand) {
    const testResult = runCommand(testCommand, workspacePath);
    const combinedOutput = testResult.stdout + testResult.stderr;
    details.testOutput = combinedOutput.slice(0, 2000);

    const counts = parseTestCounts(combinedOutput);
    if (counts) {
      details.testCounts = counts;
      testRatio = counts.total > 0 ? counts.passed / counts.total : 0;
      testsPassed = counts.failed === 0 && testResult.passed;
    } else {
      // No parseable output — use exit code
      testsPassed = testResult.passed;
      testRatio = testResult.passed ? 1 : 0;
    }

    // Parse coverage if threshold configured
    if (coverageThreshold !== undefined) {
      const coverage = parseCoverage(combinedOutput);
      if (coverage !== undefined) {
        details.coveragePercent = coverage;
        details.coverageThreshold = coverageThreshold;
        details.coverageMet = coverage >= coverageThreshold;
      }
    }
  }

  // Compute score: weighted combination
  // Build: 30%, Tests: 50%, Coverage threshold: 20% (if configured)
  let score: number;
  if (buildCommand && testCommand && coverageThreshold !== undefined && details.coveragePercent !== undefined) {
    const buildScore = buildPassed ? 100 : 0;
    const testScore = Math.round(testRatio * 100);
    const coverageScore = details.coverageMet ? 100 : 0;
    score = Math.round(buildScore * 0.3 + testScore * 0.5 + coverageScore * 0.2);
  } else if (buildCommand && testCommand) {
    const buildScore = buildPassed ? 100 : 0;
    const testScore = Math.round(testRatio * 100);
    score = Math.round(buildScore * 0.4 + testScore * 0.6);
  } else if (buildCommand) {
    score = buildPassed ? 100 : 0;
  } else {
    // test command only
    score = Math.round(testRatio * 100);
  }

  const parts: string[] = [];
  if (buildCommand) parts.push(`Build: ${buildPassed ? 'PASS' : 'FAIL'}`);
  if (details.testCounts) parts.push(`Tests: ${details.testCounts.passed}/${details.testCounts.total} passed`);
  if (details.coveragePercent !== undefined) parts.push(`Coverage: ${details.coveragePercent}%`);

  return {
    metric: 'functionalCorrectness',
    score,
    details,
    reasoning: parts.join('. ') + '.',
  };
};

// Export for testing
export { runCommand, parseTestCounts, parseCoverage };
