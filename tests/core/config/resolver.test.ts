import { describe, it, expect } from 'vitest';
import { resolveConfig } from '../../../src/core/config/resolver.js';
import type { ProjectConfig, TestSuiteConfig } from '../../../src/core/config/schemas.js';

describe('config/resolver', () => {
  const baseProjectConfig: ProjectConfig = {
    judgeModel: 'claude-sonnet-4-5-20250929',
    gatewayUrl: 'https://api.portkey.ai/v1',
    resultsDir: '.zelda/runs',
    testDir: 'zelda',
    execution: { model: 'claude-sonnet-4-5-20250929', maxTurns: 25 },
    metrics: {
      efficiency: true,
      requirementFulfillment: true,
      toolUsage: true,
      functionalCorrectness: true,
    },
  };

  const baseTestSuiteConfig: TestSuiteConfig = {
    prompt: 'Build a REST API',
    acceptanceCriteria: ['Returns 200', 'Has JSON body'],
  };

  it('resolves with project defaults when test suite has no overrides', () => {
    const resolved = resolveConfig(baseProjectConfig, baseTestSuiteConfig, 'api-test');

    expect(resolved.judgeModel).toBe('claude-sonnet-4-5-20250929');
    expect(resolved.gatewayUrl).toBe('https://api.portkey.ai/v1');
    expect(resolved.resultsDir).toBe('.zelda/runs');
    expect(resolved.testDir).toBe('zelda');
    expect(resolved.execution.model).toBe('claude-sonnet-4-5-20250929');
    expect(resolved.execution.maxTurns).toBe(25);
    expect(resolved.metrics.efficiency).toBe(true);
    expect(resolved.testSuiteName).toBe('api-test');
    expect(resolved.prompt).toBe('Build a REST API');
    expect(resolved.acceptanceCriteria).toEqual(['Returns 200', 'Has JSON body']);
  });

  it('test suite execution overrides project execution defaults', () => {
    const suiteWithExec: TestSuiteConfig = {
      ...baseTestSuiteConfig,
      execution: { model: 'claude-opus-4-6', maxTurns: 10 },
    };
    const resolved = resolveConfig(baseProjectConfig, suiteWithExec, 'test');

    expect(resolved.execution.model).toBe('claude-opus-4-6');
    expect(resolved.execution.maxTurns).toBe(10);
  });

  it('test suite partial execution override merges with project defaults', () => {
    const suiteWithPartialExec: TestSuiteConfig = {
      ...baseTestSuiteConfig,
      execution: { maxTurns: 5 },
    };
    const resolved = resolveConfig(baseProjectConfig, suiteWithPartialExec, 'test');

    expect(resolved.execution.model).toBe('claude-sonnet-4-5-20250929');
    expect(resolved.execution.maxTurns).toBe(5);
  });

  it('test suite metric toggles override project metric toggles', () => {
    const suiteWithMetrics: TestSuiteConfig = {
      ...baseTestSuiteConfig,
      metrics: { functionalCorrectness: false },
    };
    const resolved = resolveConfig(baseProjectConfig, suiteWithMetrics, 'test');

    expect(resolved.metrics.efficiency).toBe(true);
    expect(resolved.metrics.requirementFulfillment).toBe(true);
    expect(resolved.metrics.functionalCorrectness).toBe(false);
  });

  it('includes test suite specific fields', () => {
    const suiteWithExtras: TestSuiteConfig = {
      ...baseTestSuiteConfig,
      buildCommand: 'npm run build',
      testCommand: 'npm test',
      coverageThreshold: 80,
    };
    const resolved = resolveConfig(baseProjectConfig, suiteWithExtras, 'test');

    expect(resolved.buildCommand).toBe('npm run build');
    expect(resolved.testCommand).toBe('npm test');
    expect(resolved.coverageThreshold).toBe(80);
  });

  it('omits optional fields when not set in test suite', () => {
    const resolved = resolveConfig(baseProjectConfig, baseTestSuiteConfig, 'test');

    expect(resolved.buildCommand).toBeUndefined();
    expect(resolved.testCommand).toBeUndefined();
    expect(resolved.coverageThreshold).toBeUndefined();
  });

  it('handles project config without optional execution and metrics', () => {
    const minimalProject: ProjectConfig = {
      judgeModel: 'claude-sonnet-4-5-20250929',
      gatewayUrl: 'https://api.portkey.ai/v1',
      resultsDir: '.zelda/runs',
      testDir: 'zelda',
    };
    const resolved = resolveConfig(minimalProject, baseTestSuiteConfig, 'test');

    expect(resolved.execution).toEqual({});
    expect(resolved.metrics).toEqual({});
  });

  it('test suite execution overrides undefined project execution', () => {
    const minimalProject: ProjectConfig = {
      judgeModel: 'claude-sonnet-4-5-20250929',
      gatewayUrl: 'https://api.portkey.ai/v1',
      resultsDir: '.zelda/runs',
      testDir: 'zelda',
    };
    const suiteWithExec: TestSuiteConfig = {
      ...baseTestSuiteConfig,
      execution: { model: 'claude-opus-4-6', maxTurns: 10 },
    };
    const resolved = resolveConfig(minimalProject, suiteWithExec, 'test');

    expect(resolved.execution.model).toBe('claude-opus-4-6');
    expect(resolved.execution.maxTurns).toBe(10);
  });
});
