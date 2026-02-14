// Init project — scaffolds zelda.yaml, test directory, and example test suite

import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const CONFIG_FILENAME = 'zelda.yaml';
const TEST_DIR = 'zelda';
const EXAMPLE_SUITE = 'test-example.yaml';
const GITIGNORE_ENTRY = '.zelda/';

const DEFAULT_CONFIG = `# Zelda configuration
# See documentation for all available options

# Model used for LLM-as-judge evaluations
judgeModel: claude-sonnet-4-5-20250929

# AI gateway URL (Portkey, LiteLLM, or direct Anthropic)
gatewayUrl: https://api.anthropic.com/v1

# Directory where run results are stored
resultsDir: .zelda/runs

# Directory containing test suite YAML files
testDir: zelda

# Default execution settings (can be overridden per test suite)
execution:
  model: claude-sonnet-4-5-20250929
  maxTurns: 25

# Default metric toggles (can be overridden per test suite)
metrics:
  efficiency: true
  # requirementFulfillment: true
  # toolUsage: true
  # functionalCorrectness: true
`;

const EXAMPLE_SUITE_CONTENT = `# Example test suite — edit this to match your project
# File naming: test-<name>.yaml (the <name> becomes the test suite identifier)

# The prompt sent to Claude Code for this evaluation
prompt: |
  Create a simple REST API endpoint that returns a JSON response
  with a greeting message. The endpoint should be at GET /api/hello
  and return { "message": "Hello, World!" } with a 200 status code.

# Criteria used to evaluate the generated code
acceptanceCriteria:
  - The endpoint GET /api/hello exists and is reachable
  - The response status code is 200
  - The response body is valid JSON containing a "message" field
  - The message value is "Hello, World!"

# Optional: override execution settings for this suite
# execution:
#   model: claude-sonnet-4-5-20250929
#   maxTurns: 15

# Optional: override metric toggles for this suite
# metrics:
#   efficiency: true

# Optional: build and test commands for functional correctness
# buildCommand: npm run build
# testCommand: npm test
`;

export type InitResult = {
  configCreated: boolean;
  testDirCreated: boolean;
  exampleSuiteCreated: boolean;
  gitignoreUpdated: boolean;
  warnings: string[];
};

export const initProject = (
  projectDir: string,
  overwrite = false,
): InitResult => {
  const result: InitResult = {
    configCreated: false,
    testDirCreated: false,
    exampleSuiteCreated: false,
    gitignoreUpdated: false,
    warnings: [],
  };

  const configPath = join(projectDir, CONFIG_FILENAME);
  const testDirPath = join(projectDir, TEST_DIR);
  const examplePath = join(testDirPath, EXAMPLE_SUITE);

  // Create config file
  if (existsSync(configPath) && !overwrite) {
    result.warnings.push(`${CONFIG_FILENAME} already exists. Use --force to overwrite.`);
  } else {
    writeFileSync(configPath, DEFAULT_CONFIG, 'utf-8');
    result.configCreated = true;
  }

  // Create test directory
  if (!existsSync(testDirPath)) {
    mkdirSync(testDirPath, { recursive: true });
    result.testDirCreated = true;
  }

  // Create example test suite
  if (existsSync(examplePath) && !overwrite) {
    result.warnings.push(`${EXAMPLE_SUITE} already exists. Use --force to overwrite.`);
  } else {
    writeFileSync(examplePath, EXAMPLE_SUITE_CONTENT, 'utf-8');
    result.exampleSuiteCreated = true;
  }

  // Update .gitignore
  const gitignorePath = join(projectDir, '.gitignore');
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8');
    if (!content.includes(GITIGNORE_ENTRY)) {
      appendFileSync(gitignorePath, `\n# Zelda workspaces and run data\n${GITIGNORE_ENTRY}\n`);
      result.gitignoreUpdated = true;
    }
  } else {
    writeFileSync(gitignorePath, `# Zelda workspaces and run data\n${GITIGNORE_ENTRY}\n`, 'utf-8');
    result.gitignoreUpdated = true;
  }

  return result;
};
