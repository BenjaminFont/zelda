import { describe, it, expect } from 'vitest';
import type {
  EvalContext,
  EvalResult,
  Evaluator,
  ResolvedConfig,
  SessionTranscript,
  ToolsManifest,
  RunResult,
  MetricToggles,
  ExecutionDefaults,
  ToolCall,
  TranscriptMessage,
  SessionMetadata,
  ToolEntry,
  TestSuiteSnapshot,
} from '../../src/core/types.js';

describe('core/types', () => {
  it('EvalResult can be constructed with required fields', () => {
    const result: EvalResult = {
      metric: 'efficiency',
      score: 85,
      details: { tokens: 1000 },
    };
    expect(result.metric).toBe('efficiency');
    expect(result.score).toBe(85);
    expect(result.details).toEqual({ tokens: 1000 });
    expect(result.reasoning).toBeUndefined();
  });

  it('EvalResult supports optional reasoning', () => {
    const result: EvalResult = {
      metric: 'fulfillment',
      score: 90,
      details: {},
      reasoning: 'All criteria met',
    };
    expect(result.reasoning).toBe('All criteria met');
  });

  it('Evaluator type is a function returning Promise<EvalResult>', async () => {
    const mockEvaluator: Evaluator = async (_context) => ({
      metric: 'test',
      score: 100,
      details: {},
    });

    const context: EvalContext = {
      config: {
        judgeModel: 'claude-sonnet-4-5-20250929',
        gatewayUrl: 'https://api.portkey.ai/v1',
        resultsDir: '.zelda/runs',
        testDir: 'zelda',
        execution: {},
        metrics: {},
        testSuiteName: 'test',
        prompt: 'test prompt',
        acceptanceCriteria: ['criterion 1'],
      },
      transcript: {
        messages: [],
        metadata: {
          costUsd: 0,
          inputTokens: 0,
          outputTokens: 0,
          turnCount: 0,
          durationMs: 0,
          errorCount: 0,
        },
      },
      workspacePath: '/tmp/workspace',
      toolsManifest: {
        skills: [],
        rules: [],
        subAgents: [],
        mcpConfigs: [],
      },
    };

    const result = await mockEvaluator(context);
    expect(result.score).toBe(100);
  });

  it('ResolvedConfig supports optional fields', () => {
    const config: ResolvedConfig = {
      judgeModel: 'claude-sonnet-4-5-20250929',
      gatewayUrl: 'https://api.portkey.ai/v1',
      resultsDir: '.zelda/runs',
      testDir: 'zelda',
      execution: { model: 'claude-sonnet-4-5-20250929', maxTurns: 10 },
      metrics: { efficiency: true, requirementFulfillment: true },
      testSuiteName: 'rest-endpoint',
      prompt: 'Build a REST endpoint',
      acceptanceCriteria: ['Endpoint returns 200'],
      buildCommand: 'npm run build',
      testCommand: 'npm test',
      coverageThreshold: 80,
    };
    expect(config.buildCommand).toBe('npm run build');
    expect(config.coverageThreshold).toBe(80);
  });

  it('SessionTranscript holds messages and metadata', () => {
    const transcript: SessionTranscript = {
      messages: [
        {
          role: 'user',
          content: 'Build a REST endpoint',
        },
        {
          role: 'assistant',
          content: 'I will create the endpoint.',
          toolCalls: [
            { toolName: 'Write', input: { path: 'src/index.ts' }, output: 'ok' },
          ],
        },
      ],
      metadata: {
        costUsd: 0.05,
        inputTokens: 500,
        outputTokens: 1000,
        turnCount: 2,
        durationMs: 30000,
        errorCount: 0,
      },
    };
    expect(transcript.messages).toHaveLength(2);
    expect(transcript.metadata.costUsd).toBe(0.05);
    expect(transcript.messages[1].toolCalls).toHaveLength(1);
  });

  it('ToolsManifest holds tool entries', () => {
    const manifest: ToolsManifest = {
      skills: [{ name: 'api-patterns', path: '.claude/skills/api.md' }],
      rules: [{ name: 'style-guide', path: '.claude/rules/style.md', contentSummary: 'Code style rules' }],
      subAgents: [],
      mcpConfigs: [],
    };
    expect(manifest.skills).toHaveLength(1);
    expect(manifest.rules[0].contentSummary).toBe('Code style rules');
  });

  it('RunResult holds id, timestamp, testSuite snapshot, and metrics', () => {
    const run: RunResult = {
      id: 'rest-endpoint-2026-02-14T10-30-00',
      timestamp: '2026-02-14T10:30:00Z',
      testSuite: {
        name: 'rest-endpoint',
        prompt: 'Build a REST endpoint',
        acceptanceCriteria: ['Returns 200'],
        execution: { model: 'claude-sonnet-4-5-20250929' },
        metrics: { efficiency: true },
      },
      metrics: {
        efficiency: {
          metric: 'efficiency',
          score: 75,
          details: { totalTokens: 1500 },
        },
      },
    };
    expect(run.id).toBe('rest-endpoint-2026-02-14T10-30-00');
    expect(run.metrics['efficiency'].score).toBe(75);
  });
});
