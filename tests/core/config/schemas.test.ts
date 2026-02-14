import { describe, it, expect } from 'vitest';
import {
  ProjectConfigSchema,
  TestSuiteConfigSchema,
  ExecutionDefaultsSchema,
  MetricTogglesSchema,
} from '../../../src/core/config/schemas.js';

describe('config/schemas', () => {
  describe('ProjectConfigSchema', () => {
    it('validates a complete valid config', () => {
      const config = {
        judgeModel: 'claude-sonnet-4-5-20250929',
        gatewayUrl: 'https://api.portkey.ai/v1',
        resultsDir: '.zelda/runs',
        testDir: 'zelda',
        execution: { model: 'claude-sonnet-4-5-20250929', maxTurns: 25 },
        metrics: { efficiency: true, requirementFulfillment: true },
      };
      const result = ProjectConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('validates minimal required fields', () => {
      const config = {
        judgeModel: 'claude-sonnet-4-5-20250929',
        gatewayUrl: 'https://api.portkey.ai/v1',
        resultsDir: '.zelda/runs',
        testDir: 'zelda',
      };
      const result = ProjectConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('rejects missing required judgeModel', () => {
      const config = {
        gatewayUrl: 'https://api.portkey.ai/v1',
        resultsDir: '.zelda/runs',
        testDir: 'zelda',
      };
      const result = ProjectConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('rejects invalid gatewayUrl', () => {
      const config = {
        judgeModel: 'claude-sonnet-4-5-20250929',
        gatewayUrl: 'not-a-url',
        resultsDir: '.zelda/runs',
        testDir: 'zelda',
      };
      const result = ProjectConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('rejects missing resultsDir', () => {
      const config = {
        judgeModel: 'claude-sonnet-4-5-20250929',
        gatewayUrl: 'https://api.portkey.ai/v1',
        testDir: 'zelda',
      };
      const result = ProjectConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('rejects invalid execution maxTurns (non-integer)', () => {
      const config = {
        judgeModel: 'claude-sonnet-4-5-20250929',
        gatewayUrl: 'https://api.portkey.ai/v1',
        resultsDir: '.zelda/runs',
        testDir: 'zelda',
        execution: { maxTurns: 2.5 },
      };
      const result = ProjectConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('rejects negative maxTurns', () => {
      const config = {
        judgeModel: 'claude-sonnet-4-5-20250929',
        gatewayUrl: 'https://api.portkey.ai/v1',
        resultsDir: '.zelda/runs',
        testDir: 'zelda',
        execution: { maxTurns: -1 },
      };
      const result = ProjectConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('TestSuiteConfigSchema', () => {
    it('validates a complete test suite', () => {
      const suite = {
        prompt: 'Build a REST API',
        acceptanceCriteria: ['Returns 200', 'Has JSON body'],
        execution: { model: 'claude-sonnet-4-5-20250929', maxTurns: 10 },
        metrics: { efficiency: true },
        buildCommand: 'npm run build',
        testCommand: 'npm test',
        coverageThreshold: 80,
      };
      const result = TestSuiteConfigSchema.safeParse(suite);
      expect(result.success).toBe(true);
    });

    it('validates minimal required fields', () => {
      const suite = {
        prompt: 'Build something',
        acceptanceCriteria: ['It works'],
      };
      const result = TestSuiteConfigSchema.safeParse(suite);
      expect(result.success).toBe(true);
    });

    it('rejects empty acceptanceCriteria', () => {
      const suite = {
        prompt: 'Build something',
        acceptanceCriteria: [],
      };
      const result = TestSuiteConfigSchema.safeParse(suite);
      expect(result.success).toBe(false);
    });

    it('rejects missing prompt', () => {
      const suite = {
        acceptanceCriteria: ['It works'],
      };
      const result = TestSuiteConfigSchema.safeParse(suite);
      expect(result.success).toBe(false);
    });

    it('rejects coverageThreshold above 100', () => {
      const suite = {
        prompt: 'Build something',
        acceptanceCriteria: ['It works'],
        coverageThreshold: 150,
      };
      const result = TestSuiteConfigSchema.safeParse(suite);
      expect(result.success).toBe(false);
    });

    it('rejects negative coverageThreshold', () => {
      const suite = {
        prompt: 'Build something',
        acceptanceCriteria: ['It works'],
        coverageThreshold: -10,
      };
      const result = TestSuiteConfigSchema.safeParse(suite);
      expect(result.success).toBe(false);
    });
  });

  describe('ExecutionDefaultsSchema', () => {
    it('validates empty object', () => {
      const result = ExecutionDefaultsSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('validates with all fields', () => {
      const result = ExecutionDefaultsSchema.safeParse({ model: 'test', maxTurns: 5 });
      expect(result.success).toBe(true);
    });
  });

  describe('MetricTogglesSchema', () => {
    it('validates empty object', () => {
      const result = MetricTogglesSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('validates with all toggles', () => {
      const result = MetricTogglesSchema.safeParse({
        efficiency: true,
        requirementFulfillment: false,
        toolUsage: true,
        functionalCorrectness: false,
      });
      expect(result.success).toBe(true);
    });
  });
});
