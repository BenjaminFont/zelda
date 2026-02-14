import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadProjectConfig,
  loadTestSuite,
  discoverTestSuites,
} from '../../../src/core/config/loader.js';
import { ConfigError } from '../../../src/core/errors.js';

describe('config/loader', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'zelda-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('loadProjectConfig', () => {
    it('loads and validates a valid config file', () => {
      const configPath = join(tempDir, 'zelda.config.yaml');
      writeFileSync(configPath, `
judgeModel: claude-sonnet-4-5-20250929
gatewayUrl: https://api.portkey.ai/v1
resultsDir: .zelda/runs
testDir: zelda
execution:
  model: claude-sonnet-4-5-20250929
  maxTurns: 25
metrics:
  efficiency: true
`);
      const config = loadProjectConfig(configPath);
      expect(config.judgeModel).toBe('claude-sonnet-4-5-20250929');
      expect(config.gatewayUrl).toBe('https://api.portkey.ai/v1');
      expect(config.resultsDir).toBe('.zelda/runs');
      expect(config.testDir).toBe('zelda');
      expect(config.execution?.model).toBe('claude-sonnet-4-5-20250929');
      expect(config.execution?.maxTurns).toBe(25);
      expect(config.metrics?.efficiency).toBe(true);
    });

    it('loads minimal config with only required fields', () => {
      const configPath = join(tempDir, 'zelda.config.yaml');
      writeFileSync(configPath, `
judgeModel: claude-sonnet-4-5-20250929
gatewayUrl: https://api.portkey.ai/v1
resultsDir: .zelda/runs
testDir: zelda
`);
      const config = loadProjectConfig(configPath);
      expect(config.judgeModel).toBe('claude-sonnet-4-5-20250929');
      expect(config.execution).toBeUndefined();
      expect(config.metrics).toBeUndefined();
    });

    it('throws ConfigError for missing file', () => {
      expect(() => loadProjectConfig(join(tempDir, 'nonexistent.yaml'))).toThrow(ConfigError);
      try {
        loadProjectConfig(join(tempDir, 'nonexistent.yaml'));
      } catch (e) {
        const err = e as ConfigError;
        expect(err.code).toBe('CONFIG_NOT_FOUND');
        expect(err.userMessage).toContain('not found');
      }
    });

    it('throws ConfigError for invalid YAML', () => {
      const configPath = join(tempDir, 'bad.yaml');
      writeFileSync(configPath, '{{{{ invalid yaml');
      expect(() => loadProjectConfig(configPath)).toThrow(ConfigError);
      try {
        loadProjectConfig(configPath);
      } catch (e) {
        const err = e as ConfigError;
        expect(err.code).toBe('CONFIG_PARSE_FAILED');
      }
    });

    it('throws ConfigError with clear message for validation failure', () => {
      const configPath = join(tempDir, 'invalid.yaml');
      writeFileSync(configPath, `
judgeModel: claude-sonnet-4-5-20250929
gatewayUrl: not-a-url
`);
      expect(() => loadProjectConfig(configPath)).toThrow(ConfigError);
      try {
        loadProjectConfig(configPath);
      } catch (e) {
        const err = e as ConfigError;
        expect(err.code).toBe('CONFIG_VALIDATION_FAILED');
        expect(err.userMessage).toContain('validation failed');
      }
    });
  });

  describe('loadTestSuite', () => {
    it('loads and validates a valid test suite', () => {
      const suitePath = join(tempDir, 'test-example.yaml');
      writeFileSync(suitePath, `
prompt: "Build a REST API"
acceptanceCriteria:
  - "Returns 200 on GET /api/health"
  - "Has JSON body"
execution:
  maxTurns: 10
buildCommand: npm run build
testCommand: npm test
coverageThreshold: 80
`);
      const suite = loadTestSuite(suitePath);
      expect(suite.prompt).toBe('Build a REST API');
      expect(suite.acceptanceCriteria).toHaveLength(2);
      expect(suite.execution?.maxTurns).toBe(10);
      expect(suite.buildCommand).toBe('npm run build');
      expect(suite.coverageThreshold).toBe(80);
    });

    it('throws ConfigError for missing file', () => {
      expect(() => loadTestSuite(join(tempDir, 'nope.yaml'))).toThrow(ConfigError);
      try {
        loadTestSuite(join(tempDir, 'nope.yaml'));
      } catch (e) {
        expect((e as ConfigError).code).toBe('SUITE_NOT_FOUND');
      }
    });

    it('throws ConfigError for validation failure', () => {
      const suitePath = join(tempDir, 'bad-suite.yaml');
      writeFileSync(suitePath, `
prompt: "Build something"
acceptanceCriteria: []
`);
      expect(() => loadTestSuite(suitePath)).toThrow(ConfigError);
      try {
        loadTestSuite(suitePath);
      } catch (e) {
        expect((e as ConfigError).code).toBe('SUITE_VALIDATION_FAILED');
      }
    });
  });

  describe('discoverTestSuites', () => {
    it('discovers all test-*.yaml files in directory', () => {
      const testDir = join(tempDir, 'zelda');
      mkdirSync(testDir);
      writeFileSync(join(testDir, 'test-api.yaml'), `
prompt: "Build an API"
acceptanceCriteria:
  - "Works"
`);
      writeFileSync(join(testDir, 'test-cli.yaml'), `
prompt: "Build a CLI"
acceptanceCriteria:
  - "Works"
`);
      writeFileSync(join(testDir, 'not-a-test.yaml'), `
prompt: "Should be ignored"
acceptanceCriteria:
  - "Ignored"
`);

      const suites = discoverTestSuites(testDir);
      expect(suites).toHaveLength(2);
      expect(suites[0].name).toBe('api');
      expect(suites[1].name).toBe('cli');
      expect(suites[0].config.prompt).toBe('Build an API');
    });

    it('returns empty array for directory with no test suites', () => {
      const testDir = join(tempDir, 'empty');
      mkdirSync(testDir);
      const suites = discoverTestSuites(testDir);
      expect(suites).toHaveLength(0);
    });

    it('throws ConfigError for missing directory', () => {
      expect(() => discoverTestSuites(join(tempDir, 'nonexistent'))).toThrow(ConfigError);
      try {
        discoverTestSuites(join(tempDir, 'nonexistent'));
      } catch (e) {
        expect((e as ConfigError).code).toBe('TEST_DIR_NOT_FOUND');
      }
    });
  });
});
