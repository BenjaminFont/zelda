import { describe, it, expect } from 'vitest';
import { renderRunList } from '../../../src/core/reporter/list-reporter.js';
import type { RunResult } from '../../../src/core/types.js';

const stripAnsi = (str: string): string =>
  str.replace(/\x1b\[[0-9;]*m/g, '');

const makeRun = (overrides?: Partial<RunResult>): RunResult => ({
  id: 'test-api-2026-02-14T10-00-00-000',
  timestamp: '2026-02-14T10:00:00.000Z',
  testSuite: {
    name: 'test-api',
    prompt: 'Build an API',
    acceptanceCriteria: ['Returns 200'],
    execution: {},
    metrics: { efficiency: true },
  },
  metrics: {
    efficiency: { metric: 'efficiency', score: 85, details: {}, reasoning: 'OK' },
    requirementFulfillment: { metric: 'requirementFulfillment', score: 80, details: {}, reasoning: 'OK' },
    toolUsage: { metric: 'toolUsage', score: 100, details: {}, reasoning: 'OK' },
  },
  ...overrides,
});

describe('reporter/list-reporter', () => {
  it('shows "No runs found" message when list is empty', () => {
    const output = stripAnsi(renderRunList([]));
    expect(output).toContain('No runs found');
    expect(output).toContain('zelda run');
  });

  it('shows run count in header', () => {
    const output = stripAnsi(renderRunList([makeRun()]));
    expect(output).toContain('1');
    expect(output).toContain('Evaluation Runs');
  });

  it('shows run ID', () => {
    const output = stripAnsi(renderRunList([makeRun()]));
    expect(output).toContain('test-api-2026-02-14T10-00-00-000');
  });

  it('shows test suite name', () => {
    const output = stripAnsi(renderRunList([makeRun()]));
    expect(output).toContain('test-api');
  });

  it('shows metric scores', () => {
    const output = stripAnsi(renderRunList([makeRun()]));
    expect(output).toContain('85.0%');
    expect(output).toContain('80.0%');
    expect(output).toContain('100.0%');
  });

  it('shows N/A for missing metrics', () => {
    const run = makeRun({ metrics: {} });
    const output = stripAnsi(renderRunList([run]));
    expect(output).toContain('N/A');
  });

  it('shows multiple runs', () => {
    const runs = [
      makeRun({ id: 'run-1', timestamp: '2026-02-14T12:00:00.000Z' }),
      makeRun({ id: 'run-2', timestamp: '2026-02-14T10:00:00.000Z' }),
    ];
    const output = stripAnsi(renderRunList(runs));
    expect(output).toContain('run-1');
    expect(output).toContain('run-2');
    expect(output).toContain('2');
  });

  it('contains no emoji characters', () => {
    const output = renderRunList([makeRun()]);
    const emojiPattern = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiPattern.test(output)).toBe(false);
  });
});
