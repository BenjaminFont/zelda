# cc-eval: Claude Code Tooling Evaluation Framework

## Complete Design Document — Thought Process, Decisions & Implementation Plan

---

## 1. The Problem

When building software with Claude Code, developers invest significant effort in crafting an ecosystem of tooling: rule files that define coding patterns, sub-agents for specialized tasks (like frontend development or testing), skills for repeatable workflows, MCP servers for external integrations, CLAUDE.md files for project context, and complex multi-step workflows. This tooling ecosystem directly shapes the quality of code that Claude Code produces.

**The core problem: there's no way to measure if your tooling is actually good.**

Developers iterate blindly. They tweak a rule file, rewrite a skill, add a sub-agent — but they have no systematic way to know if these changes made Claude Code's output better or worse. Did the new "react-patterns" rule file actually improve the frontend code quality? Did adding a testing sub-agent result in better test coverage? Does the CLAUDE.md file give enough context for Claude Code to meet requirements?

Today, the only feedback loop is manual: run Claude Code, eyeball the output, and make a gut-level judgment. This doesn't scale, isn't reproducible, and makes A/B comparison between configurations nearly impossible.

### What we want instead

A framework that works like **vitest/pytest but for Claude Code's tooling ecosystem**:

1. **Define a requirement** (e.g., "Build a React todo app with these features")
2. **Run Claude Code** with your current tooling configuration (rules, skills, sub-agents, etc.)
3. **Automatically evaluate** the output across multiple dimensions
4. **Get measurable scores** that you can track over time and compare between configurations
5. **Iterate** — tweak your tooling, re-run, see if the scores improve

This creates a tight, data-driven feedback loop for prompt engineering at the tooling level.

---

## 2. Exploring the Existing llm-eval Repository

Before deciding to build fresh, we thoroughly analyzed the existing `llm-eval` repository to see if it could serve as a foundation.

### What llm-eval does

llm-eval is a production-grade LLM evaluation platform built with:
- **Backend**: FastAPI + Celery + PostgreSQL + SQLAlchemy (async)
- **Frontend**: Next.js 15 + HeroUI + TanStack Query + ECharts
- **Auth**: Keycloak with JWT
- **Evaluation**: DeepEval library for text-based metrics

Its workflow: Upload documents → Generate Q&A pairs via RAGAS → Send questions to an LLM API → Evaluate text responses with metrics like Answer Relevancy, Faithfulness, Hallucination, G-Eval → Dashboard with trends and comparisons.

### The gap between llm-eval and our vision

| Dimension | llm-eval (current) | cc-eval (our vision) |
|-----------|--------------------|-----------------------|
| **What's evaluated** | A single LLM's text responses | Claude Code's full coding output (files, project structure) |
| **What's being tested** | LLM model quality | The tooling ecosystem (rules, skills, sub-agents, MCP, CLAUDE.md) |
| **Input** | Q&A pairs (question → expected answer) | Software requirements with acceptance criteria |
| **Execution** | Single API call to LLM endpoint | Full Claude Code session (multi-turn, tool-using agent) |
| **Output** | Text response | An entire codebase / set of file changes |
| **Metrics** | Text similarity (relevancy, faithfulness) | Code quality, requirement fulfillment, tool usage, functional correctness |

### What could be reused

The **infrastructure patterns** are solid: plugin architecture for metrics, async task processing, dashboard visualization, auth, encryption, versioning. These are good patterns to learn from.

### Decision: Fresh start

We decided to start from scratch because:

1. **The core domain is fundamentally different.** Q&A text evaluation vs. code generation evaluation — the data models, execution pipeline, metrics, and evaluation logic would all need to be rewritten. Keeping the old code around would just add confusion.

2. **Different tool shape.** llm-eval is a full web application (FastAPI + Next.js + PostgreSQL + Keycloak + RabbitMQ). Our tool is a CLI-first framework. The architectural needs are completely different — we don't need a database server, message broker, or auth system.

3. **Different audience.** llm-eval is designed for teams evaluating LLM models via a web UI. cc-eval is designed for individual developers iterating on their Claude Code configurations from the terminal.

4. **Clean slate advantage.** Starting fresh lets us design every layer specifically for our use case without being constrained by existing patterns that don't fit.

---

## 3. Brainstorming: How to Make This Measurable

The key challenge is defining metrics that meaningfully capture "how good was Claude Code's output?" We identified 5 orthogonal dimensions that together give a comprehensive picture.

### Dimension 1: Requirement Fulfillment

**The question**: Did Claude Code actually build what was asked for?

**Approach**: LLM-as-judge. We break the requirement into specific acceptance criteria (either manually defined in the test suite, or auto-decomposed by an LLM). After Claude Code generates code, a judge LLM reviews the generated files against each criterion and scores PASS/FAIL with reasoning.

**Why LLM-as-judge?** Requirement fulfillment is inherently subjective and context-dependent. A human reviewer would look at the code and judge "does this meet the requirement?" — an LLM judge does the same thing at scale. Static analysis can't determine if a todo app "lets users filter by status."

**Score**: Percentage of acceptance criteria met (e.g., 7/8 = 87.5%), plus per-criterion PASS/FAIL with reasoning for transparency.

### Dimension 2: Code Quality (Static Analysis)

**The question**: Is the generated code well-written, maintainable, and free of obvious issues?

**Approach**: Automated. Run standard linting and static analysis tools on the generated code — ESLint for JavaScript/TypeScript, tsc for type errors, Ruff/Pylint for Python, SonarQube rules for complexity. Parse the structured output.

**Why automated?** Code quality has well-established, objective tooling. No need for LLM judgment here — ESLint is more reliable and faster for catching lint issues. The framework is tool-agnostic: users configure which linters to run per test suite.

**Score**: Error count, warning count, files with issues. Can be configured with thresholds (e.g., "0 errors = pass").

### Dimension 3: Functional Correctness

**The question**: Does the code actually work?

**Approach**: Automated. Run the build command (does it compile?), test command (do tests pass? how many?), coverage check (what percentage?), and optionally a start command (does the app boot without crashing?).

**Why this matters**: Claude Code might generate code that looks good to a reviewer (passes requirement fulfillment) but doesn't actually compile or has broken tests. This metric catches that gap.

**Score**: Build pass/fail, test pass rate, coverage %, app starts yes/no.

### Dimension 4: Tool Usage Analysis

**The question**: Did Claude Code optimally use the available tools (skills, sub-agents, MCP servers, rules)?

**This is the most novel metric** and the one most specific to our use case. The whole point of cc-eval is to evaluate the tooling ecosystem. If you've built a "frontend-patterns" skill and a "testing" sub-agent, but Claude Code never calls them during a frontend task — that's a problem with your tooling configuration.

**Approach**: LLM-as-judge. We provide the judge with:
- The "tools manifest" — a listing of everything available in `.claude/` (skills, rules, sub-agents, MCP server configs)
- The full session transcript — every tool call Claude Code made, with inputs and outputs

The judge evaluates: Were the right tools used? Were any important tools missed? Were tools used effectively or wastefully?

**Why LLM-as-judge?** Determining "optimal tool usage" requires understanding what the tools do and whether they're relevant to the task. This is a judgment call that requires reasoning, not a rule-based check.

**Score**: Tools called (with frequency), tools missed (with reasoning), overall utilization score.

### Dimension 5: Efficiency

**The question**: How resource-efficient was the Claude Code session?

**Approach**: Computed directly from session telemetry (no LLM needed).

**Metrics**: Total tokens (input + output), API cost in USD, number of agentic turns, wall-clock duration, tool call counts by type (how many Read vs Edit vs Bash), error/retry count.

**Why raw numbers, not scores?** Efficiency is deeply context-dependent. A complex task requiring 100 turns and $5 might be perfectly efficient, while a simple task taking 50 turns and $3 might be wasteful. We report the numbers and let the developer interpret them, or compare between runs.

### Why these 5 dimensions?

Together they cover the full spectrum:
- **Did it meet the spec?** → Requirement Fulfillment
- **Is the code well-written?** → Code Quality
- **Does it actually work?** → Functional Correctness
- **Did it use the tools well?** → Tool Usage Analysis
- **Was it resource-efficient?** → Efficiency

No single metric tells the whole story. Claude Code might generate code that passes all tests (high functional correctness) but is poorly structured (low code quality) and never used the available skills (low tool utilization). The 5 dimensions together reveal where to focus improvement.

---

## 4. Key Design Decisions

### 4.1 CLI-first, not a web app

**Decision**: Build a command-line tool, not a web application.

**Why**:
- The target user is a developer iterating on their Claude Code setup. They live in the terminal.
- A CLI integrates naturally into development workflows and CI/CD pipelines.
- It eliminates the need for a database server, auth system, message broker, and frontend build — dramatically reducing complexity.
- We can always add a web viewer later (Phase 4+) for team dashboards and trend tracking.

**What this means**: Results are stored as JSON files on disk. Reports are generated as terminal output or HTML files. No server process needed.

### 4.2 TypeScript (full-stack)

**Decision**: Build in TypeScript, distribute as an npm package.

**Why**:
- Claude Code's ecosystem is JavaScript/TypeScript-native
- The Claude Agent SDK has a first-class TypeScript implementation (`@anthropic-ai/claude-agent-sdk`)
- TypeScript provides strong typing for the complex config schemas and metric types
- npm distribution means easy install: `npm install -D cc-eval` or `npx cc-eval`
- If a web viewer is added later, it's the same language across the stack

### 4.3 Claude Agent SDK over CLI --print

**Decision**: Use the TypeScript SDK (`@anthropic-ai/claude-agent-sdk`) to run Claude Code sessions, not `claude -p --output-format json`.

**Why**:
- The SDK gives structured TypeScript objects: `AssistantMessage` with `ToolUseBlock[]`, `ResultMessage` with `total_cost_usd`, `num_turns`, `usage`
- We get type-safe access to every tool call (name, input, output) without parsing text
- Hooks allow real-time monitoring during execution
- Custom permission handlers give fine-grained control
- Much better for building the transcript capture and tool usage analysis

**What the SDK provides**:
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Build a todo app...",
  options: {
    allowedTools: ["Read", "Edit", "Write", "Bash", "Glob", "Grep"],
    model: "sonnet",
    maxTurns: 50,
  }
})) {
  // AssistantMessage → contains ToolUseBlock[] (tool calls)
  // ResultMessage → contains cost, tokens, turns, duration
}
```

### 4.4 Isolated workspaces via git worktree

**Decision**: Each test run executes in an isolated copy of the repository, created via `git worktree`.

**Why we need isolation**:
- Claude Code modifies the filesystem (creates files, edits code, runs commands). Running directly in the developer's working directory would contaminate their actual project.
- Isolation enables reproducibility: each run starts from a clean state.
- Isolation enables parallelism: multiple test runs can execute simultaneously.
- Isolation enables A/B testing: different runs can have different `.claude/` configurations without conflicting.

**Why git worktree over clone**:
- Much faster: worktrees share the `.git` directory, so no copying of git history
- No network needed: works entirely locally
- Easy cleanup: `git worktree remove <path>`
- Falls back to directory copy for non-git repositories

**The concern we addressed**: Running Claude Code in a real repo risks destructive changes. Even with git, uncommitted work could be lost. The isolated workspace protects the developer's real working directory completely.

### 4.5 YAML for test definitions

**Decision**: Test suites are defined in YAML files.

**Why**:
- YAML handles multiline strings naturally (essential for prompts and acceptance criteria)
- Readable and widely understood
- Supports comments for documentation
- Zod validation catches schema errors early with helpful messages
- Easy to version control alongside the project

### 4.6 Plugin-style metric architecture

**Decision**: Each metric implements a simple `MetricPlugin` interface.

**Why**:
- Adding new metrics doesn't require changing the evaluation engine
- Metrics can be enabled/disabled per test suite
- Each metric is independently testable
- Opens the door for user-contributed metrics in the future

### 4.7 Both automated and manual execution modes

**Decision**: Support both running Claude Code automatically AND evaluating pre-existing code.

**Why**:
- Automated mode is the primary use case: define test, run Claude Code, evaluate
- Manual mode is valuable for: evaluating code Claude Code already generated (without re-running), testing the evaluation metrics themselves, integrating with other AI coding tools, debugging metric behavior

### 4.8 LLM-as-judge for subjective metrics

**Decision**: Use a separate LLM (configurable, defaults to Claude Sonnet) as a judge for requirement fulfillment and tool usage analysis.

**Why**:
- These metrics require understanding intent, not just pattern matching
- A judge LLM can reason about whether code "meets the requirement" or whether a tool "should have been used"
- The judge model is configurable — users can use a more capable model for higher-quality judgments, or a faster model for quicker iteration
- This approach is well-established in LLM evaluation research (LLM-as-judge paradigm)

---

## 5. Architecture Overview

```
cc-eval (npm package)
├── CLI Layer          → Commander.js commands (init, run, evaluate, compare, list, report)
├── Config Layer       → Zod-validated YAML config loading (project config + test suites)
├── Execution Layer    → Workspace isolation (git worktree) + Claude Code SDK runner
├── Evaluation Layer   → 5 metric plugins (requirement, code quality, functional, tool usage, efficiency)
├── Reporting Layer    → CLI terminal output, JSON persistence, HTML report generation
└── Utils              → LLM judge client, git operations, logger
```

### Data flow for a single test run

```
1. Load config (cc-eval.config.yaml + test-suite.yaml)
        ↓
2. Create isolated workspace (git worktree)
        ↓
3. Apply config overlay if specified (copy alternative .claude/ files)
        ↓
4. Execute Claude Code session via SDK (capture full transcript)
        ↓
5. Run evaluation metrics in parallel:
   ├── Requirement Fulfillment (LLM judge reviews generated code)
   ├── Code Quality (run linters in workspace)
   ├── Functional Correctness (run build/test commands)
   ├── Tool Usage Analysis (LLM judge reviews transcript)
   └── Efficiency (compute from session telemetry)
        ↓
6. Aggregate results into RunReport
        ↓
7. Display in terminal + save JSON to .cc-eval/runs/<id>/
        ↓
8. Cleanup workspace
```

### In the user's project after setup

```
my-project/
├── .claude/                    ← The tooling config BEING TESTED
│   ├── CLAUDE.md
│   ├── rules/
│   ├── skills/
│   └── ...
├── cc-eval.config.yaml         ← Framework configuration
├── cc-eval/                    ← Test suite definitions
│   ├── test-todo-app.yaml
│   └── test-auth-flow.yaml
├── .cc-eval/                   ← Results storage (gitignored)
│   └── runs/
│       └── <run-id>/
│           ├── transcript.json  ← Full session transcript
│           ├── metrics.json     ← All metric results
│           └── report.html      ← (optional) HTML report
└── src/                        ← Project source code
```

---

## 6. Config File Formats

### Project config: cc-eval.config.yaml

```yaml
version: 1
test_dir: "./cc-eval"
results_dir: "./.cc-eval/runs"

execution:
  model: "sonnet"
  max_turns: 100

workspace:
  strategy: "git-worktree"    # "git-worktree" | "clone"
  cleanup: true

judge:
  model: "claude-sonnet-4-5-20250929"
  api_key_env: "ANTHROPIC_API_KEY"

metrics:
  requirement_fulfillment: { enabled: true }
  code_quality: { enabled: true }
  functional: { enabled: false }
  tool_usage: { enabled: true }
  efficiency: { enabled: true }
```

### Test suite: cc-eval/test-todo-app.yaml

```yaml
name: "Todo App Frontend"
description: "Evaluate ability to build a React todo app"

prompt: |
  Create a React-based todo list application with:
  - Add, edit, delete todos
  - Mark as complete, filter by status
  - localStorage persistence, TypeScript, unit tests

acceptance_criteria:
  - "App renders a list of todo items"
  - "User can add new todos"
  - "User can mark todos as complete"
  - "User can delete todos"
  - "Filtering by all/active/completed works"
  - "Data persists via localStorage"
  - "Written in TypeScript"
  - "Unit tests pass"

# Optional: override .claude/ config for A/B testing
config:
  overrides:
    claude_md: "./cc-eval/configs/alt-claude.md"
    rules:
      - "./cc-eval/configs/rules/react-patterns.md"

execution:
  model: "sonnet"
  max_turns: 50

metrics:
  code_quality:
    linters:
      - name: "eslint"
        command: "npx eslint . --format json"
      - name: "typescript"
        command: "npx tsc --noEmit --pretty false 2>&1"
  functional:
    enabled: true
    commands:
      build: "npm run build"
      test: "npm run test -- --reporter=json"
```

---

## 7. Metrics Design (5 Dimensions)

### 7.1 Requirement Fulfillment (LLM-as-judge)
- **Input**: Prompt, acceptance criteria, full generated file listing with contents
- **Method**: Judge LLM evaluates each criterion → PASS/FAIL + reasoning
- **Score**: Percentage of criteria met (e.g., 7/8 = 87.5%)
- **Judge prompt structure**: "Given this requirement and these acceptance criteria, evaluate whether the following generated code meets each criterion. For each criterion, respond with PASS or FAIL and a brief explanation."

### 7.2 Code Quality (Automated static analysis)
- **Input**: Generated code in workspace
- **Method**: Run configured linters, parse structured output
- **Score**: Error count, warning count, complexity averages
- **Built-in parsers**: ESLint JSON format, TypeScript compiler output
- **Extensible**: Users can add any linter that outputs parseable text/JSON

### 7.3 Functional Correctness (Automated)
- **Input**: Generated code in workspace
- **Method**: Run build/test/start commands, parse exit codes and output
- **Score**: Build pass/fail, test pass rate, coverage %, app starts
- **Test output parsers**: Jest JSON reporter, Vitest JSON reporter, pytest JSON, generic exit code

### 7.4 Tool Usage Analysis (LLM-as-judge)
- **Input**: Available tools manifest (contents of .claude/), full session transcript (every tool call)
- **Method**: Judge evaluates optimal tool usage, missed opportunities, effectiveness
- **Score**: Tools called (with counts), tools missed (with reasoning), utilization score
- **Manifest construction**: Automatically reads `.claude/` directory — lists all skill names, rule file names, sub-agent definitions, MCP server configs

### 7.5 Efficiency (Computed from telemetry)
- **Input**: SDK session data (ResultMessage)
- **Metrics**: Total tokens, cost USD, turn count, duration, tool calls by type, errors/retries
- **Output**: Raw numbers (not scored — context-dependent)

---

## 8. CLI Commands

| Command | Description |
|---------|-------------|
| `cc-eval init` | Initialize cc-eval in a project (creates config + test dir) |
| `cc-eval run [test-name]` | Run test suite(s) with Claude Code execution + evaluation |
| `cc-eval run test-name --config-overlay ./path` | A/B test with different .claude/ config |
| `cc-eval evaluate --workspace ./path --test name` | Manual mode: evaluate existing code without running Claude Code |
| `cc-eval compare <run-id-1> <run-id-2>` | Side-by-side comparison of two runs |
| `cc-eval list` | List all past runs with summary |
| `cc-eval report <run-id> [--format html\|json]` | View or export a run report |

### Example terminal output

```
cc-eval v0.1.0

Running: Todo App Frontend
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Execution
  ✓ Workspace created (git worktree)
  ✓ Claude Code session completed (47 turns, 23.4s)
  ✓ Cost: $1.23 (input: 45,231 tokens, output: 12,456 tokens)

Requirement Fulfillment                    7/8 (87.5%)
  ✓ Application renders a list of todo items
  ✓ User can add new todos
  ✓ User can mark todos as complete
  ✓ User can delete individual todos
  ✓ User can filter todos by status
  ✓ Data persists across page reloads
  ✓ Application is written in TypeScript
  ✗ Unit tests are included and pass
    → Tests exist but 2 of 5 tests fail

Code Quality                               Score: 0.82
  ESLint:     3 errors, 12 warnings
  TypeScript: 0 errors
  Complexity: avg 4.2 (low)

Functional Correctness                     2/4
  ✓ Build succeeded
  ✗ Tests: 3/5 passing
  ✓ App starts successfully
  ✗ Coverage: 34% (below 80% threshold)

Tool Usage                                 Score: 0.75
  Skills called: frontend-patterns (3x), testing (1x)
  Missed: accessibility-checker skill (would have caught a11y issues)
  Sub-agents: view-development (2x)
  Effectiveness: Good use of frontend-patterns, underutilized testing skill

Efficiency
  Turns:  47
  Tokens: 57,687 (in: 45,231, out: 12,456)
  Cost:   $1.23
  Time:   23.4s
  Tools:  Read(12), Edit(8), Write(5), Bash(15), Glob(4), Grep(3)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Run ID: run-2024-01-15-001
Results saved to .cc-eval/runs/run-2024-01-15-001/
```

---

## 9. Tech Stack & Dependencies

| Category | Package | Purpose |
|----------|---------|---------|
| CLI | `commander` | Command parsing and help generation |
| Config | `zod`, `yaml` | Schema validation, YAML parsing |
| Execution | `@anthropic-ai/claude-agent-sdk` | Programmatic Claude Code sessions |
| LLM Judge | `@anthropic-ai/sdk` | Anthropic API calls for judge evaluations |
| Reporting | `chalk`, `cli-table3` | Terminal formatting and tables |
| Build | `tsup` | TypeScript bundling for npm package |
| Test | `vitest` | Framework's own unit/integration tests |
| Misc | `nanoid`, `glob`, `fs-extra` | IDs, file patterns, file operations |

---

## 10. Project Structure

```
cc-eval/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── src/
│   ├── cli/
│   │   ├── index.ts                    # Entry point, Commander setup
│   │   └── commands/
│   │       ├── init.ts                 # cc-eval init
│   │       ├── run.ts                  # cc-eval run [test]
│   │       ├── evaluate.ts             # cc-eval evaluate (manual mode)
│   │       ├── compare.ts              # cc-eval compare
│   │       ├── list.ts                 # cc-eval list
│   │       └── report.ts              # cc-eval report
│   ├── config/
│   │   ├── schema.ts                   # Zod schemas for all config types
│   │   ├── loader.ts                   # Load + validate YAML configs
│   │   └── types.ts                    # Inferred TypeScript types
│   ├── execution/
│   │   ├── workspace.ts                # Git worktree/clone isolation
│   │   ├── runner.ts                   # Claude Code SDK session runner
│   │   ├── config-overlay.ts           # Apply .claude/ overrides for A/B testing
│   │   ├── transcript.ts              # Parse SDK messages into structured transcript
│   │   └── types.ts
│   ├── evaluation/
│   │   ├── engine.ts                   # Orchestrates all metrics for a run
│   │   ├── metrics/
│   │   │   ├── base.ts                 # MetricPlugin interface
│   │   │   ├── requirement-fulfillment.ts
│   │   │   ├── code-quality.ts
│   │   │   ├── functional.ts
│   │   │   ├── tool-usage.ts
│   │   │   └── efficiency.ts
│   │   └── types.ts                    # Metric result types
│   ├── reporting/
│   │   ├── store.ts                    # JSON result persistence to disk
│   │   ├── cli-reporter.ts             # Terminal output (colored, tables)
│   │   ├── json-reporter.ts            # JSON export
│   │   └── html-reporter.ts            # HTML report generation
│   └── utils/
│       ├── llm-judge.ts                # Anthropic SDK wrapper for judge calls
│       ├── git.ts                      # Git worktree/clone operations
│       ├── process.ts                  # Child process helpers (linters, build)
│       └── logger.ts                   # Structured logging
├── templates/
│   ├── cc-eval.config.yaml             # Template for init command
│   ├── example-test.yaml               # Example test suite template
│   └── gitignore-addition.txt          # .cc-eval/ ignore entry
└── tests/
    ├── config/
    │   └── loader.test.ts
    ├── execution/
    │   └── workspace.test.ts
    ├── evaluation/
    │   └── engine.test.ts
    └── reporting/
        └── cli-reporter.test.ts
```

---

## 11. Implementation Phases

### Phase 1: Foundation (MVP)

**Goal**: A working CLI that can run a Claude Code session in an isolated workspace, capture the transcript, compute efficiency metrics, and display results in the terminal.

#### Step 1.1 — Project Scaffolding
- **Files**: `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`
- **package.json**: Set `bin: { "cc-eval": "./dist/cli/index.js" }`, configure `tsup` build
- **Dependencies**: `commander`, `zod`, `yaml`, `chalk`, `cli-table3`, `nanoid`, `fs-extra`, `glob`, `@anthropic-ai/claude-agent-sdk`, `@anthropic-ai/sdk`
- **Dev deps**: `tsup`, `vitest`, `typescript`, `@types/node`, `@types/fs-extra`
- **Verify**: `npm run build` produces `dist/`, `npx cc-eval --help` shows version

#### Step 1.2 — Config Layer
- **Files**: `src/config/schema.ts`, `src/config/loader.ts`, `src/config/types.ts`
- Define Zod schemas for `ProjectConfig` (cc-eval.config.yaml) and `TestSuite` (test YAML files)
- `loader.ts`: `loadProjectConfig(cwd)` → finds and parses cc-eval.config.yaml; `loadTestSuite(path)` → parses test YAML; `loadAllTestSuites(dir)` → loads all YAML in test dir
- Merge logic: test suite config overrides project-level defaults
- **Verify**: Unit tests with valid/invalid YAML fixtures

#### Step 1.3 — CLI Scaffolding
- **Files**: `src/cli/index.ts`, `src/cli/commands/init.ts`, `src/cli/commands/run.ts`, `src/cli/commands/list.ts`
- `index.ts`: Commander program with version, commands, global options
- `init.ts`: Creates `cc-eval.config.yaml` from template, creates `cc-eval/` dir with example test, adds `.cc-eval/` to `.gitignore`
- `run.ts`: Parses args, loads config, delegates to execution + evaluation
- `list.ts`: Reads `.cc-eval/runs/` directory, displays table of past runs
- **Verify**: `cc-eval init` creates expected files, `cc-eval run --help` shows options

#### Step 1.4 — Workspace Isolation
- **Files**: `src/execution/workspace.ts`, `src/utils/git.ts`
- `workspace.ts`: `createWorkspace(projectDir, strategy)` → creates git worktree (preferred) or temp clone; `cleanupWorkspace(path)` → removes worktree/clone
- `git.ts`: Wrappers for `git worktree add`, `git worktree remove`, `git clone --local`
- Handle edge cases: dirty working tree warning, non-git repos (fall back to directory copy)
- **Verify**: Creates worktree, files are isolated, cleanup removes it

#### Step 1.5 — Config Overlay (for A/B testing)
- **Files**: `src/execution/config-overlay.ts`
- `applyConfigOverlay(workspacePath, testSuiteConfig)`: Copies override files (claude_md, rules, skills) into workspace's `.claude/` directory
- Supports both individual file overrides and full `.claude/` directory replacement
- **Verify**: Overlay replaces correct files in workspace

#### Step 1.6 — Claude Code Execution
- **Files**: `src/execution/runner.ts`, `src/execution/transcript.ts`, `src/execution/types.ts`
- `runner.ts`: `runClaudeCode(options)` → uses `@anthropic-ai/claude-agent-sdk` `query()` function; captures all messages (AssistantMessage with ToolUseBlocks, ResultMessage with cost/tokens/turns); runs Claude Code with the workspace as cwd
- `transcript.ts`: Parses raw SDK messages into structured `SessionTranscript` with: tool calls (name, input, output), text responses, errors, and final result metadata
- `types.ts`: `SessionTranscript`, `ToolCall`, `RunResult`
- **Verify**: Can execute a simple prompt, transcript captures tool calls and result metadata

#### Step 1.7 — Efficiency Metrics
- **Files**: `src/evaluation/metrics/efficiency.ts`, `src/evaluation/metrics/base.ts`, `src/evaluation/types.ts`
- `base.ts`: `MetricPlugin` interface: `name`, `evaluate(context) → MetricResult`
- `efficiency.ts`: Extracts from `RunResult`: total tokens, cost, turns, duration, tool call counts grouped by tool name, error count
- `types.ts`: `EvaluationContext` (workspace path, transcript, test suite config), `MetricResult`, `RunReport`
- **Verify**: Given a transcript, produces correct efficiency numbers

#### Step 1.8 — Evaluation Engine + CLI Reporter + Storage
- **Files**: `src/evaluation/engine.ts`, `src/reporting/cli-reporter.ts`, `src/reporting/store.ts`
- `engine.ts`: `evaluate(context, enabledMetrics)` → runs each metric plugin, collects results into `RunReport`
- `cli-reporter.ts`: Formats `RunReport` as colored terminal output (like vitest output style)
- `store.ts`: `saveRun(runId, report)` → writes JSON to `.cc-eval/runs/<id>/`; `loadRun(runId)` → reads back; `listRuns()` → lists all run directories
- **Verify**: End-to-end: `cc-eval run test-name` produces terminal output + saved JSON

---

### Phase 2: Core Metrics

**Goal**: Add the three most valuable evaluation metrics beyond efficiency.

#### Step 2.1 — LLM Judge Utility
- **File**: `src/utils/llm-judge.ts`
- Wrapper around `@anthropic-ai/sdk` for making judge calls
- `judgeWithCriteria(prompt, criteria, code, model)` → returns per-criterion PASS/FAIL + reasoning
- `judgeToolUsage(manifest, transcript, model)` → returns tool usage analysis
- Handles retries, rate limiting, structured output parsing (JSON mode)
- **Verify**: Mock tests with expected judge responses

#### Step 2.2 — Requirement Fulfillment Metric
- **File**: `src/evaluation/metrics/requirement-fulfillment.ts`
- Collects all generated/modified files from the workspace (diff against baseline)
- Sends to judge with acceptance criteria
- Parses judge response: per-criterion PASS/FAIL, reasoning, overall score (% met)
- **Verify**: Unit test with mock judge, integration test with real API

#### Step 2.3 — Code Quality Metric
- **File**: `src/evaluation/metrics/code-quality.ts`
- Runs configured linter commands in the workspace via child process
- Parses JSON output from linters (ESLint JSON formatter, tsc output)
- Computes: error count, warning count, files with issues
- Extensible: each linter is a `{ name, command, parser }` config
- Built-in parsers for ESLint JSON and TypeScript compiler output
- **Verify**: Run against known code samples with known lint issues

#### Step 2.4 — Tool Usage Analysis Metric
- **File**: `src/evaluation/metrics/tool-usage.ts`
- Builds "available tools manifest" from workspace `.claude/` directory (lists skills, rules, sub-agents, MCP config)
- Sends manifest + full transcript to judge LLM
- Judge evaluates: tools used (with frequency), tools that should have been used but weren't, effectiveness of usage
- **Verify**: Unit test with mock transcript and manifest

---

### Phase 3: Advanced Features

**Goal**: Complete the feature set for production use.

#### Step 3.1 — Functional Correctness Metric
- **File**: `src/evaluation/metrics/functional.ts`
- Runs build command → checks exit code
- Runs test command → parses output for pass/fail counts (support common formats: Jest JSON, Vitest JSON, pytest JSON)
- Optionally checks test coverage (parses coverage summary JSON)
- Optionally runs start command with timeout → checks if process starts without crashing
- **Verify**: Test against projects with known build/test outcomes

#### Step 3.2 — Manual Evaluation Mode
- **File**: `src/cli/commands/evaluate.ts`
- `cc-eval evaluate --workspace ./path --test test-name`
- Skips execution (no Claude Code session), goes directly to evaluation
- User provides path to already-generated code
- Optionally accepts a transcript JSON for tool usage analysis
- **Verify**: Can evaluate a pre-existing codebase

#### Step 3.3 — Compare Command
- **File**: `src/cli/commands/compare.ts`
- `cc-eval compare <run1> <run2>`
- Loads two run reports, displays side-by-side diff
- Highlights which metrics improved/degraded
- Delta display: `+12.5%` requirement fulfillment, `-3 lint errors`, etc.
- **Verify**: Compare two saved runs, verify diff output

#### Step 3.4 — Report Command + HTML Reporter
- **Files**: `src/cli/commands/report.ts`, `src/reporting/html-reporter.ts`, `src/reporting/json-reporter.ts`
- `cc-eval report <run-id>` → shows detailed CLI output
- `cc-eval report <run-id> --format html` → generates self-contained HTML file
- `cc-eval report <run-id> --format json` → outputs structured JSON
- HTML report: embedded CSS, metric cards, criteria tables, tool usage breakdown
- **Verify**: Generate HTML, open in browser, verify all data present

#### Step 3.5 — Config Overlay via CLI Flag
- Update `src/cli/commands/run.ts` to support `--config-overlay ./path`
- The overlay path points to an alternative `.claude/` directory
- Enables A/B testing: `cc-eval run todo-app --config-overlay ./setup-b`
- **Verify**: Same test with two overlays produces different results

---

### Phase 4: Polish

#### Step 4.1 — npx Support & Global Install
- Ensure `package.json` bin field works for both `npx cc-eval` and global install
- Add shebang `#!/usr/bin/env node` to entry point
- Test: `npx cc-eval --version`, `npm i -g cc-eval && cc-eval --version`

#### Step 4.2 — Error Handling & Logging
- Graceful handling: missing config, invalid YAML, Claude Code SDK errors, network failures
- `--verbose` flag for debug logging
- Clear error messages with suggestions (e.g., "No cc-eval.config.yaml found. Run `cc-eval init` first.")

#### Step 4.3 — Documentation & Examples
- README.md with quick start, config reference, metric descriptions
- Example test suites for common scenarios (React app, API service, CLI tool)
- Example `.claude/` configs to test against

---

## 12. Verification Plan

After each phase, verify end-to-end:

1. **Phase 1**: `cc-eval init` in a test project → create a simple test YAML → `cc-eval run` → see efficiency metrics in terminal + JSON saved to `.cc-eval/runs/`
2. **Phase 2**: Run against a real requirement → see requirement fulfillment scores, lint results, tool usage analysis in output
3. **Phase 3**: Run same test with two config overlays → `cc-eval compare` shows differences → `cc-eval report --format html` generates viewable report
4. **Phase 4**: `npx cc-eval init && npx cc-eval run` works from a fresh project
