import { describe, it, expect } from 'vitest';
import {
  synthesizeFulfillment,
  synthesizeToolUsage,
} from '../../../src/core/transcript/synthesizer.js';
import type { FulfillmentDetails } from '../../../src/core/evaluators/fulfillment.js';
import type { ToolUsageDetails } from '../../../src/core/evaluators/tool-usage.js';

describe('transcript/synthesizer', () => {
  describe('synthesizeFulfillment', () => {
    it('returns empty result for no chunks', () => {
      const result = synthesizeFulfillment([]);
      expect(result.criteria).toHaveLength(0);
      expect(result.passedCount).toBe(0);
    });

    it('passes through single chunk unchanged', () => {
      const details: FulfillmentDetails = {
        criteria: [
          { criterion: 'Works', passed: true, reasoning: 'OK' },
        ],
        passedCount: 1,
        totalCount: 1,
      };
      const result = synthesizeFulfillment([details]);
      expect(result).toBe(details);
    });

    it('uses worst-result-wins for same criterion across chunks', () => {
      const chunk1: FulfillmentDetails = {
        criteria: [
          { criterion: 'Works', passed: true, reasoning: 'Looks good in chunk 1' },
        ],
        passedCount: 1,
        totalCount: 1,
      };
      const chunk2: FulfillmentDetails = {
        criteria: [
          { criterion: 'Works', passed: false, reasoning: 'Failed in chunk 2' },
        ],
        passedCount: 0,
        totalCount: 1,
      };

      const result = synthesizeFulfillment([chunk1, chunk2]);
      expect(result.criteria).toHaveLength(1);
      expect(result.criteria[0].passed).toBe(false);
      expect(result.criteria[0].reasoning).toBe('Failed in chunk 2');
    });

    it('keeps PASS if all chunks agree', () => {
      const chunk1: FulfillmentDetails = {
        criteria: [{ criterion: 'Works', passed: true, reasoning: 'OK 1' }],
        passedCount: 1,
        totalCount: 1,
      };
      const chunk2: FulfillmentDetails = {
        criteria: [{ criterion: 'Works', passed: true, reasoning: 'OK 2' }],
        passedCount: 1,
        totalCount: 1,
      };

      const result = synthesizeFulfillment([chunk1, chunk2]);
      expect(result.criteria[0].passed).toBe(true);
    });

    it('recomputes passedCount after merge', () => {
      const chunk1: FulfillmentDetails = {
        criteria: [
          { criterion: 'A', passed: true, reasoning: 'OK' },
          { criterion: 'B', passed: true, reasoning: 'OK' },
        ],
        passedCount: 2,
        totalCount: 2,
      };
      const chunk2: FulfillmentDetails = {
        criteria: [
          { criterion: 'A', passed: false, reasoning: 'Failed' },
          { criterion: 'B', passed: true, reasoning: 'OK' },
        ],
        passedCount: 1,
        totalCount: 2,
      };

      const result = synthesizeFulfillment([chunk1, chunk2]);
      expect(result.passedCount).toBe(1); // Only B passed
      expect(result.totalCount).toBe(2);
    });
  });

  describe('synthesizeToolUsage', () => {
    it('returns empty result for no chunks', () => {
      const result = synthesizeToolUsage([]);
      expect(result.usedTools).toHaveLength(0);
      expect(result.missedTools).toHaveLength(0);
    });

    it('passes through single chunk unchanged', () => {
      const details: ToolUsageDetails = {
        usedTools: [{ name: 'deploy', count: 1 }],
        missedTools: [],
        availableToolCount: 1,
        assessment: 'Good.',
      };
      const result = synthesizeToolUsage([details]);
      expect(result).toBe(details);
    });

    it('sums usage counts for same tool across chunks', () => {
      const chunk1: ToolUsageDetails = {
        usedTools: [{ name: 'deploy', count: 2 }],
        missedTools: [],
        availableToolCount: 2,
        assessment: 'OK.',
      };
      const chunk2: ToolUsageDetails = {
        usedTools: [{ name: 'deploy', count: 3 }],
        missedTools: [],
        availableToolCount: 2,
        assessment: 'OK.',
      };

      const result = synthesizeToolUsage([chunk1, chunk2]);
      expect(result.usedTools).toHaveLength(1);
      expect(result.usedTools[0].name).toBe('deploy');
      expect(result.usedTools[0].count).toBe(5);
    });

    it('removes tool from missed if found in used', () => {
      const chunk1: ToolUsageDetails = {
        usedTools: [],
        missedTools: [{ name: 'test', reasoning: 'Should have tested' }],
        availableToolCount: 2,
        assessment: 'Missing.',
      };
      const chunk2: ToolUsageDetails = {
        usedTools: [{ name: 'test', count: 1 }],
        missedTools: [],
        availableToolCount: 2,
        assessment: 'Found.',
      };

      const result = synthesizeToolUsage([chunk1, chunk2]);
      expect(result.usedTools.find(t => t.name === 'test')).toBeDefined();
      expect(result.missedTools.find(t => t.name === 'test')).toBeUndefined();
    });

    it('deduplicates missed tools keeping first reasoning', () => {
      const chunk1: ToolUsageDetails = {
        usedTools: [],
        missedTools: [{ name: 'lint', reasoning: 'First reason' }],
        availableToolCount: 1,
        assessment: 'A.',
      };
      const chunk2: ToolUsageDetails = {
        usedTools: [],
        missedTools: [{ name: 'lint', reasoning: 'Second reason' }],
        availableToolCount: 1,
        assessment: 'B.',
      };

      const result = synthesizeToolUsage([chunk1, chunk2]);
      expect(result.missedTools).toHaveLength(1);
      expect(result.missedTools[0].reasoning).toBe('First reason');
    });

    it('uses max available tool count', () => {
      const chunk1: ToolUsageDetails = {
        usedTools: [],
        missedTools: [],
        availableToolCount: 3,
        assessment: 'A.',
      };
      const chunk2: ToolUsageDetails = {
        usedTools: [],
        missedTools: [],
        availableToolCount: 3,
        assessment: 'B.',
      };

      const result = synthesizeToolUsage([chunk1, chunk2]);
      expect(result.availableToolCount).toBe(3);
    });

    it('combines assessments with chunk labels', () => {
      const chunk1: ToolUsageDetails = {
        usedTools: [],
        missedTools: [],
        availableToolCount: 1,
        assessment: 'Good start.',
      };
      const chunk2: ToolUsageDetails = {
        usedTools: [],
        missedTools: [],
        availableToolCount: 1,
        assessment: 'Strong finish.',
      };

      const result = synthesizeToolUsage([chunk1, chunk2]);
      expect(result.assessment).toContain('Chunk 1');
      expect(result.assessment).toContain('Chunk 2');
      expect(result.assessment).toContain('Good start.');
      expect(result.assessment).toContain('Strong finish.');
    });
  });
});
