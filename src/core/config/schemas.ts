// Zod schemas for Zelda configuration validation (Zod 4)

import { z } from 'zod';

// ─── Task Size Mapping ──────────────────────────────────────────────────────

export const TASK_SIZE_MAP = {
  small: 10,
  medium: 25,
  large: 50,
  xl: 100,
} as const;

// ─── Shared Sub-Schemas ─────────────────────────────────────────────────────

export const ExecutionDefaultsSchema = z.object({
  model: z.string().optional(),
  maxTurns: z.number().int().positive().optional(),
  taskSize: z.enum(['small', 'medium', 'large', 'xl']).optional(),
});

export const MetricTogglesSchema = z.object({
  efficiency: z.boolean().optional(),
  requirementFulfillment: z.boolean().optional(),
  toolUsage: z.boolean().optional(),
  functionalCorrectness: z.boolean().optional(),
  codeQuality: z.boolean().optional(),
  complexity: z.boolean().optional(),
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
  staticAnalysis: z.array(z.string()).optional(),
  complexityThreshold: z.number().min(0).optional(),
});

export type TestSuiteConfig = z.infer<typeof TestSuiteConfigSchema>;
