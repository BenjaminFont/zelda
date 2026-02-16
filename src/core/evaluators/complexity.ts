// Code complexity evaluator — detects touched files and computes APP density scores

import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { isSourceFile, analyzeFile } from './app-parser.js';
import type { AppElementCounts } from './app-parser.js';
import type { Evaluator, EvalContext, EvalResult } from '../types.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export type FileComplexityResult = {
  filePath: string;
  isNew: boolean;
  elementCounts: AppElementCounts;
  weightedTotal: number;
  loc: number;
  density: number;
  delta?: number;
};

export type ComplexityDetails = {
  files: FileComplexityResult[];
  averageDensity: number;
  threshold: number;
};

// ─── Excluded directories ───────────────────────────────────────────────────

const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', '.zelda', 'dist',
  'coverage', '.coverage',
  'build', '.next', '.nuxt',
  '__pycache__', '.tox', 'vendor',
]);

const isInExcludedDir = (filePath: string): boolean =>
  filePath.split('/').some((segment) => EXCLUDED_DIRS.has(segment));

// ─── Helper: recursive walk ─────────────────────────────────────────────────

const walkSourceFiles = (
  basePath: string,
  currentPath: string = basePath,
): string[] => {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(currentPath);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const fullPath = join(currentPath, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      results.push(...walkSourceFiles(basePath, fullPath));
    } else if (isSourceFile(entry)) {
      results.push(relative(basePath, fullPath));
    }
  }

  return results;
};

// ─── Exported functions ─────────────────────────────────────────────────────

export const capturePreSnapshot = (
  workspacePath: string,
): Record<string, string> => {
  const snapshot: Record<string, string> = {};
  const files = walkSourceFiles(workspacePath);

  for (const filePath of files) {
    try {
      snapshot[filePath] = readFileSync(join(workspacePath, filePath), 'utf-8');
    } catch {
      // Skip unreadable files
    }
  }

  return snapshot;
};

export const detectTouchedFiles = (
  workspacePath: string,
  preSnapshot?: Record<string, string>,
): string[] => {
  if (!preSnapshot) {
    // Git mode
    try {
      const diffOutput = execSync('git diff --name-only HEAD', {
        cwd: workspacePath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      const untrackedOutput = execSync(
        'git ls-files --others --exclude-standard',
        {
          cwd: workspacePath,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      ).trim();

      const allFiles = [
        ...(diffOutput ? diffOutput.split('\n') : []),
        ...(untrackedOutput ? untrackedOutput.split('\n') : []),
      ];

      return [...new Set(allFiles)].filter(
        (f) => isSourceFile(f) && !isInExcludedDir(f),
      );
    } catch {
      return [];
    }
  }

  // Snapshot mode — compare current state against pre-snapshot
  const currentFiles = walkSourceFiles(workspacePath);
  const touched: string[] = [];

  for (const filePath of currentFiles) {
    const priorContent = preSnapshot[filePath];
    if (priorContent === undefined) {
      // New file
      touched.push(filePath);
    } else {
      // Check if modified
      try {
        const currentContent = readFileSync(
          join(workspacePath, filePath),
          'utf-8',
        );
        if (currentContent !== priorContent) {
          touched.push(filePath);
        }
      } catch {
        // Skip unreadable
      }
    }
  }

  return touched;
};

export const getPreContent = (
  workspacePath: string,
  filePath: string,
  preSnapshot?: Record<string, string>,
): string | undefined => {
  if (preSnapshot) {
    return preSnapshot[filePath];
  }

  // Git mode
  try {
    return execSync(`git show HEAD:${filePath}`, {
      cwd: workspacePath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return undefined;
  }
};

export const computeComplexityScore = (
  avgDensity: number,
  threshold: number,
): number => {
  return Math.max(0, Math.min(100, Math.round(100 * (1 - avgDensity / threshold))));
};

export const complexityEvaluator: Evaluator = async (
  context: EvalContext,
): Promise<EvalResult> => {
  const { config, workspacePath } = context;
  const threshold = config.complexityThreshold ?? 20;
  const preSnapshot = context.preSnapshot;

  const touchedFiles = detectTouchedFiles(workspacePath, preSnapshot);

  if (touchedFiles.length === 0) {
    return {
      metric: 'complexity',
      score: 100,
      details: {
        files: [],
        averageDensity: 0,
        threshold,
      } satisfies ComplexityDetails,
      reasoning: 'No source files modified.',
    };
  }

  const fileResults: FileComplexityResult[] = [];

  for (const filePath of touchedFiles) {
    let postContent: string;
    try {
      postContent = readFileSync(join(workspacePath, filePath), 'utf-8');
    } catch {
      continue;
    }

    const postAnalysis = analyzeFile(filePath, postContent);
    const preContent = getPreContent(workspacePath, filePath, preSnapshot);
    const isNew = preContent === undefined;

    let delta: number | undefined;
    if (!isNew) {
      const preAnalysis = analyzeFile(filePath, preContent);
      delta = postAnalysis.density - preAnalysis.density;
    }

    fileResults.push({
      filePath,
      isNew,
      elementCounts: postAnalysis.elementCounts,
      weightedTotal: postAnalysis.weightedTotal,
      loc: postAnalysis.loc,
      density: postAnalysis.density,
      delta,
    });
  }

  if (fileResults.length === 0) {
    return {
      metric: 'complexity',
      score: 100,
      details: {
        files: [],
        averageDensity: 0,
        threshold,
      } satisfies ComplexityDetails,
      reasoning: 'No source files modified.',
    };
  }

  const totalDensity = fileResults.reduce((sum, f) => sum + f.density, 0);
  const averageDensity = totalDensity / fileResults.length;
  const score = computeComplexityScore(averageDensity, threshold);

  const fileSummaries = fileResults.map(
    (f) => `${f.filePath}: density=${f.density.toFixed(2)}${f.isNew ? ' (new)' : ''}${f.delta !== undefined ? ` delta=${f.delta.toFixed(2)}` : ''}`,
  );
  const reasoning = `${fileResults.length} file(s) analyzed. Average density: ${averageDensity.toFixed(2)} (threshold: ${threshold}). ${fileSummaries.join('; ')}.`;

  return {
    metric: 'complexity',
    score,
    details: { files: fileResults, averageDensity, threshold } satisfies ComplexityDetails,
    reasoning,
  };
};
