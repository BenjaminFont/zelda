import { describe, it, expect } from 'vitest';
import {
  isSourceFile,
  countLoc,
  countAppElements,
  computeWeightedTotal,
  analyzeFile,
  APP_WEIGHTS,
} from '../../../src/core/evaluators/app-parser.js';

describe('evaluators/app-parser', () => {
  describe('isSourceFile', () => {
    it('returns true for TypeScript files', () => {
      expect(isSourceFile('index.ts')).toBe(true);
      expect(isSourceFile('component.tsx')).toBe(true);
    });

    it('returns true for JavaScript files', () => {
      expect(isSourceFile('main.js')).toBe(true);
      expect(isSourceFile('app.jsx')).toBe(true);
      expect(isSourceFile('config.mjs')).toBe(true);
      expect(isSourceFile('utils.cjs')).toBe(true);
    });

    it('returns true for Python files', () => {
      expect(isSourceFile('app.py')).toBe(true);
      expect(isSourceFile('gui.pyw')).toBe(true);
    });

    it('returns true for other language files', () => {
      expect(isSourceFile('main.go')).toBe(true);
      expect(isSourceFile('lib.rs')).toBe(true);
      expect(isSourceFile('App.java')).toBe(true);
      expect(isSourceFile('main.c')).toBe(true);
      expect(isSourceFile('main.cpp')).toBe(true);
      expect(isSourceFile('script.rb')).toBe(true);
      expect(isSourceFile('index.php')).toBe(true);
      expect(isSourceFile('App.swift')).toBe(true);
      expect(isSourceFile('App.vue')).toBe(true);
      expect(isSourceFile('App.svelte')).toBe(true);
    });

    it('returns false for non-source files', () => {
      expect(isSourceFile('config.json')).toBe(false);
      expect(isSourceFile('schema.yaml')).toBe(false);
      expect(isSourceFile('README.md')).toBe(false);
      expect(isSourceFile('logo.png')).toBe(false);
      expect(isSourceFile('package-lock.lock')).toBe(false);
    });

    it('returns false for files with no extension', () => {
      expect(isSourceFile('Makefile')).toBe(false);
      expect(isSourceFile('Dockerfile')).toBe(false);
    });

    it('handles uppercase extensions via lowercase normalization', () => {
      expect(isSourceFile('Main.TS')).toBe(true);
      expect(isSourceFile('App.JSX')).toBe(true);
    });
  });

  describe('countLoc', () => {
    it('returns 0 for empty content', () => {
      expect(countLoc('')).toBe(0);
    });

    it('returns 0 for blank lines only', () => {
      expect(countLoc('\n\n  \n\t\n')).toBe(0);
    });

    it('counts code lines excluding line comments', () => {
      const content = [
        '// This is a comment',
        'const x = 1;',
        '// Another comment',
        'const y = 2;',
        '',
      ].join('\n');
      expect(countLoc(content)).toBe(2);
    });

    it('excludes Python hash comments', () => {
      const content = [
        '# comment',
        'x = 1',
        '# another comment',
        'y = 2',
      ].join('\n');
      expect(countLoc(content)).toBe(2);
    });

    it('excludes Lua/SQL -- comments', () => {
      const content = [
        '-- comment',
        'local x = 1',
        '-- another',
        'local y = 2',
      ].join('\n');
      expect(countLoc(content)).toBe(2);
    });

    it('excludes single-line block comments /* ... */', () => {
      const content = [
        '/* single line comment */',
        'const x = 1;',
      ].join('\n');
      expect(countLoc(content)).toBe(1);
    });

    it('excludes multi-line block comments', () => {
      const content = [
        '/*',
        ' * Multi-line comment',
        ' * with more text',
        ' */',
        'const x = 1;',
      ].join('\n');
      expect(countLoc(content)).toBe(1);
    });

    it('excludes *-prefixed lines (JSDoc continuation)', () => {
      const content = [
        '/**',
        ' * A function',
        ' * @param x the input',
        ' */',
        'function foo(x) { return x; }',
      ].join('\n');
      expect(countLoc(content)).toBe(1);
    });

    it('counts mixed code and comments correctly', () => {
      const content = [
        '// header comment',
        'import { foo } from "./foo";',
        '',
        '/*',
        ' * Block comment',
        ' */',
        'const bar = foo();',
        '# not JS but still a comment line',
        'bar.run();',
      ].join('\n');
      expect(countLoc(content)).toBe(3);
    });
  });

  describe('countAppElements', () => {
    describe('constants', () => {
      it('counts string literals', () => {
        const content = 'const x = "hello"; const y = \'world\';';
        const counts = countAppElements(content);
        expect(counts.constants).toBeGreaterThanOrEqual(2);
      });

      it('counts template literals', () => {
        const content = 'const x = `hello ${name}`;';
        const counts = countAppElements(content);
        expect(counts.constants).toBeGreaterThanOrEqual(1);
      });

      it('counts numeric literals', () => {
        const content = 'const x = 42; const y = 3.14;';
        const counts = countAppElements(content);
        expect(counts.constants).toBeGreaterThanOrEqual(2);
      });

      it('counts boolean and null keywords', () => {
        const content = 'const a = true; const b = false; const c = null;';
        const counts = countAppElements(content);
        // 3 booleans/null + 3 assignments
        expect(counts.constants).toBeGreaterThanOrEqual(3);
      });
    });

    describe('calls', () => {
      it('counts function calls', () => {
        const content = 'foo(); bar(1); baz("x");';
        const counts = countAppElements(content);
        expect(counts.calls).toBe(3);
      });

      it('counts method calls', () => {
        const content = 'obj.method(); arr.push(1);';
        const counts = countAppElements(content);
        expect(counts.calls).toBeGreaterThanOrEqual(2);
      });

      it('excludes keyword matches from calls', () => {
        const content = 'if (x) { for (i) { while (true) { switch (y) { return (z); } } } }';
        const counts = countAppElements(content);
        expect(counts.calls).toBe(0);
      });
    });

    describe('conditions', () => {
      it('counts if/elif/switch/case', () => {
        const content = 'if (a) {} else if (b) {} switch (c) { case 1: break; }';
        const counts = countAppElements(content);
        // if, else if, switch, case
        expect(counts.conditions).toBe(4);
      });

      it('counts ternary operator', () => {
        const content = 'const x = a ? b : c;';
        const counts = countAppElements(content);
        expect(counts.conditions).toBeGreaterThanOrEqual(1);
      });

      it('excludes ?? (nullish coalescing) from ternary count', () => {
        const content = 'const x = a ?? b;';
        const counts = countAppElements(content);
        // ?? should not be counted as ternary
        expect(counts.conditions).toBe(0);
      });

      it('excludes ?. (optional chaining) from ternary count', () => {
        const content = 'const x = a?.b?.c;';
        const counts = countAppElements(content);
        expect(counts.conditions).toBe(0);
      });
    });

    describe('loops', () => {
      it('counts for/while/do keywords', () => {
        const content = 'for (;;) {} while (true) {} do {} while (false);';
        const counts = countAppElements(content);
        // for, while, do, while (the second while in do...while)
        expect(counts.loops).toBeGreaterThanOrEqual(3);
      });

      it('counts iterator methods', () => {
        const content = 'arr.map(fn); arr.forEach(fn); arr.reduce(fn, 0); arr.filter(fn);';
        const counts = countAppElements(content);
        expect(counts.loops).toBe(4);
      });

      it('counts .find, .some, .every, .flatMap', () => {
        const content = 'arr.find(fn); arr.some(fn); arr.every(fn); arr.flatMap(fn);';
        const counts = countAppElements(content);
        expect(counts.loops).toBe(4);
      });
    });

    describe('assignments', () => {
      it('counts simple = assignments', () => {
        const content = 'x = 1; y = 2;';
        const counts = countAppElements(content);
        expect(counts.assignments).toBe(2);
      });

      it('does not count == or === as assignments', () => {
        const content = 'if (x == 1 || y === 2) {}';
        const counts = countAppElements(content);
        expect(counts.assignments).toBe(0);
      });

      it('does not count != or !== as assignments', () => {
        const content = 'if (x != 1 && y !== 2) {}';
        const counts = countAppElements(content);
        expect(counts.assignments).toBe(0);
      });

      it('does not count <= or >= as assignments', () => {
        const content = 'if (x <= 10 && y >= 5) {}';
        const counts = countAppElements(content);
        expect(counts.assignments).toBe(0);
      });

      it('does not count => (arrow) as assignment', () => {
        const content = 'const fn = (x) => x + 1;';
        const counts = countAppElements(content);
        // Only the `=` in `const fn =` should count
        expect(counts.assignments).toBe(1);
      });

      it('counts compound operators', () => {
        const content = 'x += 1; y -= 2; z *= 3; w /= 4;';
        const counts = countAppElements(content);
        expect(counts.assignments).toBeGreaterThanOrEqual(4);
      });
    });
  });

  describe('computeWeightedTotal', () => {
    it('applies weight table correctly', () => {
      const counts = {
        constants: 10,
        calls: 5,
        conditions: 3,
        loops: 2,
        assignments: 4,
      };
      const expected =
        10 * APP_WEIGHTS.constants +
        5 * APP_WEIGHTS.calls +
        3 * APP_WEIGHTS.conditions +
        2 * APP_WEIGHTS.loops +
        4 * APP_WEIGHTS.assignments;
      expect(computeWeightedTotal(counts)).toBe(expected);
    });

    it('returns 0 for zero counts', () => {
      expect(
        computeWeightedTotal({
          constants: 0,
          calls: 0,
          conditions: 0,
          loops: 0,
          assignments: 0,
        }),
      ).toBe(0);
    });
  });

  describe('analyzeFile', () => {
    it('computes density as weightedTotal / loc', () => {
      const content = [
        'const x = 1;',
        'const y = 2;',
        'const z = x + y;',
      ].join('\n');
      const result = analyzeFile('test.ts', content);
      expect(result.filePath).toBe('test.ts');
      expect(result.loc).toBe(3);
      expect(result.weightedTotal).toBeGreaterThan(0);
      expect(result.density).toBeCloseTo(result.weightedTotal / result.loc, 5);
    });

    it('returns density 0 when loc is 0', () => {
      const content = '// only comments\n// nothing else\n';
      const result = analyzeFile('empty.ts', content);
      expect(result.loc).toBe(0);
      expect(result.density).toBe(0);
    });

    it('includes all element counts', () => {
      const content = 'if (x) { foo(); }';
      const result = analyzeFile('cond.ts', content);
      expect(result.elementCounts).toBeDefined();
      expect(result.elementCounts.conditions).toBeGreaterThanOrEqual(1);
      expect(result.elementCounts.calls).toBeGreaterThanOrEqual(1);
    });
  });
});
