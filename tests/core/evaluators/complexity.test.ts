import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EvalContext } from '../../../src/core/types.js';

// Mock node:child_process and node:fs
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  existsSync: vi.fn(),
}));

const makeContext = (overrides?: Partial<EvalContext>): EvalContext => ({
  config: {
    judgeModel: 'claude-sonnet-4-5-20250929',
    gatewayUrl: 'https://api.portkey.ai/v1',
    resultsDir: '.zelda/runs',
    testDir: 'zelda',
    execution: {},
    metrics: { complexity: true },
    testSuiteName: 'test-api',
    prompt: 'Build an API',
    acceptanceCriteria: ['Works correctly'],
  },
  transcript: {
    messages: [{ role: 'assistant', content: 'Done.' }],
    metadata: {
      costUsd: 0.05,
      inputTokens: 500,
      outputTokens: 1000,
      turnCount: 3,
      durationMs: 15000,
      errorCount: 0,
    },
  },
  workspacePath: '/tmp/workspace',
  toolsManifest: { skills: [], rules: [], subAgents: [], mcpConfigs: [] },
  ...overrides,
});

describe('evaluators/complexity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('computeComplexityScore', () => {
    it('returns 100 when avgDensity is 0', async () => {
      const { computeComplexityScore } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      expect(computeComplexityScore(0, 20)).toBe(100);
    });

    it('returns 50 when avgDensity is half of threshold', async () => {
      const { computeComplexityScore } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      expect(computeComplexityScore(10, 20)).toBe(50);
    });

    it('returns 0 when avgDensity equals threshold', async () => {
      const { computeComplexityScore } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      expect(computeComplexityScore(20, 20)).toBe(0);
    });

    it('clamps to 0 when avgDensity exceeds threshold', async () => {
      const { computeComplexityScore } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      expect(computeComplexityScore(30, 20)).toBe(0);
    });
  });

  describe('detectTouchedFiles (git mode)', () => {
    it('returns source files from git diff and ls-files', async () => {
      const { execSync } = await import('node:child_process');
      (execSync as any)
        .mockReturnValueOnce('src/main.ts\nsrc/utils.ts\n')
        .mockReturnValueOnce('src/new-file.js\n');

      const { detectTouchedFiles } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const result = detectTouchedFiles('/workspace');
      expect(result).toContain('src/main.ts');
      expect(result).toContain('src/utils.ts');
      expect(result).toContain('src/new-file.js');
    });

    it('filters out non-source files', async () => {
      const { execSync } = await import('node:child_process');
      (execSync as any)
        .mockReturnValueOnce('src/main.ts\nREADME.md\npackage.json\n')
        .mockReturnValueOnce('');

      const { detectTouchedFiles } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const result = detectTouchedFiles('/workspace');
      expect(result).toEqual(['src/main.ts']);
    });

    it('returns empty array when git fails', async () => {
      const { execSync } = await import('node:child_process');
      (execSync as any).mockImplementation(() => {
        throw new Error('not a git repo');
      });

      const { detectTouchedFiles } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const result = detectTouchedFiles('/workspace');
      expect(result).toEqual([]);
    });

    it('excludes files in coverage directories', async () => {
      const { execSync } = await import('node:child_process');
      (execSync as any)
        .mockReturnValueOnce('src/main.ts\ncoverage/lcov-report/prettify.js\ncoverage/lcov-report/sorter.js\n')
        .mockReturnValueOnce('');

      const { detectTouchedFiles } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const result = detectTouchedFiles('/workspace');
      expect(result).toEqual(['src/main.ts']);
    });

    it('excludes files in build, .next, and vendor directories', async () => {
      const { execSync } = await import('node:child_process');
      (execSync as any)
        .mockReturnValueOnce('src/app.tsx\nbuild/static/js/main.js\n.next/server/page.js\nvendor/lib/utils.go\n')
        .mockReturnValueOnce('');

      const { detectTouchedFiles } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const result = detectTouchedFiles('/workspace');
      expect(result).toEqual(['src/app.tsx']);
    });

    it('excludes files in nested excluded directories', async () => {
      const { execSync } = await import('node:child_process');
      (execSync as any)
        .mockReturnValueOnce('src/main.ts\nnode_modules/lodash/index.js\ndist/bundle.js\n')
        .mockReturnValueOnce('');

      const { detectTouchedFiles } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const result = detectTouchedFiles('/workspace');
      expect(result).toEqual(['src/main.ts']);
    });

    it('deduplicates files appearing in both diff and ls-files', async () => {
      const { execSync } = await import('node:child_process');
      (execSync as any)
        .mockReturnValueOnce('src/main.ts\n')
        .mockReturnValueOnce('src/main.ts\n');

      const { detectTouchedFiles } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const result = detectTouchedFiles('/workspace');
      expect(result).toEqual(['src/main.ts']);
    });
  });

  describe('detectTouchedFiles (snapshot mode)', () => {
    it('detects new files not in snapshot', async () => {
      const { readdirSync, statSync } = await import('node:fs');
      const { readFileSync } = await import('node:fs');
      // Walk returns src/new.ts
      (readdirSync as any).mockReturnValue(['new.ts']);
      (statSync as any).mockReturnValue({ isDirectory: () => false });
      (readFileSync as any).mockReturnValue('const x = 1;');

      const { detectTouchedFiles } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const result = detectTouchedFiles('/workspace', {});
      expect(result).toContain('new.ts');
    });

    it('detects modified files', async () => {
      const { readdirSync, statSync, readFileSync } = await import('node:fs');
      (readdirSync as any).mockReturnValue(['main.ts']);
      (statSync as any).mockReturnValue({ isDirectory: () => false });
      (readFileSync as any).mockReturnValue('const x = 2;'); // changed content

      const { detectTouchedFiles } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const snapshot = { 'main.ts': 'const x = 1;' };
      const result = detectTouchedFiles('/workspace', snapshot);
      expect(result).toContain('main.ts');
    });

    it('excludes unchanged files', async () => {
      const { readdirSync, statSync, readFileSync } = await import('node:fs');
      (readdirSync as any).mockReturnValue(['main.ts']);
      (statSync as any).mockReturnValue({ isDirectory: () => false });
      (readFileSync as any).mockReturnValue('const x = 1;');

      const { detectTouchedFiles } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const snapshot = { 'main.ts': 'const x = 1;' };
      const result = detectTouchedFiles('/workspace', snapshot);
      expect(result).toEqual([]);
    });
  });

  describe('getPreContent', () => {
    it('returns content from git show in git mode', async () => {
      const { execSync } = await import('node:child_process');
      (execSync as any).mockReturnValue('const original = 1;');

      const { getPreContent } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const result = getPreContent('/workspace', 'src/main.ts');
      expect(result).toBe('const original = 1;');
    });

    it('returns undefined when git show fails (new file)', async () => {
      const { execSync } = await import('node:child_process');
      (execSync as any).mockImplementation(() => {
        throw new Error('path not found');
      });

      const { getPreContent } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const result = getPreContent('/workspace', 'src/new.ts');
      expect(result).toBeUndefined();
    });

    it('returns content from snapshot when provided', async () => {
      const { getPreContent } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const snapshot = { 'src/main.ts': 'const x = 1;' };
      const result = getPreContent('/workspace', 'src/main.ts', snapshot);
      expect(result).toBe('const x = 1;');
    });

    it('returns undefined when file not in snapshot', async () => {
      const { getPreContent } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const result = getPreContent('/workspace', 'src/new.ts', {});
      expect(result).toBeUndefined();
    });
  });

  describe('capturePreSnapshot', () => {
    it('captures source files and skips excluded dirs', async () => {
      const { readdirSync, statSync, readFileSync } = await import('node:fs');

      // Root has: src dir, node_modules dir, README.md
      (readdirSync as any).mockImplementation((path: string) => {
        if (path === '/workspace') return ['src', 'node_modules', 'README.md'];
        if (path === '/workspace/src') return ['main.ts', 'data.json'];
        return [];
      });
      (statSync as any).mockImplementation((path: string) => ({
        isDirectory: () =>
          path === '/workspace/src' || path === '/workspace/node_modules',
      }));
      (readFileSync as any).mockReturnValue('file content');

      const { capturePreSnapshot } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const snapshot = capturePreSnapshot('/workspace');
      expect(snapshot['src/main.ts']).toBe('file content');
      // data.json is not a source file
      expect(snapshot['src/data.json']).toBeUndefined();
      // node_modules should be skipped entirely
      expect(Object.keys(snapshot)).toHaveLength(1);
    });
  });

  describe('complexityEvaluator', () => {
    it('returns metric "complexity"', async () => {
      const { execSync } = await import('node:child_process');
      (execSync as any).mockReturnValue('');

      const { complexityEvaluator } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const result = await complexityEvaluator(makeContext());
      expect(result.metric).toBe('complexity');
    });

    it('returns score 100 with "No source files modified" when no files touched', async () => {
      const { execSync } = await import('node:child_process');
      // git diff returns empty, ls-files returns empty
      (execSync as any).mockReturnValue('');

      const { complexityEvaluator } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const result = await complexityEvaluator(makeContext());
      expect(result.score).toBe(100);
      expect(result.reasoning).toContain('No source files modified');
      const details = result.details as any;
      expect(details.files).toEqual([]);
    });

    it('marks new files as isNew with no delta', async () => {
      const { execSync } = await import('node:child_process');
      const { readFileSync } = await import('node:fs');

      // git diff returns new.ts, ls-files returns nothing
      (execSync as any).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --name-only HEAD') return 'src/new.ts\n';
        if (cmd.startsWith('git ls-files')) return '';
        if (cmd.startsWith('git show')) throw new Error('not found');
        return '';
      });
      (readFileSync as any).mockReturnValue('const x = 1;\nconst y = 2;\n');

      const { complexityEvaluator } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const result = await complexityEvaluator(makeContext());
      const details = result.details as any;
      expect(details.files).toHaveLength(1);
      expect(details.files[0].isNew).toBe(true);
      expect(details.files[0].delta).toBeUndefined();
      expect(details.files[0].density).toBeGreaterThan(0);
    });

    it('computes delta for modified files', async () => {
      const { execSync } = await import('node:child_process');
      const { readFileSync } = await import('node:fs');

      // Simple pre-content and more complex post-content
      (execSync as any).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --name-only HEAD') return 'main.ts\n';
        if (cmd.startsWith('git ls-files')) return '';
        if (cmd.startsWith('git show')) return 'const x = 1;\n';
        return '';
      });
      // Post-content: more complex
      (readFileSync as any).mockReturnValue(
        'const x = 1;\nif (x) { foo(); bar(); }\nfor (const i of arr) { baz(i); }\n',
      );

      const { complexityEvaluator } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const result = await complexityEvaluator(makeContext());
      const details = result.details as any;
      expect(details.files).toHaveLength(1);
      expect(details.files[0].isNew).toBe(false);
      expect(details.files[0].delta).toBeDefined();
      expect(typeof details.files[0].delta).toBe('number');
    });

    it('computes correct average density for multiple files', async () => {
      const { execSync } = await import('node:child_process');
      const { readFileSync } = await import('node:fs');

      (execSync as any).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --name-only HEAD') return 'a.ts\nb.ts\n';
        if (cmd.startsWith('git ls-files')) return '';
        if (cmd.startsWith('git show')) throw new Error('new file');
        return '';
      });
      (readFileSync as any).mockReturnValue('const x = 1;\nconst y = 2;\n');

      const { complexityEvaluator } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const result = await complexityEvaluator(makeContext());
      const details = result.details as any;
      expect(details.files).toHaveLength(2);
      // Both files have same content, so average = individual density
      expect(details.averageDensity).toBeCloseTo(details.files[0].density, 5);
    });

    it('uses default threshold of 20 when not configured', async () => {
      const { execSync } = await import('node:child_process');
      (execSync as any).mockReturnValue('');

      const { complexityEvaluator } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const ctx = makeContext();
      const result = await complexityEvaluator(ctx);
      const details = result.details as any;
      expect(details.threshold).toBe(20);
    });

    it('uses configured complexityThreshold', async () => {
      const { execSync } = await import('node:child_process');
      (execSync as any).mockReturnValue('');

      const { complexityEvaluator } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const ctx = makeContext({
        config: { ...makeContext().config, complexityThreshold: 30 },
      });
      const result = await complexityEvaluator(ctx);
      const details = result.details as any;
      expect(details.threshold).toBe(30);
    });

    it('score matches computeComplexityScore formula', async () => {
      const { execSync } = await import('node:child_process');
      const { readFileSync } = await import('node:fs');

      (execSync as any).mockImplementation((cmd: string) => {
        if (cmd === 'git diff --name-only HEAD') return 'test.ts\n';
        if (cmd.startsWith('git ls-files')) return '';
        if (cmd.startsWith('git show')) throw new Error('new file');
        return '';
      });
      (readFileSync as any).mockReturnValue('const x = 1;\nconst y = 2;\n');

      const { complexityEvaluator, computeComplexityScore } = await import(
        '../../../src/core/evaluators/complexity.js'
      );
      const result = await complexityEvaluator(makeContext());
      const details = result.details as any;
      const expectedScore = computeComplexityScore(
        details.averageDensity,
        details.threshold,
      );
      expect(result.score).toBe(expectedScore);
    });
  });
});
