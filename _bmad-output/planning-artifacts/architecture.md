---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-02-13'
inputDocuments:
  - prd.md
  - product-brief-agent-test-kit-2026-02-11.md
workflowType: 'architecture'
project_name: 'Zelda'
user_name: 'Benji'
date: '2026-02-13'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
53 FRs across 9 capability areas. The core flow is a linear pipeline: configuration loading → workspace creation → Claude Code execution → evaluation (4 metrics in parallel) → result persistence → terminal reporting. The compare command adds a secondary flow that operates on persisted results.

FR distribution by area:
- Setup & Config: 5 FRs — Config loading, validation, override resolution
- Test Suite Definition: 5 FRs — YAML authoring, discovery, per-suite settings
- Execution & Workspace: 7 FRs — Git worktree isolation, Claude Agent SDK execution, transcript capture, cleanup
- Efficiency Evaluation: 5 FRs — Telemetry extraction (tokens, cost, turns, tool calls, errors)
- LLM Judge: 10 FRs — Requirement fulfillment + tool usage analysis, Portkey routing, credential separation, retries
- Functional Correctness: 6 FRs — Build/test command execution, result parsing, coverage reporting
- Transcript Management: 4 FRs — Chunking, incremental evaluation, synthesis
- Result Storage: 4 FRs — JSON persistence, unique IDs, history listing, retrieval
- Comparison & Reporting: 7 FRs — Delta computation, directional indicators, vitest-style terminal output

**Non-Functional Requirements:**
16 NFRs across 4 categories. The most architecturally significant:
- **NFR13 (Reliability):** Workspace isolation is an absolute invariant — no modification to developer's working directory under any circumstance
- **NFR14-15 (Reliability):** Partial result preservation on failure + atomic result persistence
- **NFR5-8 (Security):** API keys never in results, logs, or output; separate credential paths for execution vs. judge
- **NFR9-11 (Integration):** Both SDK dependencies abstracted behind clean interfaces for adaptation
- **NFR4 (Performance):** Chunked evaluation adds no more than 2x overhead vs. single-call

**Scale & Complexity:**

- Primary domain: CLI / Developer Tooling
- Complexity level: Medium
- Estimated architectural components: 8-10 (CLI, config, workspace, executor, 4 evaluators, reporter, storage)

### Technical Constraints & Dependencies

- **Language/Runtime:** TypeScript, Node.js, tsup bundler
- **Distribution:** npm package with `bin` field for CLI
- **External dependencies:** Claude Agent SDK (execution), Anthropic SDK via Portkey (judge), commander (CLI), zod (validation), yaml (parsing), chalk (terminal formatting)
- **No native dependencies** — pure JS/TS for portability
- **Resource constraint:** Solo developer — architecture must be simple and maintainable

### Cross-Cutting Concerns Identified

1. **Configuration resolution** — Project defaults merged with test suite overrides, validated by Zod, used by every component
2. **Error handling with graceful degradation** — Partial results preserved on failure (NFR14), workspace cleanup on interruption (NFR16), judge errors retried then reported (FR32)
3. **API key security** — Two separate credential paths (execution SDK vs. judge gateway), neither appearing in outputs
4. **Transcript as shared data** — Session transcript consumed by efficiency metric, requirement fulfillment judge, tool usage judge, and transcript management — the central data artifact
5. **Workspace lifecycle** — Creation → execution → evaluation → cleanup, with guaranteed cleanup even on failure

## Starter Template Evaluation

### Primary Technology Domain

TypeScript CLI tool — Node.js runtime, distributed as npm package with `bin` entry point.

### Starter Options Considered

| Option | Stack | Verdict | Rationale |
|---|---|---|---|
| **oclif** | TypeScript, class-based commands, plugin system | Rejected | Over-engineered for 4 commands. Replaces commander with its own patterns, adds plugin architecture Zelda doesn't need |
| **create-ts-fast** | TypeScript, tsup, vitest | Considered | Good baseline for npm packages but not CLI-specific. Would need manual CLI setup anyway |
| **Manual setup** | Exact PRD stack | **Selected** | PRD specifies all dependencies. No starter adds value over manual setup for this scope |

### Selected Approach: Manual Project Setup

**Rationale:** The PRD already defines the complete technology stack. Zelda has 4 commands, no plugin system, no complex command hierarchy. Every evaluated starter either adds unnecessary complexity (oclif) or provides a partial baseline that still requires the same manual work (create-ts-fast). Manual setup gives full control with zero baggage.

**Initialization:**

```bash
mkdir zelda && cd zelda
npm init -y
npm i commander zod yaml chalk @anthropic-ai/claude-agent-sdk @anthropic-ai/sdk
npm i -D typescript tsup vitest @types/node
```

### Architectural Decisions for Project Setup

**Language & Runtime:**
- TypeScript 5.x with strict mode
- Node.js (LTS) — no native dependencies for portability
- ES modules (`"type": "module"` in package.json)

**Build Tooling:**
- tsup — single entry point bundled to `dist/cli.js` with shebang (`#!/usr/bin/env node`)
- `"bin": { "zelda": "./dist/cli.js" }` in package.json

**Testing Framework:**
- vitest — aligned with modern TypeScript tooling, fast, built-in coverage

**Code Organization:**
- `src/` — all source code
- `src/cli.ts` — entry point (commander setup, command registration)
- `src/commands/` — one file per CLI command
- `src/core/` — business logic (config, workspace, executor, evaluators, reporter, storage)
- `tests/` — vitest test files mirroring src structure

**Development Experience:**
- `tsup --watch` for development builds
- vitest in watch mode for TDD
- No additional dev tooling in MVP (no eslint/prettier — solo developer, add later if needed)

**Note:** Project initialization using this setup should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1. Pipeline orchestration — parallel judges, sequential workspace ops
2. Evaluator interface — simple function contract
3. SDK abstraction — thin wrapper modules
4. Result storage — directory per run (result + transcript separation)
5. Workspace cleanup — try/finally + signal handlers + startup sweep

**Important Decisions (Shape Architecture):**
6. Transcript chunking — turn boundaries with token budget

**Deferred Decisions (Post-MVP):**
- Plugin/evaluator registration system (Framework Customizer user type)
- Multi-provider judge routing logic (Portkey universal API)
- CI/CD pipeline integration (`--json` output mode)

### Pipeline Architecture

**Decision:** Hybrid parallel/sequential pipeline orchestration.

**Pipeline flow:**
1. Load config + resolve overrides (sync)
2. Create isolated workspace via git worktree (sync)
3. Execute Claude Code session via Agent SDK (async, single operation)
4. Evaluate — hybrid parallel/sequential:
   - Efficiency: synchronous computation from telemetry (no I/O)
   - Functional Correctness: sequential — runs build/test commands in workspace (subprocess)
   - Requirement Fulfillment + Tool Usage Analysis: parallel — independent judge API calls via Portkey
5. Persist results atomically (sync)
6. Display terminal report (sync)
7. Cleanup workspace (async, non-blocking — results already displayed per NFR3)

**Rationale:** Judge calls are the slowest evaluator step (network I/O + LLM inference). Running both in parallel cuts wall-clock time meaningfully. Functional Correctness must run sequentially because it executes subprocesses in the workspace. Efficiency is pure computation — negligible time.

### Evaluator Interface

**Decision:** Simple function interface — no class hierarchy.

```typescript
type EvalContext = {
  config: ResolvedConfig;
  transcript: SessionTranscript;
  workspacePath: string;
  toolsManifest: ToolsManifest;
};

type EvalResult = {
  metric: string;
  score: number;          // 0-100 normalized
  details: unknown;       // metric-specific structured data
  reasoning?: string;     // human-readable explanation
};

type Evaluator = (context: EvalContext) => Promise<EvalResult>;
```

**Rationale:** 4 evaluators, solo developer, no plugin system in MVP. A function signature is the minimum viable contract. Each evaluator gets the same context, returns the same shape. Pipeline orchestration is just `Promise.all()` for parallel evaluators + sequential calls for the rest.

### SDK Integration

**Decision:** Thin wrapper modules — one per external dependency.

| Module | Wraps | Purpose |
|---|---|---|
| `execution-client.ts` | Claude Agent SDK | Execute Claude Code sessions, return structured transcript |
| `judge-client.ts` | Anthropic SDK via Portkey | Send judge prompts, parse structured responses, retry on failure |

**Rationale:** Each module exports typed functions, hides SDK specifics. Tests mock at the module level. If Claude Agent SDK changes its API, one file changes. If Portkey endpoint changes, one file changes. Not a formal adapter pattern — just practical encapsulation.

**Credential separation:** Execution client reads `ANTHROPIC_API_KEY`. Judge client reads `PORTKEY_API_KEY` + `PORTKEY_GATEWAY_URL` (or equivalent). Neither credential path appears in the other's module.

### Data Architecture

**Decision:** Directory-per-run with result/transcript separation.

```
.zelda/
  runs/
    <run-id>/
      result.json      # metadata, config snapshot, all metric scores
      transcript.json   # raw session transcript (potentially large)
```

**Run ID format:** `<test-name>-<timestamp>` (e.g., `rest-endpoint-2026-02-13T14-30-00`). Human-readable, sortable, unique.

**result.json structure:**
- `id`, `timestamp`, `testSuite` (name + config snapshot)
- `metrics.efficiency` — tokens, cost, turns, duration, tool calls, errors
- `metrics.requirementFulfillment` — overall score, per-criterion PASS/FAIL with reasoning
- `metrics.toolUsage` — tools used, tools missed, utilization score, reasoning
- `metrics.functionalCorrectness` — build pass/fail, test counts, coverage percentage
- No API keys, no raw credentials (NFR5-8)

**Rationale:** Transcripts from long sessions can be multi-MB. Separating them means `zelda list` and `zelda compare` never load transcript data — they only read the lean result.json. Atomic writes per NFR15: write to temp file, rename on success.

### Workspace Isolation

**Decision:** Triple-layer cleanup — try/finally + signal handlers + startup sweep.

**Layer 1 — try/finally:** Every run wraps workspace creation through cleanup in try/finally. Handles normal completion and thrown errors.

**Layer 2 — Signal handlers:** Register SIGINT and SIGTERM handlers that trigger workspace cleanup before exit. Handles Ctrl+C during long Claude Code sessions.

**Layer 3 — Startup sweep:** On every `zelda run` invocation, scan for orphaned `.zelda/workspaces/` directories and clean them up. Handles hard crashes (SIGKILL, power loss, OOM).

**Workspace location:** `.zelda/workspaces/<run-id>/` — inside the project's `.zelda` directory, making orphan detection trivial.

**Rationale:** NFR13 is an absolute invariant. NFR16 requires no orphans. Each layer covers failure modes the others miss. The startup sweep is cheap (single directory listing) and provides defense-in-depth.

### Transcript Management

**Decision:** Turn-boundary chunking with token budget.

**Algorithm:**
1. After Claude Code session completes, estimate total transcript tokens
2. If within judge model context capacity → single evaluation call (FR42)
3. If exceeds capacity → chunk at turn boundaries:
   - Iterate turns, accumulate estimated token count
   - When approaching budget (e.g., 80% of context limit), start new chunk
   - Never split mid-turn
4. Evaluate each chunk independently
5. Synthesize chunk results into final assessment (FR41)

**Token estimation:** Character-count heuristic (chars / 4 ≈ tokens) is sufficient for chunking decisions. Precision isn't critical — the goal is to avoid exceeding context, not to optimize token usage.

**Rationale:** Turn boundaries are natural semantic breakpoints. A turn contains a complete thought: user prompt → assistant reasoning → tool calls → results. Splitting mid-turn would lose context. Token budget ensures chunks fit in the judge's context window.

### Decision Impact Analysis

**Implementation Sequence:**
1. Project setup (package.json, tsup, vitest config)
2. Config loading + Zod validation
3. Workspace isolation (git worktree + cleanup layers)
4. SDK integration (execution client, then judge client)
5. Evaluators (efficiency first — no external deps; then functional correctness; then judge-based metrics)
6. Transcript management (chunking layer)
7. Result storage + history
8. Terminal reporter
9. Compare command
10. Init command (scaffolding)

**Cross-Component Dependencies:**
- All evaluators depend on `EvalContext` type definition
- Judge-based evaluators depend on `judge-client.ts` + transcript management
- Pipeline orchestration depends on evaluator interface contract
- Terminal reporter depends on `EvalResult` type from all evaluators
- Compare command depends on result storage format

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**6 conflict areas identified** where AI agents could make different implementation choices. All patterns below are mandatory for consistent codebase.

### Naming Patterns

**File Naming:**
- All source files: `kebab-case.ts` (e.g., `judge-client.ts`, `eval-context.ts`, `workspace-manager.ts`)
- Test files: `kebab-case.test.ts` mirroring source (e.g., `tests/core/judge-client.test.ts`)
- Type-only files: `kebab-case.ts` (no `.types.ts` suffix — types live in the file that owns them, or in `types.ts` for shared types)

**Code Naming:**
- Functions/variables: `camelCase` (e.g., `createWorkspace`, `runEvaluation`)
- Types/interfaces: `PascalCase` (e.g., `EvalResult`, `ResolvedConfig`, `SessionTranscript`)
- Constants: `SCREAMING_SNAKE_CASE` for true constants (e.g., `DEFAULT_JUDGE_MODEL`, `MAX_RETRIES`)
- No TypeScript `enum` — use `as const` objects or union types

**Config & Data Naming:**
- YAML config keys: `camelCase` (e.g., `judgeModel`, `maxTurns`, `gatewayUrl`)
- JSON result fields: `camelCase` (e.g., `requirementFulfillment`, `toolUsage`)
- Run IDs: `<test-name>-<timestamp>` format (e.g., `rest-endpoint-2026-02-13T14-30-00`)

### Structure Patterns

**Module Boundaries:**
- `src/cli.ts` — entry point only (commander setup, command registration)
- `src/commands/` — one file per CLI command, thin handlers that call into core
- `src/core/` — all business logic
- `tests/` — mirrors `src/` structure, NOT co-located

**Import Rules:**
- Dependency direction: `commands/ → core/`, never reverse
- Within core: evaluators may import from `judge-client`, `config`, shared types — not from each other
- No barrel `index.ts` files — direct imports only
- One primary export per file (may include related types)
- Relative paths within `src/` — no path aliases

**External Dependency Isolation:**
- External SDK types never leak beyond their wrapper module
- Wrap external types in Zelda-owned types (e.g., `JudgeResponse`, not `Anthropic.Message`)
- Shared types live in `src/core/types.ts` — single source of truth for `EvalContext`, `EvalResult`, `ResolvedConfig`, `SessionTranscript`, `ToolsManifest`

### Format Patterns

**Null/Undefined Handling:**
- Omit keys rather than setting `null` — absent means "not computed"
- Use TypeScript optional properties (`field?: Type`) not `field: Type | null`

**Result JSON Structure:**
- All metric scores normalized to 0-100
- Per-criterion details nested under their metric key
- Config snapshot included for reproducibility (without API keys)

### Error Handling Patterns

**Error Class Hierarchy:**
```
ZeldaError (base)
├── ConfigError      — invalid config, missing files, validation failures
├── WorkspaceError   — git worktree failures, cleanup failures
├── ExecutionError   — Claude Agent SDK failures, session errors
└── JudgeError       — Portkey/judge API failures, parse failures
```

**Error Properties:**
- `code: string` — machine-readable error code (e.g., `CONFIG_VALIDATION_FAILED`)
- `userMessage: string` — clean message shown in terminal
- Internal details (stack trace) logged to `.zelda/debug.log` when `--verbose` flag or unexpected error

**Error Propagation:**
- Throw errors, don't use Result types
- Catch at pipeline boundary (command handler level)
- Partial results preserved before re-throwing (NFR14)

**Exit Codes:**
- `0` — success (all evaluations completed)
- `1` — evaluation completed but with failures (e.g., build failed, criteria not met)
- `2` — Zelda itself failed (config error, SDK error, workspace error)

### Terminal Output Patterns

**Color Conventions (chalk):**
- Green: pass, success, positive deltas
- Red: fail, error, negative deltas
- Yellow: warning, partial, neutral
- Cyan: labels, info, headers
- Dim: secondary info (timestamps, run IDs, metadata)

**Formatting Rules:**
- Section headers: bold + underline for major, bold for sub-sections
- Metrics: `label: value` with consistent column alignment
- Percentages: one decimal place (e.g., `85.0%`)
- Progress: spinner with status text during long operations (no progress bars)
- No emojis — clean professional output, consistent across terminals

### Enforcement Guidelines

**All AI agents implementing Zelda stories MUST:**
1. Follow `kebab-case.ts` file naming — no exceptions
2. Import from specific files, never from barrel `index.ts`
3. Never expose external SDK types beyond wrapper modules
4. Use `ZeldaError` subclasses for all error cases — never throw plain `Error`
5. Keep dependency direction one-way: `commands/ → core/`

**Anti-Patterns to Avoid:**
- `export default` — always use named exports
- Importing from `../commands/` inside `core/` — wrong direction
- `catch (e) { console.log(e) }` — use `ZeldaError` hierarchy and proper propagation
- `null` values in result JSON — omit the key instead
- Re-exporting SDK types — wrap in Zelda-owned types

## Project Structure & Boundaries

### Complete Project Directory Structure

```
zelda/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── .gitignore
├── .env.example                        # Template for required env vars
│
├── src/
│   ├── cli.ts                          # Entry point — commander setup, command registration
│   │
│   ├── commands/
│   │   ├── init.ts                     # zelda init — scaffold config + example test suite
│   │   ├── run.ts                      # zelda run — orchestrate full pipeline
│   │   ├── compare.ts                  # zelda compare — load two results, compute deltas
│   │   └── list.ts                     # zelda list — scan runs directory, display summary
│   │
│   └── core/
│       ├── types.ts                    # Shared types: EvalContext, EvalResult, ResolvedConfig,
│       │                               #   SessionTranscript, ToolsManifest, RunResult
│       ├── errors.ts                   # ZeldaError hierarchy: ConfigError, WorkspaceError,
│       │                               #   ExecutionError, JudgeError
│       │
│       ├── config/
│       │   ├── loader.ts               # YAML file loading + Zod validation
│       │   ├── resolver.ts             # Merge project defaults with test suite overrides
│       │   └── schemas.ts              # Zod schemas for project config + test suite config
│       │
│       ├── workspace/
│       │   ├── manager.ts              # Git worktree create/cleanup, directory copy fallback
│       │   └── sweeper.ts              # Startup orphan detection and cleanup
│       │
│       ├── execution/
│       │   └── execution-client.ts     # Claude Agent SDK wrapper — execute session, return transcript
│       │
│       ├── evaluators/
│       │   ├── efficiency.ts           # Compute tokens, cost, turns, duration, tool calls, errors
│       │   ├── requirement-fulfillment.ts  # LLM judge — per-criterion PASS/FAIL + reasoning
│       │   ├── tool-usage.ts           # LLM judge — tools manifest vs transcript analysis
│       │   ├── functional-correctness.ts   # Run build/test commands, parse results
│       │   └── transcript-manager.ts   # Token estimation, turn-boundary chunking, synthesis
│       │
│       ├── judge/
│       │   ├── judge-client.ts         # Anthropic SDK via Portkey — send prompt, parse response, retry
│       │   └── prompts.ts              # Judge prompt templates for fulfillment + tool usage
│       │
│       ├── storage/
│       │   ├── result-store.ts         # Atomic JSON persistence, run listing, run retrieval
│       │   └── run-id.ts               # Run ID generation (<test-name>-<timestamp>)
│       │
│       ├── reporter/
│       │   ├── terminal.ts             # vitest-style colored output for single run results
│       │   └── compare.ts              # Delta computation and side-by-side formatting
│       │
│       └── pipeline.ts                 # Run pipeline orchestration — hybrid parallel/sequential
│
├── tests/
│   ├── commands/
│   │   ├── init.test.ts
│   │   ├── run.test.ts
│   │   ├── compare.test.ts
│   │   └── list.test.ts
│   ├── core/
│   │   ├── config/
│   │   │   ├── loader.test.ts
│   │   │   ├── resolver.test.ts
│   │   │   └── schemas.test.ts
│   │   ├── workspace/
│   │   │   └── manager.test.ts
│   │   ├── evaluators/
│   │   │   ├── efficiency.test.ts
│   │   │   ├── requirement-fulfillment.test.ts
│   │   │   ├── tool-usage.test.ts
│   │   │   ├── functional-correctness.test.ts
│   │   │   └── transcript-manager.test.ts
│   │   ├── judge/
│   │   │   └── judge-client.test.ts
│   │   ├── storage/
│   │   │   └── result-store.test.ts
│   │   ├── reporter/
│   │   │   ├── terminal.test.ts
│   │   │   └── compare.test.ts
│   │   └── pipeline.test.ts
│   └── fixtures/
│       ├── sample-config.yaml
│       ├── sample-test-suite.yaml
│       ├── sample-transcript.json
│       └── sample-result.json
│
└── dist/                               # Build output (gitignored)
    └── cli.js                          # Bundled CLI with shebang
```

### User's Project Structure (created by `zelda init`)

```
user-project/
├── zelda.config.yaml                   # Project-level config
├── zelda/                              # Test suite directory
│   └── test-example.yaml               # Example test suite
└── .zelda/                             # Runtime data (gitignored)
    ├── runs/                           # Persisted results
    │   └── <run-id>/
    │       ├── result.json             # Scores, metadata, config snapshot
    │       └── transcript.json         # Raw session transcript
    ├── workspaces/                     # Temporary execution workspaces
    │   └── <run-id>/                   # Git worktree (cleaned up after run)
    └── debug.log                       # Error details (when --verbose or unexpected errors)
```

### Architectural Boundaries

**Command Boundary:**
Commands are thin handlers. They parse CLI arguments, call into core, and handle top-level errors. No business logic lives in `commands/`.

```
commands/run.ts → pipeline.ts → (workspace, execution, evaluators, storage, reporter)
commands/compare.ts → storage/result-store.ts → reporter/compare.ts
commands/list.ts → storage/result-store.ts → reporter/terminal.ts
commands/init.ts → config/schemas.ts (for template generation)
```

**Evaluator Boundary:**
Each evaluator is a self-contained function conforming to `Evaluator` type. Evaluators never import from each other. They receive `EvalContext` and return `EvalResult`.

```
evaluators/efficiency.ts       → types.ts (EvalContext, EvalResult)
evaluators/requirement-fulfillment.ts → judge/judge-client.ts, transcript-manager.ts, types.ts
evaluators/tool-usage.ts       → judge/judge-client.ts, transcript-manager.ts, types.ts
evaluators/functional-correctness.ts → types.ts (runs subprocesses, no judge)
```

**SDK Boundary:**
External SDKs are fully encapsulated. Nothing outside the wrapper module touches SDK types.

```
execution/execution-client.ts  → @anthropic-ai/claude-agent-sdk (sole consumer)
judge/judge-client.ts          → @anthropic-ai/sdk via Portkey (sole consumer)
```

### Requirements to Structure Mapping

| FR Category | Files |
|---|---|
| **Setup & Config** (FR1-5) | `commands/init.ts`, `core/config/loader.ts`, `core/config/resolver.ts`, `core/config/schemas.ts` |
| **Test Suite Definition** (FR6-10) | `core/config/loader.ts`, `core/config/schemas.ts` |
| **Execution & Workspace** (FR11-17) | `core/workspace/manager.ts`, `core/workspace/sweeper.ts`, `core/execution/execution-client.ts`, `commands/run.ts` |
| **Efficiency Evaluation** (FR18-22) | `core/evaluators/efficiency.ts` |
| **LLM Judge** (FR23-32) | `core/evaluators/requirement-fulfillment.ts`, `core/evaluators/tool-usage.ts`, `core/judge/judge-client.ts`, `core/judge/prompts.ts` |
| **Functional Correctness** (FR33-38) | `core/evaluators/functional-correctness.ts` |
| **Transcript Management** (FR39-42) | `core/evaluators/transcript-manager.ts` |
| **Result Storage** (FR43-46) | `core/storage/result-store.ts`, `core/storage/run-id.ts` |
| **Comparison & Reporting** (FR47-53) | `core/reporter/terminal.ts`, `core/reporter/compare.ts`, `commands/compare.ts` |

### Cross-Cutting Concerns Mapping

| Concern | Files |
|---|---|
| **Shared types** | `core/types.ts` — single source of truth |
| **Error hierarchy** | `core/errors.ts` — all error classes |
| **Pipeline orchestration** | `core/pipeline.ts` — wires everything together |
| **Credential management** | `.env.example` documents required vars; `execution-client.ts` and `judge-client.ts` each read their own |

### Data Flow

```
zelda run [test-name]
  │
  ├─ config/loader.ts ──→ load zelda.config.yaml + zelda/test-*.yaml
  ├─ config/resolver.ts ─→ merge project defaults + test suite overrides
  │
  ├─ workspace/sweeper.ts ─→ clean orphaned workspaces from previous crashes
  ├─ workspace/manager.ts ─→ create git worktree in .zelda/workspaces/<run-id>/
  │
  ├─ execution/execution-client.ts ─→ Claude Agent SDK session → SessionTranscript
  │
  ├─ evaluators/ (orchestrated by pipeline.ts)
  │   ├─ efficiency.ts ────────────────→ EvalResult (sync, from telemetry)
  │   ├─ functional-correctness.ts ────→ EvalResult (sequential, subprocess in workspace)
  │   ├─ transcript-manager.ts ────────→ chunk transcript if needed
  │   ├─ requirement-fulfillment.ts ───→ EvalResult (parallel, via judge-client)
  │   └─ tool-usage.ts ───────────────→ EvalResult (parallel, via judge-client)
  │
  ├─ storage/result-store.ts ─→ atomic write to .zelda/runs/<run-id>/
  ├─ reporter/terminal.ts ────→ display results to terminal
  └─ workspace/manager.ts ────→ cleanup worktree (non-blocking, after report)
```

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:** All decisions are internally consistent. No conflicts detected:
- TypeScript + tsup + commander + vitest — well-established, compatible toolchain
- Evaluator function interface works cleanly with hybrid parallel/sequential pipeline
- Directory-per-run storage aligns with atomic write strategy (temp file → rename)
- Thin SDK wrappers align with "no SDK types leak" pattern rule
- Triple-layer cleanup aligns with workspace location choice (`.zelda/workspaces/`)

**Pattern Consistency:** Naming, structure, and error patterns are coherent with each other. No contradictions between patterns and decisions.

**Structure Alignment:** Project tree maps 1:1 to architectural decisions. Every component from the pipeline has a home. Every FR maps to at least one file.

### Requirements Coverage Validation

**Functional Requirements — all 53 FRs covered:**

| FR Range | Coverage |
|---|---|
| FR1-5 (Setup & Config) | Fully covered — `config/`, `commands/init.ts` |
| FR6-10 (Test Suite) | Fully covered — `config/loader.ts`, `config/schemas.ts` |
| FR11-17 (Execution & Workspace) | Fully covered — `workspace/`, `execution/`, `pipeline.ts` |
| FR18-22 (Efficiency) | Fully covered — `evaluators/efficiency.ts` |
| FR23-32 (LLM Judge) | Fully covered — `judge/`, `evaluators/requirement-fulfillment.ts`, `evaluators/tool-usage.ts` |
| FR33-38 (Functional Correctness) | Fully covered — `evaluators/functional-correctness.ts` |
| FR39-42 (Transcript Management) | Fully covered — `evaluators/transcript-manager.ts` |
| FR43-46 (Result Storage) | Fully covered — `storage/` |
| FR47-53 (Comparison & Reporting) | Fully covered — `reporter/`, `commands/compare.ts` |

**Non-Functional Requirements — all 16 NFRs covered:**

| NFR | Architectural Support |
|---|---|
| NFR1-3 (Performance) | Pipeline separates framework overhead from SDK time; cleanup non-blocking |
| NFR4 (Chunking overhead) | Turn-boundary chunking with token budget — bounded overhead |
| NFR5-8 (Security) | Credential separation in SDK wrappers; result sanitization; `.env.example` |
| NFR9-11 (Integration) | Thin wrapper modules for both SDKs — clean interfaces |
| NFR12 (Graceful degradation) | `JudgeError` class + retry logic in `judge-client.ts` |
| NFR13 (Workspace invariant) | Triple-layer cleanup; workspace in `.zelda/workspaces/` |
| NFR14 (Partial results) | Error propagation: preserve results before re-throwing |
| NFR15 (Atomic persistence) | Temp file → rename strategy in `result-store.ts` |
| NFR16 (No orphans) | Startup sweep in `sweeper.ts` |

### Gap Analysis Results

**No critical gaps found.**

**One important clarification added:**
- **Tools manifest construction (FR26):** Scanning the workspace's `.claude/` directory to build `ToolsManifest` belongs in `pipeline.ts` as part of `EvalContext` assembly — not inside any evaluator. This way `tool-usage.ts` receives the manifest, it doesn't build it.

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed (53 FRs, 16 NFRs mapped)
- [x] Scale and complexity assessed (Medium, 8-10 components)
- [x] Technical constraints identified (TypeScript, Node.js, two SDKs, solo developer)
- [x] Cross-cutting concerns mapped (5 concerns)

**Architectural Decisions**
- [x] 6 critical/important decisions documented with rationale
- [x] Technology stack fully specified (all dependencies listed)
- [x] Integration patterns defined (two SDK wrappers, evaluator interface)
- [x] Performance considerations addressed (parallel judges, non-blocking cleanup)

**Implementation Patterns**
- [x] Naming conventions established (files, code, config, data)
- [x] Structure patterns defined (module boundaries, import rules, dependency isolation)
- [x] Error handling patterns documented (hierarchy, propagation, exit codes)
- [x] Terminal output patterns specified (colors, formatting)

**Project Structure**
- [x] Complete directory structure defined (Zelda source + user project)
- [x] Component boundaries established (command, evaluator, SDK boundaries)
- [x] Integration points mapped (data flow diagram)
- [x] Requirements to structure mapping complete (all 9 FR categories)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Clean pipeline architecture with clear data flow
- Every FR has a specific file home — no ambiguity for implementing agents
- SDK abstraction prevents vendor lock-in without over-engineering
- Error handling covers all failure modes (normal, interrupt, crash)
- Evaluator interface is minimal and uniform — adding future metrics is trivial

**Areas for Future Enhancement:**
- Plugin/evaluator registration (post-MVP Framework Customizer)
- Multi-provider judge routing (post-MVP Portkey universal API)
- CI/CD integration patterns (post-MVP `--json` flag)

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Refer to this document for all architectural questions
- Tools manifest construction belongs in `pipeline.ts` (context assembly)

**First Implementation Priority:**
Project setup — `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `.gitignore`, `.env.example`, directory structure, and `src/core/types.ts` + `src/core/errors.ts` as the foundational types.
