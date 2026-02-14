import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stringify as stringifyYaml } from 'yaml';
import { runPipeline } from '../../../src/core/pipeline/run-pipeline.js';

// Mock the execution client to avoid real Claude SDK calls
vi.mock('../../../src/core/execution/execution-client.js', () => ({
  executeSession: vi.fn().mockResolvedValue({
    transcript: {
      messages: [
        { role: 'assistant', content: 'Done building the API' },
      ],
      metadata: {
        costUsd: 0.05,
        inputTokens: 500,
        outputTokens: 1000,
        turnCount: 3,
        durationMs: 15000,
        errorCount: 0,
      },
    },
  }),
}));

// Mock workspace manager to avoid git worktree operations
vi.mock('../../../src/core/workspace/manager.js', () => ({
  createWorkspace: vi.fn((_projectDir: string, runId: string) => {
    const dir = join(tmpdir(), `zelda-test-workspace-${runId}`);
    mkdirSync(dir, { recursive: true });
    return dir;
  }),
  cleanupWorkspace: vi.fn(),
  registerCleanupHandlers: vi.fn(() => vi.fn()),
}));

// Suppress terminal output during tests
vi.mock('../../../src/core/reporter/terminal-reporter.js', () => ({
  printRunReport: vi.fn(),
}));

describe('pipeline/run-pipeline', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'zelda-pipeline-test-'));
    vi.clearAllMocks();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const setupProject = (opts?: { suites?: string[] }) => {
    const suiteNames = opts?.suites ?? ['api'];

    // Write zelda.yaml project config
    const projectConfig = {
      judgeModel: 'claude-sonnet-4-5-20250929',
      gatewayUrl: 'https://api.portkey.ai/v1',
      resultsDir: '.zelda/runs',
      testDir: 'zelda',
      execution: { model: 'claude-sonnet-4-5-20250929' },
      metrics: { efficiency: true },
    };
    writeFileSync(join(tempDir, 'zelda.yaml'), stringifyYaml(projectConfig));

    // Write test suite files
    const testDir = join(tempDir, 'zelda');
    mkdirSync(testDir, { recursive: true });

    for (const name of suiteNames) {
      const suiteConfig = {
        prompt: `Build a ${name}`,
        acceptanceCriteria: ['Works correctly'],
      };
      writeFileSync(join(testDir, `test-${name}.yaml`), stringifyYaml(suiteConfig));
    }
  };

  it('runs a single named test suite end-to-end', async () => {
    setupProject();

    const result = await runPipeline({
      projectDir: tempDir,
      testName: 'api',
    });

    expect(result.runs).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.runs[0].testSuite.name).toBe('api');
    expect(result.runs[0].metrics.efficiency).toBeDefined();
    expect(result.runs[0].metrics.efficiency.score).toBeGreaterThanOrEqual(0);
  });

  it('discovers and runs all test suites when no name specified', async () => {
    setupProject({ suites: ['api', 'cli'] });

    const result = await runPipeline({
      projectDir: tempDir,
    });

    expect(result.runs).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    const names = result.runs.map((r) => r.testSuite.name).sort();
    expect(names).toEqual(['api', 'cli']);
  });

  it('persists run results to the results directory', async () => {
    setupProject();

    const result = await runPipeline({
      projectDir: tempDir,
      testName: 'api',
    });

    const runId = result.runs[0].id;
    const resultsDir = join(tempDir, '.zelda', 'runs');
    const resultFile = join(resultsDir, runId, 'result.json');
    const transcriptFile = join(resultsDir, runId, 'transcript.json');

    expect(existsSync(resultFile)).toBe(true);
    expect(existsSync(transcriptFile)).toBe(true);
  });

  it('calls printRunReport for each completed run', async () => {
    setupProject({ suites: ['api', 'cli'] });

    await runPipeline({ projectDir: tempDir });

    const { printRunReport } = await import('../../../src/core/reporter/terminal-reporter.js');
    expect(printRunReport).toHaveBeenCalledTimes(2);
  });

  it('calls cleanupWorkspace after each run', async () => {
    setupProject();

    await runPipeline({ projectDir: tempDir, testName: 'api' });

    const { cleanupWorkspace } = await import('../../../src/core/workspace/manager.js');
    expect(cleanupWorkspace).toHaveBeenCalledTimes(1);
  });

  it('returns error when test suite not found', async () => {
    setupProject();

    const result = await runPipeline({
      projectDir: tempDir,
      testName: 'nonexistent',
    });

    expect(result.runs).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('nonexistent');
  });

  it('throws ConfigError when zelda.yaml is missing', async () => {
    // No project setup — no zelda.yaml
    await expect(
      runPipeline({ projectDir: tempDir }),
    ).rejects.toThrow();
  });

  it('continues running other suites when one fails', async () => {
    setupProject({ suites: ['api', 'failing'] });

    // Make the 'failing' suite invalid by removing its file and recreating with bad content
    writeFileSync(
      join(tempDir, 'zelda', 'test-failing.yaml'),
      'not: valid\nsuite: config\n',
    );

    const result = await runPipeline({ projectDir: tempDir });

    // api should succeed, failing should error
    expect(result.runs.length).toBeGreaterThanOrEqual(1);
    // Total runs + errors should equal 2
    expect(result.runs.length + result.errors.length).toBe(2);
  });

  it('generates unique run IDs', async () => {
    setupProject({ suites: ['api', 'cli'] });

    const result = await runPipeline({ projectDir: tempDir });

    const ids = result.runs.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sets timestamp on run result', async () => {
    setupProject();

    const before = new Date().toISOString();
    const result = await runPipeline({ projectDir: tempDir, testName: 'api' });
    const after = new Date().toISOString();

    expect(result.runs[0].timestamp).toBeDefined();
    expect(result.runs[0].timestamp >= before).toBe(true);
    expect(result.runs[0].timestamp <= after).toBe(true);
  });
});
