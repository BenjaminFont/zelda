// Result store — atomic JSON persistence, run listing, run retrieval

import { mkdirSync, writeFileSync, readFileSync, readdirSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { RunResult, SessionTranscript } from '../types.js';

const writeAtomic = (filePath: string, data: string): void => {
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, data, 'utf-8');
  renameSync(tmpPath, filePath);
};

export const persistRun = (
  resultsDir: string,
  runResult: RunResult,
  transcript: SessionTranscript,
): void => {
  const runDir = join(resultsDir, runResult.id);
  mkdirSync(runDir, { recursive: true });

  writeAtomic(join(runDir, 'result.json'), JSON.stringify(runResult, null, 2));
  writeAtomic(join(runDir, 'transcript.json'), JSON.stringify(transcript, null, 2));
};

export const listRuns = (
  resultsDir: string,
): RunResult[] => {
  if (!existsSync(resultsDir)) {
    return [];
  }

  let entries: string[];
  try {
    entries = readdirSync(resultsDir);
  } catch {
    return [];
  }

  const results: RunResult[] = [];

  for (const entry of entries) {
    const resultPath = join(resultsDir, entry, 'result.json');
    try {
      const data = readFileSync(resultPath, 'utf-8');
      results.push(JSON.parse(data) as RunResult);
    } catch {
      // Skip entries without valid result.json
      continue;
    }
  }

  // Sort by timestamp descending (most recent first)
  results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return results;
};

export const getRun = (
  resultsDir: string,
  runId: string,
): RunResult | undefined => {
  const resultPath = join(resultsDir, runId, 'result.json');
  try {
    const data = readFileSync(resultPath, 'utf-8');
    return JSON.parse(data) as RunResult;
  } catch {
    return undefined;
  }
};

export const getTranscript = (
  resultsDir: string,
  runId: string,
): SessionTranscript | undefined => {
  const transcriptPath = join(resultsDir, runId, 'transcript.json');
  try {
    const data = readFileSync(transcriptPath, 'utf-8');
    return JSON.parse(data) as SessionTranscript;
  } catch {
    return undefined;
  }
};
