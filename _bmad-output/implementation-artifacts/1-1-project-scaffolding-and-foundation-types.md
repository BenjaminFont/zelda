# Story 1.1: Project Scaffolding & Foundation Types

Status: done

## Story

As a **developer building Zelda**,
I want the project set up with build tooling, shared types, and error hierarchy,
So that all subsequent stories have a consistent foundation to build on.

## Acceptance Criteria

1. **Given** a new project directory **When** `npm install` and `npm run build` are executed **Then** the project compiles successfully with TypeScript strict mode, tsup produces `dist/cli.js` with shebang, and `vitest` runs (with no tests yet)

2. **Given** the shared types file exists **When** a developer imports from `core/types.ts` **Then** `EvalContext`, `EvalResult`, `ResolvedConfig`, `SessionTranscript`, `ToolsManifest`, and `RunResult` types are available

3. **Given** the errors file exists **When** a developer imports from `core/errors.ts` **Then** `ZeldaError`, `ConfigError`, `WorkspaceError`, `ExecutionError`, and `JudgeError` classes are available, each with `code` and `userMessage` properties

4. **Given** the CLI entry point exists **When** `zelda --version` is run **Then** the version number from package.json is displayed

## Tasks / Subtasks

- [x] Task 1: Initialize project with package.json and dependencies (AC: #1)
  - [x] 1.1 Create package.json with name "zelda", version "0.1.0", type "module", bin field pointing to ./dist/cli.js
  - [x] 1.2 Install production dependencies: @anthropic-ai/claude-agent-sdk, @anthropic-ai/sdk, chalk, commander, yaml, zod
  - [x] 1.3 Install dev dependencies: typescript, tsup, vitest, @types/node
  - [x] 1.4 Add npm scripts: build, dev, test, typecheck
- [x] Task 2: Configure TypeScript, tsup, and vitest (AC: #1)
  - [x] 2.1 Create tsconfig.json with strict mode, ES2022 target, Node16 module/moduleResolution, src include, dist outDir
  - [x] 2.2 Create tsup.config.ts with entry src/cli.ts, ESM format, shebang plugin, clean output
  - [x] 2.3 Create vitest.config.ts with test directory glob
  - [x] 2.4 Create .gitignore (dist/, node_modules/, .zelda/, .env, *.tgz)
  - [x] 2.5 Create .env.example documenting required environment variables
- [x] Task 3: Create project directory structure (AC: #1)
  - [x] 3.1 Create src/ directory structure: cli.ts, commands/, core/ (config/, workspace/, execution/, evaluators/, judge/, storage/, reporter/)
  - [x] 3.2 Create tests/ directory structure mirroring src/
  - [x] 3.3 Create tests/fixtures/ directory
- [x] Task 4: Implement shared types in src/core/types.ts (AC: #2)
  - [x] 4.1 Define EvalContext type: config (ResolvedConfig), transcript (SessionTranscript), workspacePath (string), toolsManifest (ToolsManifest)
  - [x] 4.2 Define EvalResult type: metric (string), score (number 0-100), details (unknown), reasoning? (string)
  - [x] 4.3 Define Evaluator type: (context: EvalContext) => Promise<EvalResult>
  - [x] 4.4 Define ResolvedConfig type with project config + test suite merged fields
  - [x] 4.5 Define SessionTranscript type for captured Claude Code session data
  - [x] 4.6 Define ToolsManifest type for .claude/ directory scanning results
  - [x] 4.7 Define RunResult type for persisted run data (id, timestamp, testSuite, metrics)
- [x] Task 5: Implement error hierarchy in src/core/errors.ts (AC: #3)
  - [x] 5.1 Create ZeldaError base class extending Error with code (string) and userMessage (string) properties
  - [x] 5.2 Create ConfigError extending ZeldaError
  - [x] 5.3 Create WorkspaceError extending ZeldaError
  - [x] 5.4 Create ExecutionError extending ZeldaError
  - [x] 5.5 Create JudgeError extending ZeldaError
- [x] Task 6: Implement CLI entry point in src/cli.ts (AC: #4)
  - [x] 6.1 Set up commander program with name "zelda", description, and version read from package.json
  - [x] 6.2 Register placeholder commands (run, init, compare, list) so help output works
  - [x] 6.3 Call program.parse() to handle CLI input
- [x] Task 7: Verify build and test pipeline works end-to-end (AC: #1, #4)
  - [x] 7.1 Run npm run build and verify dist/cli.js is produced with shebang
  - [x] 7.2 Run npm test and verify vitest runs successfully (0 tests, no failures)
  - [x] 7.3 Run npx zelda --version and verify version output matches package.json

## Dev Notes

### Architecture Requirements

This is the **foundation story** for the entire Zelda project. Every subsequent story depends on the patterns, types, and structure established here. Get it right.

**Critical architecture patterns from architecture.md:**

- **File naming:** `kebab-case.ts` for all source files (e.g., `judge-client.ts`, `eval-context.ts`)
- **Code naming:** `camelCase` functions/variables, `PascalCase` types/interfaces, `SCREAMING_SNAKE_CASE` constants
- **No enums:** Use `as const` objects or union types instead of TypeScript `enum`
- **No barrel files:** No `index.ts` barrel exports. Direct imports only
- **Named exports only:** Never use `export default`
- **Module system:** ES modules (`"type": "module"` in package.json)
- **Dependency direction:** `commands/ → core/`, never reverse. Evaluators never import from each other
- **Null handling:** Omit keys rather than setting null. Use optional properties (`field?: Type`), not `field: Type | null`
- **External SDK isolation:** External SDK types never leak beyond their wrapper module. Wrap in Zelda-owned types

### Technology Stack (Verified Feb 2026)

**CRITICAL: These are the verified latest versions. Do NOT use outdated versions.**

| Package | Version | Notes |
|---|---|---|
| @anthropic-ai/claude-agent-sdk | ^0.2.41 | Programmatic SDK for Claude Code. Uses `query()` returning AsyncIterator |
| @anthropic-ai/sdk | ^0.74.0 | Standard Anthropic API client for judge calls via Portkey |
| commander | ^14.0.3 | Requires Node.js >= 20. Option property case matches flag |
| zod | ^4.3.6 | **Zod 4** — NOT Zod 3. API changes: `z.email()` not `z.string().email()`, `z.record()` requires 2 args |
| chalk | ^5.6.2 | ESM-only since v5. Fine with `"type": "module"` and tsup bundling |
| yaml | ^2.8.2 | Stable. Dual ESM/CJS |
| typescript | ~5.9.3 | Latest stable 5.x. Do NOT use TS 6.0 beta |
| tsup | ^8.5.1 | Stable, maintenance mode. Fine for this project |
| vitest | ^4.0.18 | Vitest 4. poolOptions removed; thread/vm options top-level in config |

### Zod 4 Breaking Changes (Critical for Story 1.2)

While this story doesn't use Zod schemas directly, the types defined here will be used with Zod in Story 1.2. Important to know:
- String format validators are top-level: `z.email()`, `z.uuid()`, `z.url()` (not `.string().email()`)
- `z.record()` requires two arguments (key schema, value schema)
- Error customization uses `error` not `message`
- Import: `import { z } from "zod"` (Zod 4 default export) or `import { z } from "zod/v4"` (explicit)

### Project Structure to Create

```
zelda/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── .gitignore
├── .env.example
│
├── src/
│   ├── cli.ts                          # Entry point — commander setup
│   ├── commands/                       # (empty for now, placeholder files later)
│   └── core/
│       ├── types.ts                    # Shared types (THIS STORY)
│       ├── errors.ts                   # Error hierarchy (THIS STORY)
│       ├── config/                     # (empty for now)
│       ├── workspace/                  # (empty for now)
│       ├── execution/                  # (empty for now)
│       ├── evaluators/                 # (empty for now)
│       ├── judge/                      # (empty for now)
│       ├── storage/                    # (empty for now)
│       ├── reporter/                   # (empty for now)
│       └── pipeline.ts                 # (placeholder for now)
│
├── tests/
│   ├── core/
│   └── fixtures/
│
└── dist/                               # Build output (gitignored)
    └── cli.js
```

**Do NOT create placeholder files** in empty directories. Only create `.gitkeep` files if git requires it to track empty directories. The directories themselves should exist for structure but will be populated by later stories.

### Type Definitions Guidance

**EvalContext** — The input every evaluator receives:
```typescript
export type EvalContext = {
  config: ResolvedConfig;
  transcript: SessionTranscript;
  workspacePath: string;
  toolsManifest: ToolsManifest;
};
```

**EvalResult** — The output every evaluator returns:
```typescript
export type EvalResult = {
  metric: string;
  score: number;          // 0-100 normalized
  details: unknown;       // metric-specific structured data
  reasoning?: string;     // human-readable explanation
};
```

**Evaluator** — The function signature:
```typescript
export type Evaluator = (context: EvalContext) => Promise<EvalResult>;
```

**ResolvedConfig** — Merged project config + test suite overrides. Must include:
- judgeModel, gatewayUrl (for LLM judge routing)
- execution defaults (model, maxTurns)
- resultsDir, testDir
- Test suite specific: prompt, acceptanceCriteria, buildCommand?, testCommand?, coverageThreshold?
- Metric toggles (which evaluators are enabled)

**SessionTranscript** — Captured Claude Code session:
- messages array (role, content, tool calls with inputs/outputs)
- metadata: cost, tokens (input/output), turnCount, duration, errorCount

**ToolsManifest** — Scanned from .claude/ directory:
- skills, rules, subAgents, mcpConfigs arrays
- Each with name, path, and content summary

**RunResult** — Persisted run data:
- id (format: `<test-name>-<timestamp>`)
- timestamp
- testSuite (name + config snapshot, NO API keys)
- metrics: Map/object of metric name → EvalResult

### Error Hierarchy Guidance

```typescript
export class ZeldaError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userMessage: string
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}
```

Error subclasses follow the same pattern. Each should set `this.name` correctly for stack traces.

**Exit codes:**
- 0 = success
- 1 = evaluation completed with failures
- 2 = Zelda framework error

### CLI Entry Point Guidance

```typescript
// src/cli.ts
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json — works in both dev and built contexts
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
);

const program = new Command();
program
  .name('zelda')
  .description('Evaluation framework for the Claude Code tooling ecosystem')
  .version(packageJson.version);

// Placeholder commands — will be implemented in later stories
program.command('run [test-name]').description('Run evaluation pipeline');
program.command('init').description('Initialize Zelda in current project');
program.command('compare <run1> <run2>').description('Compare two runs');
program.command('list').description('List past runs');

program.parse();
```

**IMPORTANT:** The version reading approach must work when the CLI is installed as an npm package (dist/cli.js runs from node_modules/.bin/). The `__dirname` + `../package.json` path must resolve correctly from both `src/cli.ts` (dev) and `dist/cli.js` (built).

### tsup Configuration Guidance

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  shims: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
```

**Note:** tsup's `banner` option adds the shebang. After build, `dist/cli.js` must have `chmod +x` applied (tsup does this automatically when banner includes shebang).

### TypeScript Configuration Guidance

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### npm Scripts

```json
{
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

### .env.example Contents

```
# Claude Code execution (Claude Agent SDK)
ANTHROPIC_API_KEY=your-anthropic-api-key

# LLM Judge routing (Portkey gateway)
PORTKEY_API_KEY=your-portkey-api-key
PORTKEY_GATEWAY_URL=https://api.portkey.ai/v1
```

### Testing Approach for This Story

- **types.ts:** Type-only file, no runtime behavior to test. TypeScript compilation validates correctness. Write a simple import test that verifies all types are exported.
- **errors.ts:** Test each error class: construction, code property, userMessage property, instanceof checks, name property.
- **cli.ts:** Test --version flag outputs the correct version. Test --help outputs expected command list. Use vitest's `execSync` or subprocess approach.

### Anti-Patterns to Avoid

- Do NOT use `export default` anywhere — named exports only
- Do NOT create barrel `index.ts` files
- Do NOT use TypeScript `enum` — use `as const` or union types
- Do NOT use `null` values in types — use optional properties (`?`)
- Do NOT hardcode version strings — read from package.json
- Do NOT install any dependencies not listed above
- Do NOT create placeholder implementation files with `// TODO` stubs in directories that will be populated later. Just create the directories

### Project Structure Notes

- This is a greenfield project — no existing code to conflict with
- The project root is the working directory
- All paths are relative to project root
- `src/` contains all source code, `tests/` mirrors the structure
- `dist/` is the build output, gitignored

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Project Context Analysis]
- [Source: _bmad-output/planning-artifacts/architecture.md#Starter Template Evaluation]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries]
- [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1]
- [Source: _bmad-output/planning-artifacts/prd.md#CLI / Developer Tool Specific Requirements]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

No issues encountered during implementation.

### Completion Notes List

- Initialized project with package.json (name: zelda, version: 0.1.0, type: module, bin: ./dist/cli.js)
- Installed all production deps: @anthropic-ai/claude-agent-sdk@^0.2.42, @anthropic-ai/sdk@^0.74.0, chalk@^5.6.2, commander@^14.0.3, yaml@^2.8.2, zod@^4.3.6
- Installed all dev deps: typescript, tsup@^8.5.1, vitest@^4.0.18, @types/node
- Created tsconfig.json with strict mode, ES2022 target, Node16 module resolution
- Created tsup.config.ts producing ESM output with shebang banner targeting node20
- Created vitest.config.ts with tests/**/*.test.ts pattern
- Created .gitignore and .env.example
- Created full directory structure: src/commands, src/core/{config,workspace,execution,evaluators,judge,storage,reporter}, tests/core, tests/commands, tests/fixtures
- Implemented 15 types in src/core/types.ts: EvalContext, EvalResult, Evaluator, ResolvedConfig, MetricToggles, ExecutionDefaults, SessionTranscript, TranscriptMessage, ToolCall, SessionMetadata, ToolsManifest, ToolEntry, TestSuiteSnapshot, RunResult
- Implemented 5 error classes in src/core/errors.ts: ZeldaError, ConfigError, WorkspaceError, ExecutionError, JudgeError — all with code and userMessage properties
- Implemented CLI entry point in src/cli.ts with commander, reading version from package.json, registering placeholder commands (run, init, compare, list)
- All architecture patterns followed: kebab-case files, named exports only, no barrel files, no enums, ESM modules, optional properties instead of null
- Build produces dist/cli.js (816 bytes) with shebang
- 20 tests passing across 3 test files (types: 7, errors: 11, cli: 2)
- TypeScript typecheck clean with no errors

### Change Log

- 2026-02-14: Story 1.1 implemented — Project scaffolding, foundation types, error hierarchy, CLI entry point
- 2026-02-14: Code review completed — Fixed 3 issues: null in test data, TypeScript version constraint, error class naming pattern

### File List

- package.json (new)
- package-lock.json (new)
- tsconfig.json (new)
- tsup.config.ts (new)
- vitest.config.ts (new)
- .gitignore (new)
- .env.example (new)
- src/cli.ts (new)
- src/core/types.ts (new)
- src/core/errors.ts (new)
- src/commands/.gitkeep (new)
- src/core/config/.gitkeep (new)
- src/core/workspace/.gitkeep (new)
- src/core/execution/.gitkeep (new)
- src/core/evaluators/.gitkeep (new)
- src/core/judge/.gitkeep (new)
- src/core/storage/.gitkeep (new)
- src/core/reporter/.gitkeep (new)
- tests/core/types.test.ts (new)
- tests/core/errors.test.ts (new)
- tests/core/cli.test.ts (new)
- tests/commands/.gitkeep (new)
- tests/fixtures/.gitkeep (new)
