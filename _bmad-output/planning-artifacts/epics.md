---
stepsCompleted: [1, 2, 3, 4]
status: complete
completedAt: '2026-02-15'
inputDocuments:
  - prd.md
  - architecture.md
addedEpics:
  - epic-8
---

# Zelda - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Zelda, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

- FR1: Developer can initialize Zelda in an existing project, creating a config file, test suite directory, and example test suite
- FR2: Developer can define project-level configuration in a YAML file (judge model, gateway endpoint, execution defaults, results directory)
- FR3: System validates all configuration files against defined schemas and reports clear errors on invalid input
- FR4: Developer can override project-level configuration settings at the test suite level
- FR5: System resolves configuration by merging project defaults with test suite overrides
- FR6: Developer can define a test suite in a YAML file with a prompt describing what Claude Code should build
- FR7: Developer can specify acceptance criteria as a list of testable statements in a test suite
- FR8: Developer can configure execution parameters per test suite (model, max turns)
- FR9: Developer can configure which evaluation metrics are enabled per test suite
- FR10: System discovers and loads all test suite files from the configured test directory
- FR11: System creates an isolated workspace for each test run using git worktree
- FR12: System falls back to directory copy for non-git repositories
- FR13: System executes a Claude Code session in the isolated workspace using the Claude Agent SDK
- FR14: System captures the full session transcript including all tool calls, inputs, outputs, and responses
- FR15: System captures session metadata (cost, tokens, turn count, duration)
- FR16: System cleans up isolated workspaces after run completion
- FR17: Developer can run a specific test suite by name or run all test suites
- FR18: System computes total token usage (input and output) from session telemetry
- FR19: System computes API cost in USD from session telemetry
- FR20: System computes turn count and wall-clock duration from session telemetry
- FR21: System computes tool call counts grouped by tool type (Read, Edit, Write, Bash, Glob, Grep, etc.)
- FR22: System computes error and retry count from session telemetry
- FR23: System sends generated code and acceptance criteria to an LLM judge for requirement fulfillment evaluation
- FR24: LLM judge evaluates each acceptance criterion individually, returning PASS/FAIL with reasoning per criterion
- FR25: System computes an overall requirement fulfillment score as percentage of criteria met
- FR26: System builds a tools manifest by scanning the workspace's .claude/ directory (skills, rules, sub-agents, MCP configurations)
- FR27: System sends the tools manifest and session transcript to an LLM judge for tool usage analysis
- FR28: LLM judge identifies tools used (with frequency), tools that should have been used but weren't, and overall utilization effectiveness
- FR29: Developer can configure which LLM model is used as the judge and the gateway endpoint (e.g., Portkey)
- FR30: System routes all judge LLM calls through the configured gateway endpoint, supporting Anthropic SDK via Portkey
- FR31: Developer can configure gateway credentials (API key, endpoint URL) separately from Claude Agent SDK credentials used for execution
- FR32: System handles LLM judge errors with retries and clear error reporting
- FR33: Developer can configure a build command per test suite that the system executes in the workspace after Claude Code completes
- FR34: System reports build pass/fail based on command exit code
- FR35: Developer can configure a test command per test suite that the system executes in the workspace
- FR36: System parses test command output to extract pass/fail counts
- FR37: Developer can optionally configure a coverage threshold per test suite
- FR38: System reports test coverage percentage when coverage data is available
- FR39: System monitors transcript size and applies chunked evaluation when the transcript exceeds the judge LLM's context capacity
- FR40: When chunking is needed, system splits the transcript into meaningful increments and evaluates each independently
- FR41: System synthesizes incremental evaluation results into a cohesive final assessment without losing critical information
- FR42: System preserves full evaluation fidelity for transcripts that fit within a single judge call
- FR43: System persists complete run results (all metric outputs, transcript, configuration used) as JSON to a results directory
- FR44: System assigns a unique identifier to each run
- FR45: Developer can list all past runs with summary information (date, test name, key scores)
- FR46: Developer can retrieve the full results of any past run by its identifier
- FR47: Developer can compare two runs side-by-side, seeing numerical deltas for all metrics
- FR48: Comparison displays directional indicators showing which run performed better per metric
- FR49: System displays run results in the terminal using colored, formatted output (vitest-style)
- FR50: Terminal output shows requirement fulfillment with per-criterion PASS/FAIL and reasoning
- FR51: Terminal output shows tool usage analysis with tools called, tools missed, and utilization assessment
- FR52: Terminal output shows efficiency metrics (tokens, cost, turns, duration, tool call breakdown)
- FR53: Terminal output shows functional correctness results (build status, test pass/fail counts, coverage)

#### Phase 2 — Code Quality & Complexity (Epic 8)

- FR57: Developer can configure one or more static analysis commands per test suite (e.g., `npx eslint .`, `npx tsc --noEmit`) that the system executes in the workspace after Claude Code completes
- FR58: System executes each configured static analysis command and captures exit code, stdout, and stderr
- FR59: System parses linter/compiler output to extract counts of errors and warnings
- FR60: System computes a code quality score (0-100) based on error/warning counts (zero errors = 100, scaling down with errors)
- FR61: Terminal output shows code quality results (per-command pass/fail, error count, warning count, overall score)
- FR62: Code quality evaluator conforms to the Evaluator interface (EvalContext → Promise<EvalResult> with metric: "codeQuality")
- FR63: System identifies files touched during the Claude Code session (new or modified) by diffing workspace state before and after execution
- FR64: System parses touched files to count APP elements (constants, calls, conditions, loops, assignments) using language-agnostic pattern detection
- FR65: System computes weighted APP total per file using the APP weight table (constants x1, calls x2, conditions x4, loops x5, assignments x6)
- FR66: System computes per-file APP density (weighted total / lines of code) as the normalized complexity measure
- FR67: System computes relative APP delta by comparing touched files against their pre-session state — showing whether Claude Code made the code more or less complex
- FR68: System computes an overall complexity score (0-100) derived from per-file density (lower density = higher score)
- FR69: Terminal output shows complexity results: per-file breakdown (element counts, density), relative delta vs. pre-session, and overall score
- FR70: Complexity evaluator conforms to the Evaluator interface (EvalContext → Promise<EvalResult> with metric: "complexity")

### NonFunctional Requirements

- NFR1: Zelda's own framework overhead (config loading, workspace creation, result persistence, reporting) completes within seconds
- NFR2: Workspace creation via git worktree completes within 5 seconds for typical repositories
- NFR3: Workspace cleanup does not block the user from seeing results — results display first, cleanup happens after
- NFR4: Chunked evaluation for large transcripts adds no more than 2x overhead compared to single-call evaluation
- NFR5: API keys (Anthropic, Portkey) are never stored in result files, logs, or terminal output
- NFR6: API keys are read from environment variables or secure config, never hardcoded in test suites
- NFR7: Isolated workspaces do not expose or modify credentials in the developer's main project directory
- NFR8: Result JSON files do not contain raw API keys or secrets from the evaluated project
- NFR9: Claude Agent SDK dependency — version compatibility documented and validated
- NFR10: Anthropic SDK via Portkey dependency — endpoint compatibility validated
- NFR11: Both SDK dependencies abstracted behind clean interfaces to enable adaptation if APIs change
- NFR12: System degrades gracefully if Portkey is unreachable (clear error, no data loss of captured transcript)
- NFR13: Workspace isolation is bulletproof — under no circumstances should a Zelda run modify files in the developer's working directory
- NFR14: If a run fails mid-execution, partial results are preserved and the workspace is cleaned up
- NFR15: Result persistence is atomic — a result file is either complete and valid JSON, or not written at all
- NFR16: System recovers cleanly from interrupted runs — no orphaned git worktrees or zombie processes

### Additional Requirements

**From Architecture — Project Setup:**
- Manual project setup (no starter template): TypeScript 5.x strict mode, ES modules, tsup bundling with shebang, vitest testing
- Package distributed via npm with `"bin": { "zelda": "./dist/cli.js" }`
- Dependencies: commander, zod, yaml, chalk, @anthropic-ai/claude-agent-sdk, @anthropic-ai/sdk

**From Architecture — Pipeline & Patterns:**
- Hybrid parallel/sequential pipeline orchestration (efficiency sync, functional correctness sequential, judges parallel)
- Simple evaluator function interface: `(context: EvalContext) => Promise<EvalResult>` with score 0-100 normalized
- Thin SDK wrapper modules: `execution-client.ts` (Claude Agent SDK), `judge-client.ts` (Anthropic SDK via Portkey)
- Tools manifest construction belongs in pipeline.ts (context assembly), not in evaluators
- Directory-per-run storage: `result.json` + `transcript.json` separated
- Run ID format: `<test-name>-<timestamp>`
- Atomic writes: temp file → rename on success

**From Architecture — Workspace & Error Handling:**
- Triple-layer workspace cleanup: try/finally + signal handlers (SIGINT/SIGTERM) + startup sweep for orphans
- Workspace location: `.zelda/workspaces/<run-id>/`
- ZeldaError hierarchy: ConfigError, WorkspaceError, ExecutionError, JudgeError
- Error properties: `code` (machine-readable) + `userMessage` (terminal display)
- Exit codes: 0 = success, 1 = evaluation failures, 2 = Zelda framework error

**From Architecture — Transcript Management:**
- Turn-boundary chunking with token budget (80% of context limit)
- Character-count heuristic for token estimation (chars / 4)
- Never split mid-turn

**From Architecture — Implementation Patterns:**
- kebab-case.ts file naming, camelCase code, PascalCase types, SCREAMING_SNAKE_CASE constants
- No barrel index.ts files, one-way dependency direction (commands → core)
- Named exports only, no export default
- chalk color conventions: green=pass, red=fail, yellow=warning, cyan=info, dim=secondary
- No emojis in terminal output

### FR Coverage Map

| FR | Epic | Description |
|---|---|---|
| FR1 | Epic 1 | Initialize project with config, test dir, example suite |
| FR2 | Epic 1 | Project-level YAML configuration |
| FR3 | Epic 1 | Zod schema validation with clear errors |
| FR4 | Epic 1 | Test suite level config overrides |
| FR5 | Epic 1 | Config merge resolution |
| FR6 | Epic 1 | Test suite YAML with prompt |
| FR7 | Epic 1 | Acceptance criteria in test suite |
| FR8 | Epic 1 | Per-suite execution parameters |
| FR9 | Epic 1 | Per-suite metric enable/disable |
| FR10 | Epic 1 | Auto-discover test suite files |
| FR11 | Epic 1 | Git worktree workspace creation |
| FR12 | Epic 1 | Directory copy fallback for non-git |
| FR13 | Epic 1 | Claude Agent SDK execution |
| FR14 | Epic 1 | Full transcript capture |
| FR15 | Epic 1 | Session metadata capture |
| FR16 | Epic 1 | Workspace cleanup |
| FR17 | Epic 1 | Run specific or all test suites |
| FR18 | Epic 1 | Token usage computation |
| FR19 | Epic 1 | API cost computation |
| FR20 | Epic 1 | Turn count and duration |
| FR21 | Epic 1 | Tool call counts by type |
| FR22 | Epic 1 | Error and retry count |
| FR23 | Epic 2 | Send code + criteria to judge |
| FR24 | Epic 2 | Per-criterion PASS/FAIL with reasoning |
| FR25 | Epic 2 | Overall fulfillment percentage |
| FR26 | Epic 3 | Build tools manifest from .claude/ |
| FR27 | Epic 3 | Send manifest + transcript to judge |
| FR28 | Epic 3 | Identify used/missed tools, utilization score |
| FR29 | Epic 2 | Configure judge model and gateway |
| FR30 | Epic 2 | Route judge calls through Portkey |
| FR31 | Epic 2 | Separate gateway credentials |
| FR32 | Epic 2 | Judge error retries |
| FR33 | Epic 4 | Configure build command |
| FR34 | Epic 4 | Build pass/fail from exit code |
| FR35 | Epic 4 | Configure test command |
| FR36 | Epic 4 | Parse test output for pass/fail counts |
| FR37 | Epic 4 | Optional coverage threshold |
| FR38 | Epic 4 | Coverage percentage reporting |
| FR39 | Epic 6 | Monitor transcript size |
| FR40 | Epic 6 | Chunk at meaningful increments |
| FR41 | Epic 6 | Synthesize incremental results |
| FR42 | Epic 6 | Full fidelity for small transcripts |
| FR43 | Epic 1 | Persist complete results as JSON |
| FR44 | Epic 1 | Unique run identifier |
| FR45 | Epic 5 | List past runs with summary |
| FR46 | Epic 5 | Retrieve full results by ID |
| FR47 | Epic 5 | Compare two runs with deltas |
| FR48 | Epic 5 | Directional indicators per metric |
| FR49 | Epic 1 | Colored terminal output (vitest-style) |
| FR50 | Epic 2 | Terminal: fulfillment per-criterion display |
| FR51 | Epic 3 | Terminal: tool usage display |
| FR52 | Epic 1 | Terminal: efficiency metrics display |
| FR53 | Epic 4 | Terminal: functional correctness display |
| FR54 | Epic 7 | Rules evaluated for compliance, not invocation |
| FR55 | Epic 7 | Path-scoped rules only evaluated when matching files touched |
| FR56 | Epic 7 | Directory copy for monorepo subdirectories |
| FR57 | Epic 8 | Configure static analysis commands per test suite |
| FR58 | Epic 8 | Execute static analysis commands, capture output |
| FR59 | Epic 8 | Parse linter/compiler output for error/warning counts |
| FR60 | Epic 8 | Compute code quality score 0-100 |
| FR61 | Epic 8 | Terminal: code quality results display |
| FR62 | Epic 8 | Code quality evaluator conforms to Evaluator interface |
| FR63 | Epic 8 | Identify touched files via workspace diff |
| FR64 | Epic 8 | Language-agnostic APP element counting |
| FR65 | Epic 8 | Compute weighted APP total per file |
| FR66 | Epic 8 | Compute per-file APP density |
| FR67 | Epic 8 | Compute relative APP delta vs. pre-session |
| FR68 | Epic 8 | Compute overall complexity score 0-100 |
| FR69 | Epic 8 | Terminal: complexity results display |
| FR70 | Epic 8 | Complexity evaluator conforms to Evaluator interface |

## Epic List

### Epic 1: First Evaluation Run
Developer can initialize Zelda, define a test suite, execute Claude Code in an isolated workspace, and see efficiency metrics (tokens, cost, turns, tool calls) in the terminal. Results are persisted for future comparison. This is the complete "first contact" — the minimum viable pipeline.
**FRs covered:** FR1-22, FR43-44, FR49, FR52
**NFRs addressed:** NFR1-3, NFR5-8, NFR9, NFR11, NFR13-16

### Epic 2: Intelligent Code Evaluation
Developer gets LLM-as-judge feedback on whether generated code meets acceptance criteria — per-criterion PASS/FAIL with reasoning and an overall fulfillment score. Adds the judge client (Portkey routing) and requirement fulfillment evaluator.
**FRs covered:** FR23-25, FR29-32, FR50
**NFRs addressed:** NFR10, NFR12

### Epic 3: Tool Usage Intelligence
Developer sees which Claude Code tools were used, which available tools were missed, and gets a utilization effectiveness assessment. Surfaces why a skill isn't being called or a rule is being ignored — Zelda's unique differentiator.
**FRs covered:** FR26-28, FR51

### Epic 4: Functional Correctness Verification
Developer can verify that generated code actually builds and tests pass, with optional coverage threshold checking. Moves beyond "does it look right" to "does it actually work."
**FRs covered:** FR33-38, FR53

### Epic 5: Compare & Iterate
Developer can list all past runs, retrieve full results, and compare any two runs side-by-side with numerical deltas and directional indicators. Enables the A/B testing workflow and systematic improvement loop.
**FRs covered:** FR45-48

### Epic 6: Transcript Management
System handles long Claude Code sessions gracefully — large transcripts are automatically chunked and evaluated incrementally without losing information. Ensures judge evaluations work reliably on complex tasks.
**FRs covered:** FR39-42
**NFRs addressed:** NFR4

### Epic 7: Post-Launch Fixes
Fixes and improvements discovered during real-world testing. Corrects rule evaluation logic in the tool usage evaluator, fixes workspace isolation for monorepo subdirectories, and resolves Portkey gateway compatibility issues.
**FRs covered:** FR54-56 (new), FR11-12, FR27-28, FR30 (updated)
**Stories:** 7.1 (rule compliance — DONE), 7.2 (monorepo workspace — DONE), 7.3 (Portkey fixes — DONE), 7.4 (task size + complexity fix — DONE), 7.5 (persistent workspaces — DONE), 7.6 (apply run changes — DONE)

### Epic 8: Code Quality & Complexity Analysis
Developer gets two new evaluation dimensions: (1) Code Quality — run external static analysis tools (ESLint, tsc, biome, etc.) and score based on errors/warnings, and (2) Code Complexity — measure generated code complexity using the APP (Absolute Priority Premise) weighted metric with per-file density and relative before/after deltas. Both metrics are language-agnostic and operate on files touched during the session.
**FRs covered:** FR57-70
**New metrics:** `codeQuality` (external tools), `complexity` (APP analysis)

## Epic 1: First Evaluation Run

Developer can initialize Zelda, define a test suite, execute Claude Code in an isolated workspace, and see efficiency metrics (tokens, cost, turns, tool calls) in the terminal. Results are persisted for future comparison.

### Story 1.1: Project Scaffolding & Foundation Types

As a **developer building Zelda**,
I want the project set up with build tooling, shared types, and error hierarchy,
So that all subsequent stories have a consistent foundation to build on.

**Acceptance Criteria:**

**Given** a new project directory
**When** `npm install` and `npm run build` are executed
**Then** the project compiles successfully with TypeScript strict mode, tsup produces `dist/cli.js` with shebang, and `vitest` runs (with no tests yet)

**Given** the shared types file exists
**When** a developer imports from `core/types.ts`
**Then** `EvalContext`, `EvalResult`, `ResolvedConfig`, `SessionTranscript`, `ToolsManifest`, and `RunResult` types are available

**Given** the errors file exists
**When** a developer imports from `core/errors.ts`
**Then** `ZeldaError`, `ConfigError`, `WorkspaceError`, `ExecutionError`, and `JudgeError` classes are available, each with `code` and `userMessage` properties

**Given** the CLI entry point exists
**When** `zelda --version` is run
**Then** the version number from package.json is displayed

### Story 1.2: Configuration System

As a **developer using Zelda**,
I want to define project configuration and test suites in YAML files with validation,
So that I can configure how Zelda runs evaluations with clear error messages on invalid input.

**Acceptance Criteria:**

**Given** a valid `zelda.config.yaml` with judgeModel, gatewayUrl, execution defaults, and results directory
**When** the config loader reads the file
**Then** it returns a validated config object matching the Zod schema (FR2)

**Given** a YAML file with invalid or missing required fields
**When** the config loader validates it
**Then** a `ConfigError` is thrown with a clear, human-readable message describing the validation failure (FR3)

**Given** a test suite YAML with prompt, acceptance criteria, execution parameters, and metric toggles
**When** the config loader reads the test suite
**Then** it returns a validated test suite object with all fields (FR6-9)

**Given** a project config and a test suite with overlapping settings
**When** the resolver merges them
**Then** test suite values override project defaults, and unset test suite values fall back to project defaults (FR4-5)

**Given** a `zelda/` directory with multiple `test-*.yaml` files
**When** the config loader discovers test suites
**Then** all matching files are loaded and validated (FR10)

### Story 1.3: Workspace Isolation

As a **developer using Zelda**,
I want each evaluation run to execute in an isolated workspace,
So that Zelda never modifies my working directory and cleans up after itself.

**Acceptance Criteria:**

**Given** a git repository
**When** the workspace manager creates a workspace for a run
**Then** a git worktree is created at `.zelda/workspaces/<run-id>/` containing a clean copy of the repo (FR11)

**Given** a non-git directory
**When** the workspace manager creates a workspace
**Then** it falls back to directory copy (FR12)

**Given** a completed or failed run
**When** the workspace cleanup runs
**Then** the worktree is removed and the directory is deleted (FR16)

**Given** a run is interrupted by Ctrl+C (SIGINT)
**When** the signal handler fires
**Then** workspace cleanup executes before exit (NFR16)

**Given** orphaned workspaces from a previous crash exist in `.zelda/workspaces/`
**When** `zelda run` starts
**Then** the sweeper detects and removes them before proceeding (NFR16)

**Given** any execution path (success, error, interrupt, crash recovery)
**When** the workspace lifecycle completes
**Then** no files in the developer's working directory are modified (NFR13)

### Story 1.4: Claude Code Execution

As a **developer using Zelda**,
I want Zelda to execute a Claude Code session in the isolated workspace,
So that I get a structured transcript of everything Claude Code did.

**Acceptance Criteria:**

**Given** a valid test suite with a prompt and an isolated workspace
**When** the execution client runs a Claude Code session via Claude Agent SDK
**Then** a structured `SessionTranscript` is returned containing all tool calls, inputs, outputs, and responses (FR13-14)

**Given** a completed Claude Code session
**When** the execution client returns metadata
**Then** cost in USD, token counts (input/output), turn count, and wall-clock duration are captured (FR15)

**Given** the execution client module
**When** external code imports it
**Then** no Claude Agent SDK types leak beyond the module boundary — only Zelda-owned types are exposed (NFR11)

**Given** an API key for Claude Agent SDK
**When** credentials are used
**Then** `ANTHROPIC_API_KEY` is read from environment, never stored in results or logs (NFR5-7)

### Story 1.5: Efficiency Evaluator

As a **developer using Zelda**,
I want to see efficiency metrics for my Claude Code session,
So that I know how many tokens, dollars, turns, and tool calls were used.

**Acceptance Criteria:**

**Given** a `SessionTranscript` with metadata
**When** the efficiency evaluator runs
**Then** it returns an `EvalResult` with score 0-100, containing: total tokens (input + output), API cost in USD, turn count, wall-clock duration, tool call counts grouped by type, and error/retry count (FR18-22)

**Given** the efficiency evaluator
**When** it conforms to the `Evaluator` type signature
**Then** it accepts `EvalContext` and returns `Promise<EvalResult>` with `metric: "efficiency"`

**Given** a transcript with no errors
**When** error count is computed
**Then** the count is 0

### Story 1.6: Result Persistence

As a **developer using Zelda**,
I want run results saved to disk,
So that I can review past runs and compare them later.

**Acceptance Criteria:**

**Given** a completed evaluation with an `EvalResult`
**When** the result store persists the run
**Then** `result.json` is written to `.zelda/runs/<run-id>/` containing id, timestamp, test suite config snapshot, and all metric scores (FR43)

**Given** a completed evaluation with a `SessionTranscript`
**When** the result store persists the run
**Then** `transcript.json` is written separately in the same run directory

**Given** any run
**When** a run ID is generated
**Then** it follows the format `<test-name>-<timestamp>` and is unique (FR44)

**Given** a write operation
**When** the result store saves a file
**Then** it writes to a temp file first and renames atomically — the file is either complete and valid JSON, or not written at all (NFR15)

**Given** a persisted result
**When** the result.json is inspected
**Then** it contains no API keys, raw credentials, or secrets (NFR8)

### Story 1.7: Terminal Reporter

As a **developer using Zelda**,
I want to see evaluation results in a formatted, colored terminal display,
So that I can quickly understand how my Claude Code session performed.

**Acceptance Criteria:**

**Given** an `EvalResult` from the efficiency evaluator
**When** the terminal reporter displays results
**Then** tokens, cost, turns, duration, tool call breakdown, and error count are shown in vitest-style colored output (FR49, FR52)

**Given** the terminal output
**When** formatting is applied
**Then** green = pass/success, red = fail/error, yellow = warning, cyan = labels/info, dim = secondary info (timestamps, IDs)

**Given** metric values
**When** displayed in the terminal
**Then** percentages show one decimal place, labels are consistently aligned, and section headers use bold formatting

**Given** any terminal output
**When** the output is rendered
**Then** no emojis are used

### Story 1.8: Run Pipeline & CLI Command

As a **developer using Zelda**,
I want to run `zelda run` to execute the full evaluation pipeline,
So that I can evaluate a test suite end-to-end with a single command.

**Acceptance Criteria:**

**Given** a configured Zelda project with at least one test suite
**When** `zelda run` is executed
**Then** the pipeline runs: config load → workspace create → Claude Code execute → efficiency evaluate → persist results → display report → cleanup workspace (FR17)

**Given** `zelda run test-name`
**When** a specific test suite name is provided
**Then** only that test suite is executed (FR17)

**Given** `zelda run` without a test name
**When** multiple test suites exist
**Then** all discovered test suites are executed sequentially (FR17)

**Given** workspace cleanup
**When** the run completes
**Then** results are displayed before cleanup begins — cleanup does not block the user from seeing results (NFR3)

**Given** framework overhead (config loading, workspace creation, result persistence, reporting)
**When** measured
**Then** it completes within seconds — the dominant time is the Claude Code session itself (NFR1)

**Given** a run that fails mid-execution
**When** an error occurs
**Then** partial results are preserved, workspace is cleaned up, and exit code is 2 (NFR14)

### Story 1.9: Init Command

As a **developer new to Zelda**,
I want to run `zelda init` to set up my project,
So that I get a working config file and example test suite without manual setup.

**Acceptance Criteria:**

**Given** a project directory without Zelda configuration
**When** `zelda init` is executed
**Then** `zelda.config.yaml` is created with sensible defaults, `zelda/` directory is created, and `zelda/test-example.yaml` is created with a sample prompt and acceptance criteria (FR1)

**Given** an existing `zelda.config.yaml`
**When** `zelda init` is run
**Then** the user is warned that config already exists and asked to confirm overwrite

**Given** the generated example test suite
**When** a developer reads it
**Then** it clearly demonstrates the YAML structure with a realistic example prompt and 3-5 sample acceptance criteria

**Given** the generated config
**When** a developer reads it
**Then** it includes commented explanations for each field and `.zelda/` is noted as needing to be added to `.gitignore`

## Epic 2: Intelligent Code Evaluation

Developer gets LLM-as-judge feedback on whether generated code meets acceptance criteria — per-criterion PASS/FAIL with reasoning and an overall fulfillment score.

### Story 2.1: Judge Client & Gateway Configuration

As a **developer using Zelda**,
I want judge LLM calls routed through a configurable gateway,
So that I can control which model evaluates my code and route through Portkey.

**Acceptance Criteria:**

**Given** a `zelda.config.yaml` with `judgeModel` and `gatewayUrl` settings
**When** the judge client is initialized
**Then** it uses the configured model and routes calls through the specified Portkey endpoint (FR29-30)

**Given** gateway credentials (`PORTKEY_API_KEY`, `PORTKEY_GATEWAY_URL`)
**When** the judge client reads credentials
**Then** they are read from environment variables, separate from `ANTHROPIC_API_KEY` used for execution (FR31)

**Given** the judge client module
**When** external code imports it
**Then** no Anthropic SDK types leak beyond the module — only Zelda-owned types (`JudgeResponse`, etc.) are exposed (NFR11)

**Given** a judge API call that fails
**When** the error is transient (network timeout, rate limit)
**Then** the system retries with backoff before throwing `JudgeError` (FR32)

**Given** a judge API call that fails after retries
**When** the error is final
**Then** a `JudgeError` is thrown with a clear `userMessage` and the system degrades gracefully — no data loss of captured transcript (NFR12)

### Story 2.2: Requirement Fulfillment Evaluator

As a **developer using Zelda**,
I want my generated code evaluated against each acceptance criterion,
So that I know exactly which requirements were met and which weren't — with reasoning.

**Acceptance Criteria:**

**Given** generated code from a Claude Code session and acceptance criteria from the test suite
**When** the requirement fulfillment evaluator runs
**Then** the code and criteria are sent to the LLM judge for evaluation (FR23)

**Given** a judge response for requirement fulfillment
**When** the evaluation completes
**Then** each acceptance criterion has an individual PASS/FAIL result with reasoning explaining why (FR24)

**Given** per-criterion results
**When** the overall score is computed
**Then** it equals the percentage of criteria that passed (e.g., 4/5 = 80.0%) normalized to 0-100 (FR25)

**Given** the requirement fulfillment evaluator
**When** it conforms to the `Evaluator` type
**Then** it accepts `EvalContext` and returns `Promise<EvalResult>` with `metric: "requirementFulfillment"` and `details` containing per-criterion breakdown

**Given** a completed fulfillment evaluation
**When** the pipeline orchestrates evaluators
**Then** the fulfillment evaluator runs alongside the existing efficiency evaluator and results are persisted together

### Story 2.3: Fulfillment Terminal Display

As a **developer using Zelda**,
I want to see requirement fulfillment results in the terminal,
So that I can quickly identify which criteria passed and understand the reasoning for failures.

**Acceptance Criteria:**

**Given** a fulfillment `EvalResult` with per-criterion PASS/FAIL
**When** the terminal reporter displays fulfillment results
**Then** each criterion is shown with PASS (green) or FAIL (red), its reasoning, and the overall score as a percentage (FR50)

**Given** a run with both efficiency and fulfillment results
**When** the terminal reporter displays all results
**Then** both metric sections are shown in a consistent vitest-style layout with clear section headers

## Epic 3: Tool Usage Intelligence

Developer sees which Claude Code tools were used, which available tools were missed, and gets a utilization effectiveness assessment.

### Story 3.1: Tools Manifest & Tool Usage Evaluator

As a **developer using Zelda**,
I want Zelda to analyze whether Claude Code effectively used my available tools,
So that I can discover when skills aren't being invoked or rules are being ignored.

**Acceptance Criteria:**

**Given** a workspace with a `.claude/` directory containing skills, rules, sub-agents, or MCP configurations
**When** the pipeline assembles the `EvalContext`
**Then** it builds a `ToolsManifest` by scanning the `.claude/` directory and listing all available tools (FR26)

**Given** a `ToolsManifest` and a `SessionTranscript`
**When** the tool usage evaluator runs
**Then** the manifest and transcript are sent to the LLM judge for analysis (FR27)

**Given** a judge response for tool usage
**When** the evaluation completes
**Then** the result identifies: tools used (with invocation frequency), tools that should have been used but weren't, and an overall utilization effectiveness score 0-100 (FR28)

**Given** the tool usage evaluator
**When** it conforms to the `Evaluator` type
**Then** it accepts `EvalContext` and returns `Promise<EvalResult>` with `metric: "toolUsage"`

**Given** a workspace without a `.claude/` directory
**When** the manifest scanner runs
**Then** it returns an empty manifest and the tool usage evaluator handles this gracefully (score reflects "no tools available")

### Story 3.2: Tool Usage Terminal Display

As a **developer using Zelda**,
I want to see tool usage analysis in the terminal,
So that I can immediately identify which tools were used, which were missed, and act on it.

**Acceptance Criteria:**

**Given** a tool usage `EvalResult`
**When** the terminal reporter displays tool usage results
**Then** it shows: tools called (with frequency), tools missed (highlighted in yellow/red), utilization assessment, and the overall score (FR51)

**Given** a run with efficiency, fulfillment, and tool usage results
**When** the terminal reporter displays all results
**Then** all three metric sections are shown consistently

## Epic 4: Functional Correctness Verification

Developer can verify that generated code actually builds and tests pass, with optional coverage threshold checking.

### Story 4.1: Build & Test Runner

As a **developer using Zelda**,
I want Zelda to run build and test commands on the generated code,
So that I can verify the code actually compiles and tests pass — not just "looks right."

**Acceptance Criteria:**

**Given** a test suite with a `buildCommand` configured (e.g., `npm run build`)
**When** the functional correctness evaluator runs
**Then** it executes the build command in the workspace and reports pass/fail based on exit code (FR33-34)

**Given** a test suite with a `testCommand` configured (e.g., `npm test`)
**When** the evaluator runs the test command
**Then** it parses the output to extract pass/fail counts (FR35-36)

**Given** a test suite with a `coverageThreshold` configured
**When** coverage data is available from the test run
**Then** the evaluator reports coverage percentage and whether it meets the threshold (FR37-38)

**Given** a test suite without build/test commands configured
**When** the functional correctness evaluator runs
**Then** it skips gracefully and returns a result indicating "not configured" (score omitted per null-handling pattern)

**Given** the functional correctness evaluator
**When** it conforms to the `Evaluator` type
**Then** it accepts `EvalContext` and returns `Promise<EvalResult>` with `metric: "functionalCorrectness"` containing build status, test counts, and coverage

**Given** functional correctness in the pipeline
**When** it runs
**Then** it executes sequentially (subprocess in workspace), not in parallel with judge calls

### Story 4.2: Functional Correctness Terminal Display

As a **developer using Zelda**,
I want to see build/test results in the terminal,
So that I know immediately whether the generated code compiles and passes tests.

**Acceptance Criteria:**

**Given** a functional correctness `EvalResult`
**When** the terminal reporter displays results
**Then** build status (PASS green / FAIL red), test pass/fail counts, and coverage percentage are shown (FR53)

**Given** a run with all four metrics
**When** the terminal reporter displays results
**Then** all metric sections (efficiency, fulfillment, tool usage, functional correctness) are shown in consistent layout

## Epic 5: Compare & Iterate

Developer can list all past runs, retrieve full results, and compare any two runs side-by-side with numerical deltas and directional indicators.

### Story 5.1: List & Retrieve Runs

As a **developer using Zelda**,
I want to list all past evaluation runs and retrieve their details,
So that I can browse my evaluation history and review any past run.

**Acceptance Criteria:**

**Given** multiple runs persisted in `.zelda/runs/`
**When** `zelda list` is executed
**Then** all runs are displayed with date, test suite name, and key scores (fulfillment %, tool usage %, efficiency summary) sorted by date descending (FR45)

**Given** a run ID
**When** `zelda list` displays the run
**Then** the full result can be retrieved by its identifier without loading the transcript (FR46)

**Given** no past runs exist
**When** `zelda list` is executed
**Then** a helpful message is displayed (e.g., "No runs found. Run `zelda run` to create your first evaluation.")

### Story 5.2: Compare Command

As a **developer using Zelda**,
I want to compare two evaluation runs side-by-side,
So that I can see exactly which metrics improved or regressed after a configuration change.

**Acceptance Criteria:**

**Given** two valid run IDs
**When** `zelda compare <run1> <run2>` is executed
**Then** both runs' metrics are displayed side-by-side with numerical deltas for every metric (FR47)

**Given** a comparison result
**When** deltas are displayed
**Then** directional indicators show which run performed better per metric (e.g., `+12.5%` in green, `-3 turns` in red) (FR48)

**Given** an invalid run ID
**When** `zelda compare` is executed
**Then** a clear error message identifies which run ID was not found

**Given** two runs with different metrics available (e.g., one has fulfillment, the other doesn't)
**When** comparison is displayed
**Then** missing metrics are shown as "N/A" rather than failing

## Epic 6: Transcript Management

System handles long Claude Code sessions gracefully — large transcripts are automatically chunked and evaluated incrementally without losing information.

### Story 6.1: Transcript Chunking & Synthesis

As a **developer using Zelda**,
I want large Claude Code transcripts handled automatically,
So that judge evaluations work reliably even for complex, long-running sessions.

**Acceptance Criteria:**

**Given** a transcript that fits within the judge LLM's context capacity
**When** the transcript manager evaluates size
**Then** it routes the transcript directly to the judge — single call, full fidelity (FR42)

**Given** a transcript that exceeds the judge LLM's context capacity
**When** the transcript manager detects this
**Then** it splits the transcript at turn boundaries using the token budget (80% of context limit), never splitting mid-turn (FR39-40)

**Given** chunked transcript evaluation
**When** each chunk is evaluated independently
**Then** incremental results are synthesized into a cohesive final assessment without losing critical information (FR41)

**Given** chunked vs single-call evaluation
**When** overhead is measured
**Then** chunked evaluation adds no more than 2x overhead compared to single-call (NFR4)

**Given** token estimation
**When** the transcript manager estimates size
**Then** it uses a character-count heuristic (chars / 4) — precision is not critical

**Given** the transcript manager
**When** integrated with requirement fulfillment and tool usage evaluators
**Then** both judge-based evaluators use transcript management transparently — chunking is applied when needed without evaluator changes

## Epic 7: Post-Launch Fixes

Fixes and improvements discovered during real-world testing of the evaluation pipeline. Addresses correctness issues in evaluators, workspace isolation for monorepo projects, and gateway compatibility.

**FRs updated:** FR11-12, FR27-28, FR30
**New FRs:** FR54-56

### Story 7.1: Differentiate Rule Compliance from Tool Invocation in Tool Usage Evaluator

As a **developer using Zelda**,
I want the tool usage evaluator to distinguish between invocable tools (skills, sub-agents, MCP) and implicit context (rules),
So that rules are evaluated by output compliance rather than transcript invocation — producing accurate scores.

**Context:**
Claude Code rules (`.claude/rules/*.md`) are automatically loaded into the LLM context at session startup. They are not explicitly invoked via tool calls — they are implicit memory. The current evaluator treats all manifest entries the same way (checking for transcript invocation), which incorrectly penalizes rules as "missed tools" even when the output code fully complies with the rule's guidance. This was confirmed during live testing: the rate-limiter run scored 60% on tool usage because the judge flagged rules as "not invoked," despite the code following both `typescript-strict` and `error-handling` rules.

**Acceptance Criteria:**

**Given** a workspace with `.claude/rules/*.md` files
**When** the tool usage evaluator runs
**Then** rules are evaluated for **compliance** (did the output follow the rule?) not **invocation** (was the rule called as a tool?)

**Given** a workspace with both rules and skills/sub-agents
**When** the evaluator produces results
**Then** the result separates `invokedTools` (skills, sub-agents, MCP with invocation frequency) from `ruleCompliance` (rules with compliance assessment per rule)

**Given** rules that were followed implicitly
**When** the score is computed
**Then** followed rules contribute positively to the score, not penalized as "missed tools"

**Given** a rule scoped with `paths:` frontmatter
**When** the evaluator checks compliance
**Then** it only evaluates compliance for rules whose path patterns match files touched in the session

**Given** the judge prompt for tool usage
**When** it evaluates rules vs. invocable tools
**Then** it uses different evaluation criteria: "Was this rule's guidance reflected in the code?" for rules vs. "Was this tool explicitly called?" for skills/sub-agents

**Given** a workspace with no rules but with skills
**When** the evaluator runs
**Then** only invocation-based evaluation is performed (no rule compliance section)

**Technical Notes:**
- Rules with `paths:` YAML frontmatter are conditionally loaded — only applied when working with matching files
- Rules without `paths:` frontmatter are always active (global rules)
- The manifest scanner already reads rule content summaries; extend to parse `paths:` frontmatter
- The judge prompt must clearly separate the two evaluation modes in a single call
- Result schema change: `ToolUsageDetails` gains `ruleCompliance` alongside existing `usedTools`/`missedTools`

### Story 7.2: Workspace Isolation for Monorepo Subdirectories

As a **developer using Zelda in a monorepo**,
I want workspace creation to correctly isolate my project subdirectory,
So that Claude Code works on my project files, not the entire monorepo.

**Context:**
When `projectDir` is a subdirectory of a git repository (e.g., `monorepo/packages/my-api/`), `git worktree add` checks out the entire repository — not just the subdirectory. Claude Code then sees the wrong codebase and wastes turns exploring unrelated files. Discovered during live testing with `examples/rest-api/` inside the Zelda repo.

**Acceptance Criteria:**

**Given** a project directory that is the git repository root
**When** workspace creation runs
**Then** git worktree is used (existing behavior)

**Given** a project directory that is a subdirectory of a git repository
**When** workspace creation runs
**Then** directory copy is used instead of git worktree, copying only the project subdirectory

**Given** workspace cleanup for a directory-copy workspace
**When** cleanup runs
**Then** the directory is removed without attempting git worktree removal

**Status:** DONE — implemented in this session (changed `isGitRepo` to `isGitRepoRoot` comparing `git rev-parse --show-toplevel` against `projectDir`)

### Story 7.3: Portkey Gateway Compatibility Fixes

As a **developer routing judge calls through Portkey**,
I want the judge client to authenticate correctly with Portkey's API,
So that LLM judge evaluations work when using Portkey as a gateway.

**Context:**
Two issues discovered during live testing:
1. The Anthropic SDK sends API keys as `x-api-key` header, but Portkey expects `x-portkey-api-key`. The judge client needed to detect Portkey and use `defaultHeaders`.
2. The Anthropic SDK appends `/v1/messages` to the `baseURL`. If the user configures `gatewayUrl: https://api.portkey.ai/v1`, the SDK calls `https://api.portkey.ai/v1/v1/messages` (doubled path). The `gatewayUrl` must omit the `/v1` suffix.

**Acceptance Criteria:**

**Given** a `gatewayUrl` containing "portkey"
**When** the judge client creates an Anthropic SDK instance
**Then** the `PORTKEY_API_KEY` is sent via the `x-portkey-api-key` header, not as the SDK's `apiKey`

**Given** a `gatewayUrl` configured as `https://api.portkey.ai`
**When** the judge client makes an API call
**Then** the request goes to `https://api.portkey.ai/v1/messages` (correct path)

**Given** a `gatewayUrl` without "portkey" in the hostname
**When** the judge client creates an Anthropic SDK instance
**Then** standard Anthropic SDK authentication is used (existing behavior)

**Status:** DONE — implemented in this session (Portkey detection + `defaultHeaders` in `createClient`)

## Epic 8: Code Quality & Complexity Analysis

Developer gets two new evaluation dimensions: (1) Code Quality — run external static analysis tools (ESLint, tsc, biome, etc.) and score based on errors/warnings, and (2) Code Complexity — measure generated code complexity using the APP (Absolute Priority Premise) weighted metric with per-file density and relative before/after deltas. Both metrics are language-agnostic and operate on files touched during the session.

### Story 8.1: Code Quality Evaluator

As a **developer using Zelda**,
I want Zelda to run my static analysis tools on generated code and score the results,
So that I know whether Claude Code produced code that passes my linting and type-checking standards.

**Acceptance Criteria:**

**Given** a test suite with `staticAnalysis` configured as a list of commands (e.g., `["npx eslint .", "npx tsc --noEmit"]`)
**When** the code quality evaluator runs
**Then** each command is executed in the workspace and exit code, stdout, and stderr are captured (FR57-58)

**Given** the output of a static analysis command
**When** the evaluator parses the result
**Then** it extracts error count and warning count from stdout/stderr (FR59)

**Given** parsed error and warning counts from all configured commands
**When** the overall score is computed
**Then** zero errors across all commands = 100, score decreases proportionally with errors, warnings have lower weight than errors (FR60)

**Given** the code quality evaluator
**When** it conforms to the `Evaluator` type
**Then** it accepts `EvalContext` and returns `Promise<EvalResult>` with `metric: "codeQuality"` and `details` containing per-command results (command, exitCode, errors, warnings) (FR62)

**Given** a test suite without `staticAnalysis` configured
**When** the code quality evaluator runs
**Then** it skips gracefully and returns a result indicating "not configured"

**Given** a static analysis command that fails to execute (e.g., tool not installed)
**When** the error is caught
**Then** the evaluator reports the failure for that command without crashing the entire evaluation

**Given** code quality evaluation in the pipeline
**When** it runs
**Then** it executes sequentially (subprocess in workspace), like functional correctness — not in parallel with judge calls

**Technical Notes:**
- Schema extension: add optional `staticAnalysis: string[]` to test suite Zod schema
- Similar execution pattern to `functional-correctness.ts` (subprocess in workspace)
- New file: `src/core/evaluators/code-quality.ts`
- Test file: `tests/core/evaluators/code-quality.test.ts`

### Story 8.2: Code Complexity Evaluator (APP)

As a **developer using Zelda**,
I want Zelda to measure the complexity of code Claude Code generated using the APP weighted metric,
So that I can track whether Claude Code produces simple, maintainable code — and whether changes made it more or less complex.

**Acceptance Criteria:**

**Given** a completed Claude Code session in a workspace
**When** the complexity evaluator identifies touched files
**Then** it detects all files that were created or modified during the session by diffing workspace state against pre-session state (FR63)

**Given** a git worktree workspace
**When** touched files are identified
**Then** `git diff` is used to detect modifications and `git status` for new untracked files

**Given** a directory-copy workspace
**When** touched files are identified
**Then** a file snapshot taken before execution is compared against post-execution state

**Given** a touched source file in any programming language
**When** the APP parser analyzes it
**Then** it counts elements using language-agnostic pattern detection: constants (literals, strings), calls (function/method invocations), conditions (if/switch/ternary), loops (for/while/map/reduce/forEach), assignments (variable mutations) (FR64)

**Given** element counts for a file
**When** the weighted APP total is computed
**Then** it applies the weight table: constants x1, calls x2, conditions x4, loops x5, assignments x6 — and sums the weighted values (FR65)

**Given** a file's weighted APP total
**When** per-file density is computed
**Then** density = weighted total / lines of code (excluding blank lines and comments) (FR66)

**Given** a file that existed before the session (modified, not new)
**When** the relative delta is computed
**Then** it compares pre-session APP density against post-session APP density, producing a signed delta (positive = more complex, negative = simpler) (FR67)

**Given** a file that is new (created during the session)
**When** the relative delta is computed
**Then** no delta is shown — only the absolute density is reported

**Given** per-file density values for all touched files
**When** the overall complexity score is computed
**Then** it produces a 0-100 score where lower average density = higher score, using a configurable density threshold for calibration (FR68)

**Given** the complexity evaluator
**When** it conforms to the `Evaluator` type
**Then** it accepts `EvalContext` and returns `Promise<EvalResult>` with `metric: "complexity"` and `details` containing per-file breakdown (file path, element counts, weighted total, LOC, density, delta) (FR70)

**Given** a workspace where no source files were touched
**When** the complexity evaluator runs
**Then** it returns a result indicating "no source files modified" with no score

**Given** non-source files (images, JSON, YAML, markdown, lock files)
**When** the evaluator scans touched files
**Then** they are excluded from APP analysis — only source code files are parsed

**Technical Notes:**
- Pre-session snapshot: for git worktrees, use git to diff; for directory copies, snapshot file hashes + content before execution
- Language-agnostic patterns: regex-based detection covering common languages (JS/TS, Python, Go, Rust, Java, C#, Ruby, etc.)
- The APP parser should be a separate internal module for testability (`src/core/evaluators/app-parser.ts`)
- New files: `src/core/evaluators/complexity.ts`, `src/core/evaluators/app-parser.ts`
- Test files: `tests/core/evaluators/complexity.test.ts`, `tests/core/evaluators/app-parser.test.ts`
- Pipeline integration: runs synchronously (pure computation, no subprocess or network I/O)

### Story 8.3: Code Quality & Complexity Terminal Display

As a **developer using Zelda**,
I want to see code quality and complexity results in the terminal,
So that I can immediately understand lint compliance and code complexity at a glance.

**Acceptance Criteria:**

**Given** a code quality `EvalResult` with per-command results
**When** the terminal reporter displays code quality results
**Then** it shows: each command with PASS (green) / FAIL (red), error count, warning count, and the overall code quality score as a percentage (FR61)

**Given** a complexity `EvalResult` with per-file breakdown
**When** the terminal reporter displays complexity results
**Then** it shows: each touched file with element counts (constants, calls, conditions, loops, assignments), weighted APP total, LOC, and density (FR69)

**Given** a complexity result with relative deltas
**When** modified files are displayed
**Then** the density delta is shown with directional indicators: positive delta (more complex) in red, negative delta (simpler) in green, zero delta in dim

**Given** a complexity result with new files (no pre-session state)
**When** new files are displayed
**Then** density is shown without a delta indicator — only the absolute value

**Given** a run with all six metrics (efficiency, fulfillment, tool usage, functional correctness, code quality, complexity)
**When** the terminal reporter displays all results
**Then** all metric sections are shown in consistent vitest-style layout with clear section headers

**Given** a code quality result indicating "not configured"
**When** the terminal reporter displays results
**Then** the code quality section is omitted (not shown as empty or zero)

**Given** a complexity result indicating "no source files modified"
**When** the terminal reporter displays results
**Then** the complexity section shows an informational message rather than an empty table

**Given** the compare command with two runs that include code quality and complexity metrics
**When** deltas are computed
**Then** code quality score delta and complexity score delta are shown alongside existing metric deltas with directional indicators

**Technical Notes:**
- Follow existing chalk color conventions: green=pass, red=fail, yellow=warning, cyan=info, dim=secondary
- No emojis — clean professional output
- Percentages: one decimal place (e.g., `85.0%`)
- Density values: two decimal places (e.g., `3.45`)
- Update `src/core/reporter/terminal.ts` with new sections
- Update `src/core/reporter/compare.ts` to include new metric deltas
- Tests: update `tests/core/reporter/terminal.test.ts` and `tests/core/reporter/compare.test.ts`
