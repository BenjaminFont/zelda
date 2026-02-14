// Config resolver — merge project defaults with test suite overrides

import type { ResolvedConfig } from '../types.js';
import type { ProjectConfig, TestSuiteConfig } from './schemas.js';

export const resolveConfig = (
  projectConfig: ProjectConfig,
  testSuiteConfig: TestSuiteConfig,
  testSuiteName: string,
): ResolvedConfig => {
  return {
    judgeModel: projectConfig.judgeModel,
    gatewayUrl: projectConfig.gatewayUrl,
    resultsDir: projectConfig.resultsDir,
    testDir: projectConfig.testDir,
    execution: {
      ...projectConfig.execution,
      ...testSuiteConfig.execution,
    },
    metrics: {
      ...projectConfig.metrics,
      ...testSuiteConfig.metrics,
    },
    testSuiteName,
    prompt: testSuiteConfig.prompt,
    acceptanceCriteria: testSuiteConfig.acceptanceCriteria,
    buildCommand: testSuiteConfig.buildCommand,
    testCommand: testSuiteConfig.testCommand,
    coverageThreshold: testSuiteConfig.coverageThreshold,
  };
};
