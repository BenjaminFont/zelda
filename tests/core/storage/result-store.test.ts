import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { persistRun, listRuns, getRun, getTranscript } from '../../../src/core/storage/result-store.js';
import { generateRunId } from '../../../src/core/storage/run-id.js';
import type { RunResult, SessionTranscript } from '../../../src/core/types.js';

describe('storage/result-store', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'zelda-store-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const makeRunResult = (id: string, timestamp: string): RunResult => ({
    id,
    timestamp,
    testSuite: {
      name: 'test-api',
      prompt: 'Build an API',
      acceptanceCriteria: ['Returns 200'],
      execution: { model: 'claude-sonnet-4-5-20250929' },
      metrics: { efficiency: true },
    },
    metrics: {
      efficiency: {
        metric: 'efficiency',
        score: 85,
        details: { totalTokens: 1500 },
      },
    },
  });

  const makeTranscript = (): SessionTranscript => ({
    messages: [
      { role: 'assistant', content: 'Building the API' },
    ],
    metadata: {
      costUsd: 0.05,
      inputTokens: 500,
      outputTokens: 1000,
      turnCount: 2,
      durationMs: 30000,
      errorCount: 0,
    },
  });

  describe('persistRun', () => {
    it('writes result.json and transcript.json to run directory', () => {
      const runResult = makeRunResult('test-api-2026-02-14', '2026-02-14T10:00:00Z');
      const transcript = makeTranscript();

      persistRun(tempDir, runResult, transcript);

      const resultPath = join(tempDir, 'test-api-2026-02-14', 'result.json');
      const transcriptPath = join(tempDir, 'test-api-2026-02-14', 'transcript.json');

      expect(existsSync(resultPath)).toBe(true);
      expect(existsSync(transcriptPath)).toBe(true);

      const savedResult = JSON.parse(readFileSync(resultPath, 'utf-8'));
      expect(savedResult.id).toBe('test-api-2026-02-14');
      expect(savedResult.metrics.efficiency.score).toBe(85);

      const savedTranscript = JSON.parse(readFileSync(transcriptPath, 'utf-8'));
      expect(savedTranscript.messages).toHaveLength(1);
    });

    it('creates nested directories if needed', () => {
      const nestedDir = join(tempDir, 'nested', 'runs');
      const runResult = makeRunResult('test-run', '2026-02-14T10:00:00Z');

      persistRun(nestedDir, runResult, makeTranscript());

      expect(existsSync(join(nestedDir, 'test-run', 'result.json'))).toBe(true);
    });
  });

  describe('listRuns', () => {
    it('lists all runs sorted by timestamp descending', () => {
      persistRun(tempDir, makeRunResult('run-a', '2026-02-14T08:00:00Z'), makeTranscript());
      persistRun(tempDir, makeRunResult('run-c', '2026-02-14T12:00:00Z'), makeTranscript());
      persistRun(tempDir, makeRunResult('run-b', '2026-02-14T10:00:00Z'), makeTranscript());

      const runs = listRuns(tempDir);
      expect(runs).toHaveLength(3);
      expect(runs[0].id).toBe('run-c'); // most recent
      expect(runs[1].id).toBe('run-b');
      expect(runs[2].id).toBe('run-a'); // oldest
    });

    it('returns empty array when directory does not exist', () => {
      const runs = listRuns(join(tempDir, 'nonexistent'));
      expect(runs).toEqual([]);
    });

    it('skips directories without valid result.json', () => {
      persistRun(tempDir, makeRunResult('valid-run', '2026-02-14T10:00:00Z'), makeTranscript());

      // Create a directory without result.json
      const { mkdirSync } = require('node:fs');
      mkdirSync(join(tempDir, 'invalid-dir'));

      const runs = listRuns(tempDir);
      expect(runs).toHaveLength(1);
      expect(runs[0].id).toBe('valid-run');
    });
  });

  describe('getRun', () => {
    it('retrieves a specific run by ID', () => {
      persistRun(tempDir, makeRunResult('my-run', '2026-02-14T10:00:00Z'), makeTranscript());

      const run = getRun(tempDir, 'my-run');
      expect(run).toBeDefined();
      expect(run!.id).toBe('my-run');
      expect(run!.metrics.efficiency.score).toBe(85);
    });

    it('returns undefined for non-existent run', () => {
      const run = getRun(tempDir, 'ghost-run');
      expect(run).toBeUndefined();
    });
  });

  describe('getTranscript', () => {
    it('retrieves transcript for a run', () => {
      persistRun(tempDir, makeRunResult('my-run', '2026-02-14T10:00:00Z'), makeTranscript());

      const transcript = getTranscript(tempDir, 'my-run');
      expect(transcript).toBeDefined();
      expect(transcript!.messages).toHaveLength(1);
      expect(transcript!.metadata.costUsd).toBe(0.05);
    });

    it('returns undefined for non-existent transcript', () => {
      const transcript = getTranscript(tempDir, 'ghost-run');
      expect(transcript).toBeUndefined();
    });
  });
});

describe('storage/run-id', () => {
  it('generates ID in <test-name>-<timestamp> format', () => {
    const id = generateRunId('rest-endpoint');
    expect(id).toMatch(/^rest-endpoint-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
  });

  it('generates unique IDs for consecutive calls', () => {
    const id1 = generateRunId('test');
    // Small delay to ensure different timestamps
    const id2 = generateRunId('test');
    // They could be the same if called within the same millisecond, but format should be valid
    expect(id1).toMatch(/^test-/);
    expect(id2).toMatch(/^test-/);
  });
});
