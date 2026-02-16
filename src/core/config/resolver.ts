// Config resolver — merge project defaults with test suite overrides

import type { ResolvedConfig } from '../types.js';
import type { ProjectConfig, TestSuiteConfig } from './schemas.js';
import { TASK_SIZE_MAP } from './schemas.js';

export const resolveConfig = (
  projectConfig: ProjectConfig,
  testSuiteConfig: TestSuiteConfig,
  testSuiteName: string,
): ResolvedConfig => {
  const mergedExecution = {
    ...projectConfig.execution,
    ...testSuiteConfig.execution,
  };

  // If the test suite sets taskSize without maxTurns, the suite intends
  // taskSize to control turns — clear any inherited maxTurns from project
  if (testSuiteConfig.execution?.taskSize && testSuiteConfig.execution?.maxTurns === undefined) {
    delete mergedExecution.maxTurns;
  }

  // Resolve taskSize to maxTurns (explicit maxTurns takes priority)
  if (mergedExecution.taskSize && mergedExecution.maxTurns === undefined) {
    mergedExecution.maxTurns = TASK_SIZE_MAP[mergedExecution.taskSize];
  }

  return {
    judgeModel: projectConfig.judgeModel,
    gatewayUrl: projectConfig.gatewayUrl,
    resultsDir: projectConfig.resultsDir,
    testDir: projectConfig.testDir,
    execution: mergedExecution,
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
    staticAnalysis: testSuiteConfig.staticAnalysis,
    complexityThreshold: testSuiteConfig.complexityThreshold,
  };
};
