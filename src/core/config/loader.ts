// Config loader — YAML parsing + Zod validation

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ConfigError } from '../errors.js';
import {
  ProjectConfigSchema,
  TestSuiteConfigSchema,
} from './schemas.js';
import type { ProjectConfig, TestSuiteConfig } from './schemas.js';

export const loadProjectConfig = (configPath: string): ProjectConfig => {
  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf-8');
  } catch {
    throw new ConfigError(
      `Config file not found: ${configPath}`,
      'CONFIG_NOT_FOUND',
      `Configuration file not found at ${configPath}. Run "zelda init" to create one.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch {
    throw new ConfigError(
      `Invalid YAML in ${configPath}`,
      'CONFIG_PARSE_FAILED',
      `Configuration file ${configPath} contains invalid YAML.`,
    );
  }

  const result = ProjectConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new ConfigError(
      `Validation failed for ${configPath}: ${result.error.message}`,
      'CONFIG_VALIDATION_FAILED',
      `Configuration validation failed for ${configPath}:\n${issues}`,
    );
  }

  return result.data;
};

export const loadTestSuite = (suitePath: string): TestSuiteConfig => {
  let raw: string;
  try {
    raw = readFileSync(suitePath, 'utf-8');
  } catch {
    throw new ConfigError(
      `Test suite file not found: ${suitePath}`,
      'SUITE_NOT_FOUND',
      `Test suite file not found at ${suitePath}.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch {
    throw new ConfigError(
      `Invalid YAML in ${suitePath}`,
      'SUITE_PARSE_FAILED',
      `Test suite file ${suitePath} contains invalid YAML.`,
    );
  }

  const result = TestSuiteConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new ConfigError(
      `Validation failed for ${suitePath}: ${result.error.message}`,
      'SUITE_VALIDATION_FAILED',
      `Test suite validation failed for ${suitePath}:\n${issues}`,
    );
  }

  return result.data;
};

export const discoverTestSuites = (
  testDir: string,
): { name: string; path: string; config: TestSuiteConfig }[] => {
  let entries: string[];
  try {
    entries = readdirSync(testDir);
  } catch {
    throw new ConfigError(
      `Test directory not found: ${testDir}`,
      'TEST_DIR_NOT_FOUND',
      `Test directory not found at ${testDir}. Run "zelda init" to create one.`,
    );
  }

  const suiteFiles = entries
    .filter((f) => f.startsWith('test-') && f.endsWith('.yaml'))
    .sort();

  return suiteFiles.map((file) => {
    const suitePath = join(testDir, file);
    const config = loadTestSuite(suitePath);
    const name = file.replace(/^test-/, '').replace(/\.yaml$/, '');
    return { name, path: suitePath, config };
  });
};
