---
stepsCompleted: [step-01-init, step-02-discovery, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish]
inputDocuments:
  - product-brief-agent-test-kit-2026-02-11.md
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 0
  projectContext: 0
workflowType: 'prd'
classification:
  projectName: Zelda
  projectType: CLI Tool / Developer Tool (hybrid)
  domain: Developer Tooling (AI-assisted development)
  complexity: Medium
  projectContext: Greenfield
---

# Product Requirements Document - Zelda

**Author:** Benji
**Date:** 2026-02-11

## Executive Summary

Zelda is a CLI-first evaluation framework for the Claude Code tooling ecosystem. Developers craft skills, rule files, sub-agents, MCP configurations, CLAUDE.md files, and workflows to shape Claude Code's output — but have no systematic way to measure whether any of it works. Iteration is driven by gut feel.

Zelda replaces this with a data-driven feedback loop: define a requirement with acceptance criteria, run Claude Code with a given configuration, automatically evaluate the output across four dimensions (efficiency, requirement fulfillment, tool usage analysis, and functional correctness), and get comparable scores. A/B test different configurations and let the numbers guide improvement.

**Target user:** Any developer using Claude Code who iterates on their tooling ecosystem.
**Project type:** CLI tool / developer tool (hybrid), distributed as npm package.
**Project context:** Greenfield, internal use, solo developer.

## Success Criteria

### User Success

- **Measurable improvement signal** — A developer can identify which configuration scored higher and why. The direction of improvement is always clear from the data
- **Actionable insight per run** — Each evaluation run produces at least one actionable finding: a requirement not met, a tool not invoked, or an efficiency concern. No "empty" results
- **Convergence toward better configurations** — Over multiple runs, a developer can demonstrate a measurable trend of improvement (exact run count to be established through usage data)
- **Tool discovery** — Tool usage analysis surfaces non-obvious insights (e.g., a skill available but never called, a rule ignored)

### Business Success

- **Internal adoption** — Used by the team for real configuration improvement, not just experimentation
- **Training value** — Provides a concrete framework for teaching developers to improve Claude Code setups, replacing anecdotal advice with data-backed guidance
- **Investment mindset** — Token costs are an investment in better tooling. Success is measured by insight quality, not cost minimization

### Technical Success

- **Reliable evaluation** — LLM-as-judge produces directionally consistent results: if A is better than B, repeated evaluations confirm this (thresholds to be established through usage)
- **Clean isolation** — Evaluation runs never affect the developer's working directory
- **Transparent scoring** — Every score is explainable with per-criterion reasoning
- **Reproducible runs** — Same configuration and test suite produce comparable results (accounting for LLM non-determinism)

### Measurable Outcomes

- A developer can run Zelda, change a configuration, run again, and see a numerical delta — within their first session
- The compare command produces clear, unambiguous directional signals between two runs
- Evaluation results lead to concrete configuration changes
- Note: Specific numerical targets will be established through early usage data. Premature precision would be counterproductive for this experimental tool

## Product Scope

### MVP - Minimum Viable Product

**The MVP delivers a complete evaluate-and-compare loop.**

- **CLI commands:** `zelda init`, `zelda run`, `zelda compare`, `zelda list`
- **Configuration:** YAML-based project config and test suite definitions with Zod validation
- **Workspace isolation:** Git worktree-based isolated execution environments
- **Execution:** Claude Code sessions via Claude Agent SDK with full transcript capture
- **4 evaluation metrics:** Efficiency (telemetry), Requirement Fulfillment (LLM judge), Tool Usage Analysis (LLM judge), Functional Correctness (build/test/coverage)
- **LLM Judge:** Shared infrastructure for judge-based metrics, routed through Portkey, configurable model
- **Transcript management:** Chunked evaluation for sessions exceeding judge context capacity
- **Reporting:** Terminal output (vitest-style) + JSON persistence + compare view with deltas

### Growth Features (Post-MVP)

- **Code Quality metric** — Static analysis / linter integration (ESLint, tsc, etc.)
- **Config overlay via CLI** — Streamlined A/B testing with alternative `.claude/` directories
- **Manual evaluation mode** — Evaluate pre-existing code without running Claude Code
- **`--json` output flag** — Scripting/CI integration
- **HTML report generation** — Rich, shareable reports
- **Multi-provider judge** — Non-Claude models via Portkey's universal API

### Vision (Future)

- **Statistical multi-run analysis** — Aggregate trends across many runs (e.g., "skill invoked 20% of the time across 100 runs")
- **Generalization beyond code** — Measure goal achievement for any Claude Code task
- **Team features** — Shared test suites, configuration libraries, cross-team benchmarks
- **Web dashboard** — Visual trend tracking and team collaboration
- **Framework Customizer** — Custom metrics, custom judge prompts, evaluation plugins

## User Journeys

### Primary User: Alex — The Prompt Iterator

Alex is a full-stack developer who uses Claude Code daily. They've built several skills, maintain rule files, and have configured sub-agents. They iterate on their Claude Code tooling constantly but have no data on whether changes improve outcomes.

### Journey 1: First Contact — Setting Up Zelda

Alex has been tweaking Claude Code skills for weeks with no idea if they're getting better. A colleague mentions Zelda. Alex runs `npm install -D zelda && npx zelda init` in their project. The CLI creates a config file and an example test suite. Alex opens the example YAML, replaces the placeholder with a real task from their project — "build a REST endpoint with input validation" — and writes 5 acceptance criteria. Alex types `npx zelda run`. For the first time, numbers appear: 60% requirement fulfillment, tool usage shows Claude Code never called their API-patterns skill. Alex thinks: *"So that's what's been happening."*

**Capabilities revealed:** CLI init scaffolding, YAML test suite authoring, single-command execution, terminal result display, tool usage reporting.

### Journey 2: The Iteration Loop — Refining a Configuration

Alex now knows their API-patterns skill isn't being invoked. They rewrite the skill description to be more explicit about when it should be triggered. They run `npx zelda run` again. Requirement fulfillment jumps to 80%, and tool usage shows the skill was called twice. Alex runs `npx zelda compare run-001 run-002` and sees the delta: `+20% requirement fulfillment, +2 tool invocations`. They tweak the skill further, run again, compare again. Each cycle takes minutes, not hours. The numbers guide every change.

**Capabilities revealed:** Repeated runs with result persistence, compare command with numerical deltas, run history tracking.

### Journey 3: A/B Testing — Skill vs. Rule vs. CLAUDE.md

Alex wonders: should their backend testing pattern be a skill, a rule, or part of CLAUDE.md? They create the same guidance in all three formats. Run 1: testing pattern as a skill. Run 2: same content as a rule. Run 3: same content in CLAUDE.md. Three `zelda compare` commands later, Alex sees the rule version scores highest on both requirement fulfillment and tool usage. Decision made — backed by data, not intuition.

**Capabilities revealed:** Multiple runs with different configurations, compare across more than two runs, clear directional signals for decision-making.

### Journey 4: Something Goes Wrong — Debugging a Bad Run

Alex runs an evaluation and gets 30% requirement fulfillment — much worse than expected. They check the terminal output: the per-criterion breakdown shows 4 of 6 criteria failed. The reasoning explains Claude Code attempted to use a deprecated API pattern. The tool usage report shows Claude Code called an outdated skill that Alex forgot to remove. Alex deletes the stale skill, runs again, scores jump to 85%. Without the detailed breakdown, Alex would have spent hours guessing what went wrong.

**Capabilities revealed:** Per-criterion PASS/FAIL with reasoning, tool usage detail showing what was called, transparent scoring that enables debugging.

### Future User Type: Framework Customizer

Not in MVP scope. A future user type who extends or configures Zelda itself — custom metrics, custom judge prompts, evaluation plugins.

### Journey Requirements Summary

| Capability | Journey 1 | Journey 2 | Journey 3 | Journey 4 |
|---|---|---|---|---|
| CLI init scaffolding | ✓ | | | |
| YAML test suite authoring | ✓ | | | |
| Single-command execution | ✓ | ✓ | ✓ | ✓ |
| Terminal result display | ✓ | ✓ | ✓ | ✓ |
| Requirement fulfillment scoring | ✓ | ✓ | ✓ | ✓ |
| Per-criterion PASS/FAIL with reasoning | | | | ✓ |
| Tool usage reporting | ✓ | ✓ | ✓ | ✓ |
| Run persistence (JSON) | | ✓ | ✓ | |
| Compare command with deltas | | ✓ | ✓ | |
| Run history (list command) | | ✓ | ✓ | |
| Efficiency metrics | ✓ | ✓ | ✓ | ✓ |

## Innovation & Novel Patterns

### Detected Innovation Areas

1. **New product category** — No purpose-built tool exists for evaluating AI coding agent configurations. Zelda is a greenfield concept, not an improvement on an existing tool
2. **Tool usage intelligence** — Analyzing whether an AI coding agent effectively leveraged its available tools is a novel metric. Existing frameworks measure output quality; Zelda also measures the process
3. **Scientific methodology for prompt engineering** — A/B testing, measurable scores, and reproducible comparisons applied to what has been an entirely intuitive process

### Market Context & Competitive Landscape

- No direct competitors in this space
- Generic LLM evaluation frameworks (RAGAS-based) evaluate text responses, not agentic code generation
- Code quality tools (ESLint, SonarQube) measure output, not the tooling that produced it
- Research needed: broader AI agent evaluation landscape may produce adjacent tools worth monitoring

### Validation Approach

- **Internal dogfooding** — Use Zelda internally to improve the team's own Claude Code configurations
- **Before/after measurement** — Track whether Zelda-refined configurations produce measurably better outcomes than gut-feel iteration
- **LLM judge reliability** — Validate directional consistency across repeated evaluations
- **Experimental mindset** — Success thresholds established through usage data, not predetermined

## CLI / Developer Tool Specific Requirements

### Project-Type Overview

Zelda is a hybrid CLI tool and developer tool — a command-line framework distributed as an npm package. All interaction happens through terminal commands. No GUI, no web interface, no IDE integration in MVP.

### Command Structure

| Command | Purpose | Arguments |
|---|---|---|
| `zelda init` | Scaffold config and test directory in current project | None |
| `zelda run [test-name]` | Execute one or all test suites with full evaluation pipeline | Optional test name filter |
| `zelda compare <run1> <run2>` | Side-by-side comparison of two runs with deltas | Two run IDs (required) |
| `zelda list` | List all past runs with summary | None |

All commands are standalone (non-interactive). Future enhancement: interactive mode for test suite selection.

### Output Formats

- **Terminal** — Primary output. Colored, formatted results in vitest-style layout
- **JSON** — Persistence format. Every run saves structured JSON to `.zelda/runs/<run-id>/`
- No `--json` CLI flag in MVP. Deferred to post-MVP for scripting/CI integration

### Configuration Schema

- **Project config:** `zelda.config.yaml` — Global settings (judge model, gateway endpoint, execution defaults, results directory)
- **Test suites:** `zelda/test-*.yaml` — Individual test definitions with prompts, acceptance criteria, and optional metric/execution overrides
- **Validation:** Zod schemas with clear error messages on invalid YAML
- **Override hierarchy:** Test suite config overrides project-level defaults

### Installation & Distribution

- **npm** (primary). Published with `bin` field for CLI access
- **Installation:** `npm install -D zelda` or `npx zelda`
- **Compatibility:** yarn, pnpm, bun work automatically via npm registry

### Implementation Considerations

- **TypeScript** with tsup bundling. Single entry point with shebang
- **Dependencies:** Keep minimal — commander, zod, yaml, chalk, Anthropic SDKs, essential utilities
- **Testing:** vitest for framework's own tests
- **No native dependencies** — Pure JavaScript/TypeScript for portability
- **Exit codes:** 0 for success, non-zero for failure (enables future scripting)

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-solving MVP — if a developer can go from "I don't know if my skill works" to "I have numbers showing it works" in one session, the MVP is successful.

**Resource:** Solo developer. Every feature must earn its place.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Journey 1 (First Contact) — Full support
- Journey 2 (Iteration Loop) — Full support
- Journey 3 (A/B Testing) — Partial support (manual config swapping, no CLI overlay flag)
- Journey 4 (Debugging) — Full support

**Must-Have Capabilities (14 items):**
1. `zelda init` — Scaffold project config + example test suite
2. `zelda run [test-name]` — Execute Claude Code in isolated workspace, evaluate with 4 metrics
3. `zelda compare <run1> <run2>` — Side-by-side delta view
4. `zelda list` — Browse run history
5. YAML config + test suite loading with Zod validation
6. Git worktree workspace isolation
7. Claude Agent SDK execution with transcript capture
8. Efficiency metric (telemetry-computed)
9. Requirement Fulfillment metric (LLM judge)
10. Tool Usage Analysis metric (LLM judge)
11. Functional Correctness metric (build/test/coverage)
12. Transcript management (chunked evaluation for large sessions)
13. Terminal reporter (vitest-style)
14. JSON result persistence

**Explicitly NOT in MVP:**
- Code Quality metric (static analysis / linters)
- Config overlay CLI flag, manual evaluation mode
- HTML reports, shell completion, interactive prompts
- Statistical multi-run analysis, web dashboard, team features

### Post-MVP Features

**Phase 2 (Growth):**
- Code Quality metric (ESLint, tsc integration)
- Config overlay via `--config` CLI flag for streamlined A/B testing
- Manual evaluation mode (evaluate existing code without running Claude Code)
- `--json` output flag for scripting/CI integration
- HTML report generation
- Multi-provider judge via Portkey universal API

**Phase 3 (Expansion):**
- Statistical multi-run analysis (aggregate trends across many runs)
- Framework Customizer user type (custom metrics, custom judge prompts, plugins)
- Generalization beyond code evaluation
- Team features (shared test suites, benchmarks)
- Web dashboard for visual trend tracking
- IDE integration (VS Code extension)

### Risk Mitigation Strategy

**Technical Risks:**
- **Claude Agent SDK integration (HIGH)** — SDK must provide structured transcript data (tool calls, metadata, cost/tokens). Mitigation: validate in a spike/proof-of-concept before building the full pipeline. Abstract behind clean interface for adaptation
- **LLM judge reliability (MEDIUM)** — Non-deterministic output could produce inconsistent scores. Mitigation: focus on directional consistency (A better than B) rather than absolute scores. Configurable judge model via Portkey
- **Workspace isolation edge cases (LOW)** — Git worktree may behave unexpectedly. Mitigation: fallback to directory copy

**Market Risks:**
- **New category = unknown demand.** Mitigation: internal dogfooding first, refine based on real usage data

**Resource Risks:**
- **Solo developer** — Strict prioritization required. Mitigation: 14-item must-have list is deliberately minimal. Contingency: if further reduction needed, the absolute minimum is init + run + efficiency + requirement fulfillment + terminal output

## Functional Requirements

### Project Setup & Configuration

- FR1: Developer can initialize Zelda in an existing project, creating a config file, test suite directory, and example test suite
- FR2: Developer can define project-level configuration in a YAML file (judge model, gateway endpoint, execution defaults, results directory)
- FR3: System validates all configuration files against defined schemas and reports clear errors on invalid input
- FR4: Developer can override project-level configuration settings at the test suite level
- FR5: System resolves configuration by merging project defaults with test suite overrides

### Test Suite Definition

- FR6: Developer can define a test suite in a YAML file with a prompt describing what Claude Code should build
- FR7: Developer can specify acceptance criteria as a list of testable statements in a test suite
- FR8: Developer can configure execution parameters per test suite (model, max turns)
- FR9: Developer can configure which evaluation metrics are enabled per test suite
- FR10: System discovers and loads all test suite files from the configured test directory

### Execution & Workspace Management

- FR11: System creates an isolated workspace for each test run using git worktree
- FR12: System falls back to directory copy for non-git repositories
- FR13: System executes a Claude Code session in the isolated workspace using the Claude Agent SDK
- FR14: System captures the full session transcript including all tool calls, inputs, outputs, and responses
- FR15: System captures session metadata (cost, tokens, turn count, duration)
- FR16: System cleans up isolated workspaces after run completion
- FR17: Developer can run a specific test suite by name or run all test suites

### Evaluation — Efficiency

- FR18: System computes total token usage (input and output) from session telemetry
- FR19: System computes API cost in USD from session telemetry
- FR20: System computes turn count and wall-clock duration from session telemetry
- FR21: System computes tool call counts grouped by tool type (Read, Edit, Write, Bash, Glob, Grep, etc.)
- FR22: System computes error and retry count from session telemetry

### Evaluation — LLM Judge

- FR23: System sends generated code and acceptance criteria to an LLM judge for requirement fulfillment evaluation
- FR24: LLM judge evaluates each acceptance criterion individually, returning PASS/FAIL with reasoning per criterion
- FR25: System computes an overall requirement fulfillment score as percentage of criteria met
- FR26: System builds a tools manifest by scanning the workspace's `.claude/` directory (skills, rules, sub-agents, MCP configurations)
- FR27: System sends the tools manifest and session transcript to an LLM judge for tool usage analysis. The judge differentiates between invocable tools (skills, sub-agents, MCP — checked for explicit invocation in transcript) and implicit context (rules — checked for output compliance)
- FR28: LLM judge identifies invocable tools used (with frequency), invocable tools that should have been used but weren't, rule compliance per rule, and overall utilization effectiveness
- FR29: Developer can configure which LLM model is used as the judge and the gateway endpoint (e.g., Portkey)
- FR30: System routes all judge LLM calls through the configured gateway endpoint, supporting Anthropic SDK via Portkey
- FR31: Developer can configure gateway credentials (API key, endpoint URL) separately from Claude Agent SDK credentials used for execution
- FR32: System handles LLM judge errors with retries and clear error reporting

### Evaluation — Functional Correctness

- FR33: Developer can configure a build command per test suite that the system executes in the workspace after Claude Code completes
- FR34: System reports build pass/fail based on command exit code
- FR35: Developer can configure a test command per test suite that the system executes in the workspace
- FR36: System parses test command output to extract pass/fail counts
- FR37: Developer can optionally configure a coverage threshold per test suite
- FR38: System reports test coverage percentage when coverage data is available

### Evaluation — Transcript Management

- FR39: System monitors transcript size and applies chunked evaluation when the transcript exceeds the judge LLM's context capacity
- FR40: When chunking is needed, system splits the transcript into meaningful increments and evaluates each independently
- FR41: System synthesizes incremental evaluation results into a cohesive final assessment without losing critical information
- FR42: System preserves full evaluation fidelity for transcripts that fit within a single judge call

### Result Storage & History

- FR43: System persists complete run results (all metric outputs, transcript, configuration used) as JSON to a results directory
- FR44: System assigns a unique identifier to each run
- FR45: Developer can list all past runs with summary information (date, test name, key scores)
- FR46: Developer can retrieve the full results of any past run by its identifier

### Comparison & Reporting

- FR47: Developer can compare two runs side-by-side, seeing numerical deltas for all metrics
- FR48: Comparison displays directional indicators showing which run performed better per metric
- FR49: System displays run results in the terminal using colored, formatted output (vitest-style)
- FR50: Terminal output shows requirement fulfillment with per-criterion PASS/FAIL and reasoning
- FR51: Terminal output shows tool usage analysis with tools called, tools missed, and utilization assessment
- FR52: Terminal output shows efficiency metrics (tokens, cost, turns, duration, tool call breakdown)
- FR53: Terminal output shows functional correctness results (build status, test pass/fail counts, coverage)

## Non-Functional Requirements

### Performance

- NFR1: Zelda's own framework overhead (config loading, workspace creation, result persistence, reporting) completes within seconds. The dominant execution time is the Claude Code session itself, which is external and not controllable
- NFR2: Workspace creation via git worktree completes within 5 seconds for typical repositories
- NFR3: Workspace cleanup does not block the user from seeing results — results display first, cleanup happens after
- NFR4: Chunked evaluation for large transcripts adds no more than 2x overhead compared to single-call evaluation

### Security

- NFR5: API keys (Anthropic, Portkey) are never stored in result files, logs, or terminal output
- NFR6: API keys are read from environment variables or secure config, never hardcoded in test suites
- NFR7: Isolated workspaces do not expose or modify credentials in the developer's main project directory
- NFR8: Result JSON files do not contain raw API keys or secrets from the evaluated project

### Integration

- NFR9: Claude Agent SDK dependency — version compatibility documented and validated
- NFR10: Anthropic SDK via Portkey dependency — endpoint compatibility validated
- NFR11: Both SDK dependencies abstracted behind clean interfaces to enable adaptation if APIs change
- NFR12: System degrades gracefully if Portkey is unreachable (clear error, no data loss of captured transcript)

### Reliability

- NFR13: Workspace isolation is bulletproof — under no circumstances should a Zelda run modify files in the developer's working directory
- NFR14: If a run fails mid-execution, partial results are preserved and the workspace is cleaned up
- NFR15: Result persistence is atomic — a result file is either complete and valid JSON, or not written at all
- NFR16: System recovers cleanly from interrupted runs — no orphaned git worktrees or zombie processes

### Post-Launch Additions

- FR54: Rules (`.claude/rules/*.md`) are evaluated for output compliance, not transcript invocation — they are implicit context, not invocable tools
- FR55: Rules with `paths:` YAML frontmatter are only evaluated for compliance when matching files were touched during the session
- FR56: Workspace creation uses directory copy (not git worktree) when the project directory is a subdirectory of a larger git repository (e.g., monorepo packages)
