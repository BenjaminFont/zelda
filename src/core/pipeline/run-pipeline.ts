// Run pipeline — orchestrates config → workspace → execute → evaluate → persist → report → cleanup

import { resolve, join } from 'node:path';
import { readdirSync } from 'node:fs';
import { loadProjectConfig, loadTestSuite } from '../config/loader.js';
import { resolveConfig } from '../config/resolver.js';
import { createWorkspace, cleanupWorkspace, registerCleanupHandlers } from '../workspace/manager.js';
import { executeSession } from '../execution/execution-client.js';
import { efficiencyEvaluator } from '../evaluators/efficiency.js';
import { fulfillmentEvaluator } from '../evaluators/fulfillment.js';
import { toolUsageEvaluator } from '../evaluators/tool-usage.js';
import { scanToolsManifest } from '../tools/manifest-scanner.js';
import { persistRun } from '../storage/result-store.js';
import { generateRunId } from '../storage/run-id.js';
import { printRunReport } from '../reporter/terminal-reporter.js';
import { ZeldaError } from '../errors.js';
import type { RunResult, EvalResult, EvalContext, ToolsManifest } from '../types.js';

export type PipelineOptions = {
  projectDir: string;
  testName?: string;
};

export type PipelineResult = {
  runs: RunResult[];
  errors: string[];
};

const emptyToolsManifest: ToolsManifest = {
  skills: [],
  rules: [],
  subAgents: [],
  mcpConfigs: [],
};

const runSingleSuite = async (
  projectDir: string,
  suiteName: string,
  suitePath: string,
  projectConfig: ReturnType<typeof loadProjectConfig>,
): Promise<{ run?: RunResult; error?: string }> => {
  const runId = generateRunId(suiteName);
  let workspacePath: string | undefined;
  let deregister: (() => void) | undefined;

  try {
    // Load and validate suite config
    const suiteConfig = loadTestSuite(suitePath);
    const resolvedConfig = resolveConfig(projectConfig, suiteConfig, suiteName);

    // Create workspace
    workspacePath = createWorkspace(projectDir, runId);
    deregister = registerCleanupHandlers(projectDir, workspacePath);

    // Execute Claude Code session
    const { transcript } = await executeSession({
      prompt: resolvedConfig.prompt,
      workspacePath,
      model: resolvedConfig.execution.model,
      maxTurns: resolvedConfig.execution.maxTurns,
    });

    // Scan tools manifest from workspace
    const toolsManifest = scanToolsManifest(workspacePath);

    // Evaluate
    const evalContext: EvalContext = {
      config: resolvedConfig,
      transcript,
      workspacePath,
      toolsManifest,
    };

    const metrics: Record<string, EvalResult> = {};

    if (resolvedConfig.metrics.efficiency !== false) {
      metrics.efficiency = await efficiencyEvaluator(evalContext);
    }

    if (resolvedConfig.metrics.requirementFulfillment) {
      metrics.requirementFulfillment = await fulfillmentEvaluator(evalContext);
    }

    if (resolvedConfig.metrics.toolUsage) {
      metrics.toolUsage = await toolUsageEvaluator(evalContext);
    }

    // Build run result
    const runResult: RunResult = {
      id: runId,
      timestamp: new Date().toISOString(),
      testSuite: {
        name: suiteName,
        prompt: resolvedConfig.prompt,
        acceptanceCriteria: resolvedConfig.acceptanceCriteria,
        execution: resolvedConfig.execution,
        metrics: resolvedConfig.metrics,
      },
      metrics,
    };

    // Persist results
    const resultsDir = resolve(projectDir, resolvedConfig.resultsDir);
    persistRun(resultsDir, runResult, transcript);

    // Display report before cleanup
    printRunReport(runResult);

    return { run: runResult };
  } catch (e) {
    const errorMsg = e instanceof ZeldaError
      ? e.userMessage
      : `Unexpected error: ${e instanceof Error ? e.message : String(e)}`;
    return { error: `[${suiteName}] ${errorMsg}` };
  } finally {
    // Cleanup workspace
    if (deregister) deregister();
    if (workspacePath) {
      cleanupWorkspace(projectDir, workspacePath);
    }
  }
};

export const runPipeline = async (
  options: PipelineOptions,
): Promise<PipelineResult> => {
  const projectDir = resolve(options.projectDir);
  const configPath = join(projectDir, 'zelda.yaml');
  const projectConfig = loadProjectConfig(configPath);
  const testDir = resolve(projectDir, projectConfig.testDir);

  let suites: { name: string; path: string }[];

  if (options.testName) {
    // Run specific test suite
    const suitePath = join(testDir, `test-${options.testName}.yaml`);
    suites = [{ name: options.testName, path: suitePath }];
  } else {
    // Discover test suite files without eagerly validating
    let entries: string[];
    try {
      entries = readdirSync(testDir);
    } catch {
      return { runs: [], errors: [] };
    }
    suites = entries
      .filter((f) => f.startsWith('test-') && f.endsWith('.yaml'))
      .sort()
      .map((f) => ({
        name: f.replace(/^test-/, '').replace(/\.yaml$/, ''),
        path: join(testDir, f),
      }));
  }

  const runs: RunResult[] = [];
  const errors: string[] = [];

  for (const suite of suites) {
    const result = await runSingleSuite(
      projectDir,
      suite.name,
      suite.path,
      projectConfig,
    );

    if (result.run) runs.push(result.run);
    if (result.error) errors.push(result.error);
  }

  return { runs, errors };
};
