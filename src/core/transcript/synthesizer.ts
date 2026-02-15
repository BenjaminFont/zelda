// Transcript synthesizer — merges incremental evaluation results from chunks
// Fulfillment: worst-result-wins per criterion
// Tool usage: union of all used/missed tools

import type { FulfillmentDetails, CriterionResult } from '../evaluators/fulfillment.js';
import type { ToolUsageDetails } from '../evaluators/tool-usage.js';

export const synthesizeFulfillment = (
  chunkResults: FulfillmentDetails[],
): FulfillmentDetails => {
  if (chunkResults.length === 0) {
    return { criteria: [], passedCount: 0, totalCount: 0 };
  }

  if (chunkResults.length === 1) {
    return chunkResults[0];
  }

  // Merge criteria across chunks: worst-result-wins per criterion name
  const criteriaMap = new Map<string, CriterionResult>();

  for (const result of chunkResults) {
    for (const criterion of result.criteria) {
      const existing = criteriaMap.get(criterion.criterion);
      if (!existing) {
        criteriaMap.set(criterion.criterion, { ...criterion });
      } else if (existing.passed && !criterion.passed) {
        // Worst result wins: FAIL overrides PASS
        criteriaMap.set(criterion.criterion, { ...criterion });
      }
    }
  }

  const criteria = [...criteriaMap.values()];
  const passedCount = criteria.filter((c) => c.passed).length;

  return {
    criteria,
    passedCount,
    totalCount: criteria.length,
  };
};

export const synthesizeToolUsage = (
  chunkResults: ToolUsageDetails[],
): ToolUsageDetails => {
  if (chunkResults.length === 0) {
    return { usedTools: [], missedTools: [], availableToolCount: 0, assessment: '' };
  }

  if (chunkResults.length === 1) {
    return chunkResults[0];
  }

  // Union of used tools (sum counts for same name)
  const usedMap = new Map<string, number>();
  for (const result of chunkResults) {
    for (const tool of result.usedTools) {
      usedMap.set(tool.name, (usedMap.get(tool.name) ?? 0) + tool.count);
    }
  }
  const usedTools = [...usedMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Union of missed tools (deduplicate by name, keep first reasoning)
  const missedMap = new Map<string, string>();
  for (const result of chunkResults) {
    for (const tool of result.missedTools) {
      if (!missedMap.has(tool.name)) {
        missedMap.set(tool.name, tool.reasoning);
      }
    }
  }
  // Remove from missed if found in used
  for (const name of usedMap.keys()) {
    missedMap.delete(name);
  }
  const missedTools = [...missedMap.entries()]
    .map(([name, reasoning]) => ({ name, reasoning }));

  // Use max available tool count (should be same across chunks)
  const availableToolCount = Math.max(...chunkResults.map((r) => r.availableToolCount));

  // Combine assessments
  const assessment = chunkResults
    .map((r, i) => `[Chunk ${i + 1}] ${r.assessment}`)
    .join(' ');

  return { usedTools, missedTools, availableToolCount, assessment };
};
