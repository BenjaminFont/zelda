// Code quality evaluator — runs static analysis commands and scores based on error/warning counts

import { execSync } from 'node:child_process';
import type { Evaluator, EvalContext, EvalResult } from '../types.js';

export type CommandAnalysisResult = {
  command: string;
  exitCode: number;
  passed: boolean;
  errors: number;
  warnings: number;
  output: string;
};

export type CodeQualityDetails = {
  commands: CommandAnalysisResult[];
  totalErrors: number;
  totalWarnings: number;
};

const runCommand = (
  command: string,
  workspacePath: string,
): { exitCode: number; output: string } => {
  try {
    const stdout = execSync(command, {
      cwd: workspacePath,
      encoding: 'utf-8',
      timeout: 300_000,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    return { exitCode: 0, output: stdout };
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: string; stderr?: string; message?: string };
    const stdout = String(err.stdout ?? '');
    const stderr = String(err.stderr ?? '');
    const combined = stdout + stderr;
    // If both stdout and stderr are empty, use the error message
    if (!combined.trim()) {
      return {
        exitCode: err.status ?? 1,
        output: err.message ?? 'Command failed',
      };
    }
    return {
      exitCode: err.status ?? 1,
      output: combined,
    };
  }
};

export const parseErrorsAndWarnings = (
  output: string,
): { errors: number; warnings: number } => {
  // Pattern 1: ESLint summary — "✖ N problems (X errors, Y warnings)"
  const eslintSummary = output.match(
    /✖\s+\d+\s+problems?\s+\((\d+)\s+errors?,\s*(\d+)\s+warnings?\)/,
  );
  if (eslintSummary) {
    return {
      errors: parseInt(eslintSummary[1], 10),
      warnings: parseInt(eslintSummary[2], 10),
    };
  }

  // Pattern 2: ESLint shorthand — "X errors" / "Y warnings" on summary lines
  const eslintErrors = output.match(/(\d+)\s+errors?(?:\s|,|$)/);
  const eslintWarnings = output.match(/(\d+)\s+warnings?(?:\s|,|$)/);
  if (eslintErrors || eslintWarnings) {
    return {
      errors: eslintErrors ? parseInt(eslintErrors[1], 10) : 0,
      warnings: eslintWarnings ? parseInt(eslintWarnings[1], 10) : 0,
    };
  }

  // Pattern 3: TypeScript — count lines matching "error TS\d+:"
  const tsErrors = (output.match(/error TS\d+:/g) ?? []).length;
  if (tsErrors > 0) {
    return { errors: tsErrors, warnings: 0 };
  }

  // Pattern 4: Generic — count lines containing " error " or " warning " (case-insensitive)
  const lines = output.split('\n');
  let errors = 0;
  let warnings = 0;
  for (const line of lines) {
    if (/\berror\b/i.test(line)) errors++;
    if (/\bwarning\b/i.test(line)) warnings++;
  }
  if (errors > 0 || warnings > 0) {
    return { errors, warnings };
  }

  // Fallback: rely on exit code
  return { errors: 0, warnings: 0 };
};

export const codeQualityEvaluator: Evaluator = async (
  context: EvalContext,
): Promise<EvalResult> => {
  const { config, workspacePath } = context;
  const staticAnalysis = config.staticAnalysis;

  if (!staticAnalysis || staticAnalysis.length === 0) {
    return {
      metric: 'codeQuality',
      score: 100,
      details: {
        commands: [],
        totalErrors: 0,
        totalWarnings: 0,
      } satisfies CodeQualityDetails,
      reasoning: 'No static analysis commands configured — code quality not evaluated.',
    };
  }

  const commands: CommandAnalysisResult[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const command of staticAnalysis) {
    const result = runCommand(command, workspacePath);
    const { errors, warnings } = parseErrorsAndWarnings(result.output);
    const passed = result.exitCode === 0;

    commands.push({
      command,
      exitCode: result.exitCode,
      passed,
      errors,
      warnings,
      output: result.output.slice(0, 2000),
    });

    // If exit code is non-zero but we parsed no errors, count as 1 error (tool failure)
    if (!passed && errors === 0) {
      totalErrors += 1;
    } else {
      totalErrors += errors;
    }
    totalWarnings += warnings;
  }

  const rawScore = 100 - totalErrors * 10 - totalWarnings * 2;
  const score = Math.max(0, Math.min(100, rawScore));

  const parts = commands.map(
    (c) =>
      `${c.command}: ${c.passed ? 'PASS' : 'FAIL'} (${c.errors} errors, ${c.warnings} warnings)`,
  );
  const reasoning = parts.join('. ') + `.`;

  return {
    metric: 'codeQuality',
    score,
    details: { commands, totalErrors, totalWarnings } satisfies CodeQualityDetails,
    reasoning,
  };
};
