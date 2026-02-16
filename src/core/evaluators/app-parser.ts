// APP (Approximate Program Pattern) parser — language-agnostic code element counting
// Pure computation module — no I/O, no dependencies beyond node:path

import { extname } from 'node:path';

// ─── Constants ──────────────────────────────────────────────────────────────

export const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.pyw',
  '.go', '.rs', '.java', '.kt', '.cs',
  '.rb', '.php', '.swift',
  '.c', '.cpp', '.cc', '.h', '.hpp',
  '.scala', '.lua',
  '.sh', '.bash', '.pl', '.pm',
  '.r', '.dart',
  '.ex', '.exs',
  '.vue', '.svelte',
]);

export const APP_WEIGHTS = {
  constants: 1,
  calls: 2,
  conditions: 4,
  loops: 5,
  assignments: 6,
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export type AppElementCounts = {
  constants: number;
  calls: number;
  conditions: number;
  loops: number;
  assignments: number;
};

export type AppFileAnalysis = {
  filePath: string;
  elementCounts: AppElementCounts;
  weightedTotal: number;
  loc: number;
  density: number;
};

// ─── Functions ──────────────────────────────────────────────────────────────

export const isSourceFile = (filePath: string): boolean => {
  const ext = extname(filePath).toLowerCase();
  return SOURCE_EXTENSIONS.has(ext);
};

export const countLoc = (content: string): number => {
  const lines = content.split('\n');
  let count = 0;
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Handle block comment boundaries
    if (inBlockComment) {
      if (trimmed.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }

    // Skip blank lines
    if (trimmed === '') continue;

    // Skip single-line block comments: /* ... */
    if (trimmed.startsWith('/*') && trimmed.includes('*/')) continue;

    // Enter block comment
    if (trimmed.startsWith('/*')) {
      inBlockComment = true;
      continue;
    }

    // Skip *-prefixed lines (mid-block-comment continuation)
    if (trimmed.startsWith('*')) continue;

    // Skip line comments
    if (trimmed.startsWith('//')) continue;
    if (trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('--')) continue;

    count++;
  }

  return count;
};

const KEYWORD_SET = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'return',
  'throw', 'catch', 'typeof', 'instanceof', 'new', 'delete', 'void',
  'await', 'yield', 'import', 'export', 'class', 'function', 'super',
  'this', 'try', 'finally', 'with', 'default', 'break', 'continue',
  'elif', 'match', 'in', 'of', 'from', 'as', 'let', 'const', 'var',
]);

export const countAppElements = (content: string): AppElementCounts => {
  // ── Constants ──────────────────────────────────────────────────────
  let constants = 0;

  // String literals (double-quoted, single-quoted, template)
  const withoutStrings = content.replace(
    /`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/gs,
    (match) => {
      constants++;
      return ' '.repeat(match.length);
    },
  );

  // Numeric literals
  const numericMatches = withoutStrings.match(/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g);
  if (numericMatches) constants += numericMatches.length;

  // Boolean/null keywords
  const boolNullMatches = withoutStrings.match(/\b(?:true|false|null|None|nil|True|False)\b/g);
  if (boolNullMatches) constants += boolNullMatches.length;

  // ── Calls ──────────────────────────────────────────────────────────
  let calls = 0;
  const callRegex = /\b([a-zA-Z_$][\w$]*)\s*\(/g;
  let callMatch;
  while ((callMatch = callRegex.exec(withoutStrings)) !== null) {
    if (!KEYWORD_SET.has(callMatch[1])) {
      calls++;
    }
  }

  // ── Conditions ─────────────────────────────────────────────────────
  let conditions = 0;
  const conditionKeywords = withoutStrings.match(
    /\b(?:if|else\s+if|elif|switch|case|match)\b/g,
  );
  if (conditionKeywords) conditions += conditionKeywords.length;

  // Ternary ? (exclude ?. and ??)
  const ternaryRegex = /(?<!\?)\?(?!\?|\.)/g;
  const ternaryMatches = withoutStrings.match(ternaryRegex);
  if (ternaryMatches) conditions += ternaryMatches.length;

  // ── Loops ──────────────────────────────────────────────────────────
  let loops = 0;
  const loopKeywords = withoutStrings.match(/\b(?:for|while|do)\b/g);
  if (loopKeywords) loops += loopKeywords.length;

  // Iterator methods
  const iteratorMethods = withoutStrings.match(
    /\.(?:map|forEach|reduce|filter|find|findIndex|some|every|flatMap)\s*\(/g,
  );
  if (iteratorMethods) loops += iteratorMethods.length;

  // ── Assignments ────────────────────────────────────────────────────
  let assignments = 0;

  // Simple = (not ==, ===, !=, !==, <=, >=, =>)
  const assignRegex = /(?<![=!<>])=(?![=>])/g;
  const assignMatches = withoutStrings.match(assignRegex);
  if (assignMatches) assignments += assignMatches.length;

  // Compound operators
  const compoundMatches = withoutStrings.match(/(?:\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<=|>>=|>>>=)/g);
  if (compoundMatches) assignments += compoundMatches.length;

  return { constants, calls, conditions, loops, assignments };
};

export const computeWeightedTotal = (counts: AppElementCounts): number => {
  return (
    counts.constants * APP_WEIGHTS.constants +
    counts.calls * APP_WEIGHTS.calls +
    counts.conditions * APP_WEIGHTS.conditions +
    counts.loops * APP_WEIGHTS.loops +
    counts.assignments * APP_WEIGHTS.assignments
  );
};

export const analyzeFile = (filePath: string, content: string): AppFileAnalysis => {
  const elementCounts = countAppElements(content);
  const weightedTotal = computeWeightedTotal(elementCounts);
  const loc = countLoc(content);
  const density = loc > 0 ? weightedTotal / loc : 0;

  return { filePath, elementCounts, weightedTotal, loc, density };
};
