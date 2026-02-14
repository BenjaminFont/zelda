// Zod schemas for Zelda configuration validation (Zod 4)

import { z } from 'zod';

// ─── Shared Sub-Schemas ─────────────────────────────────────────────────────

export const ExecutionDefaultsSchema = z.object({
  model: z.string().optional(),
  maxTurns: z.number().int().positive().optional(),
});

export const MetricTogglesSchema = z.object({
  efficiency: z.boolean().optional(),
  requirementFulfillment: z.boolean().optional(),
  toolUsage: z.boolean().optional(),
  functionalCorrectness: z.boolean().optional(),
});

// ─── Project Config Schema ──────────────────────────────────────────────────

export const ProjectConfigSchema = z.object({
  judgeModel: z.string(),
  gatewayUrl: z.url(),
  resultsDir: z.string(),
  testDir: z.string(),
  execution: ExecutionDefaultsSchema.optional(),
  metrics: MetricTogglesSchema.optional(),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

// ─── Test Suite Config Schema ───────────────────────────────────────────────

export const TestSuiteConfigSchema = z.object({
  prompt: z.string(),
  acceptanceCriteria: z.array(z.string()).min(1),
  execution: ExecutionDefaultsSchema.optional(),
  metrics: MetricTogglesSchema.optional(),
  buildCommand: z.string().optional(),
  testCommand: z.string().optional(),
  coverageThreshold: z.number().min(0).max(100).optional(),
});

export type TestSuiteConfig = z.infer<typeof TestSuiteConfigSchema>;
