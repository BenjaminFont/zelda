// Efficiency evaluator — computes token, cost, turn, and tool usage metrics
// Pure computation from SessionTranscript metadata — no external I/O

import type { Evaluator, EvalContext, EvalResult } from '../types.js';

export type EfficiencyDetails = {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  turnCount: number;
  durationMs: number;
  toolCallCounts: Record<string, number>;
  errorCount: number;
};

const countToolCalls = (
  context: EvalContext,
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const message of context.transcript.messages) {
    if (message.toolCalls) {
      for (const call of message.toolCalls) {
        counts[call.toolName] = (counts[call.toolName] ?? 0) + 1;
      }
    }
  }
  return counts;
};

const computeScore = (details: EfficiencyDetails): number => {
  // Score based on efficiency heuristics:
  // - Lower tokens per turn = more efficient
  // - Fewer errors = better
  // - Reasonable cost = better
  // Baseline: 100 tokens/turn is efficient, 1000+ is inefficient
  const tokensPerTurn = details.turnCount > 0
    ? details.totalTokens / details.turnCount
    : details.totalTokens;

  let score = 100;

  // Deduct for high token usage per turn
  if (tokensPerTurn > 500) {
    score -= Math.min(30, Math.floor((tokensPerTurn - 500) / 50));
  }

  // Deduct for errors
  score -= details.errorCount * 10;

  // Deduct for excessive turns (more than 20)
  if (details.turnCount > 20) {
    score -= Math.min(20, (details.turnCount - 20) * 2);
  }

  return Math.max(0, Math.min(100, score));
};

export const efficiencyEvaluator: Evaluator = async (
  context: EvalContext,
): Promise<EvalResult> => {
  const { metadata } = context.transcript;
  const toolCallCounts = countToolCalls(context);

  const details: EfficiencyDetails = {
    totalTokens: metadata.inputTokens + metadata.outputTokens,
    inputTokens: metadata.inputTokens,
    outputTokens: metadata.outputTokens,
    costUsd: metadata.costUsd,
    turnCount: metadata.turnCount,
    durationMs: metadata.durationMs,
    toolCallCounts,
    errorCount: metadata.errorCount,
  };

  return {
    metric: 'efficiency',
    score: computeScore(details),
    details,
    reasoning: `Session used ${details.totalTokens} tokens across ${details.turnCount} turns (${Object.values(toolCallCounts).reduce((a, b) => a + b, 0)} tool calls). Cost: $${details.costUsd.toFixed(4)}.`,
  };
};
