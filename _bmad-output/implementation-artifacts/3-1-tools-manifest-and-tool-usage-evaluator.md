# Story 3.1: Tools Manifest & Tool Usage Evaluator

Status: done

## Story

As a **developer using Zelda**,
I want Zelda to analyze whether Claude Code effectively used my available tools,
So that I can discover when skills aren't being invoked or rules are being ignored.

## Acceptance Criteria

1. **Given** a workspace with a `.claude/` directory containing skills, rules, sub-agents, or MCP configurations **When** the pipeline assembles the `EvalContext` **Then** it builds a `ToolsManifest` by scanning the `.claude/` directory and listing all available tools (FR26)

2. **Given** a `ToolsManifest` and a `SessionTranscript` **When** the tool usage evaluator runs **Then** the manifest and transcript are sent to the LLM judge for analysis (FR27)

3. **Given** a judge response for tool usage **When** the evaluation completes **Then** the result identifies: tools used (with invocation frequency), tools that should have been used but weren't, and an overall utilization effectiveness score 0-100 (FR28)

4. **Given** the tool usage evaluator **When** it conforms to the `Evaluator` type **Then** it accepts `EvalContext` and returns `Promise<EvalResult>` with `metric: "toolUsage"`

5. **Given** a workspace without a `.claude/` directory **When** the manifest scanner runs **Then** it returns an empty manifest and the tool usage evaluator handles this gracefully (score reflects "no tools available")

## Tasks / Subtasks

- [x] Task 1: Implement tools manifest scanner (AC: #1, #5)
  - [x] 1.1 Create src/core/tools/manifest-scanner.ts with scanToolsManifest function
  - [x] 1.2 Scan .claude/ directory for skills (commands/*.md), rules (rules/*.md), sub-agents, MCP configs
  - [x] 1.3 Return empty ToolsManifest when .claude/ doesn't exist
  - [x] 1.4 Populate ToolEntry with name, path, and optional contentSummary
- [x] Task 2: Implement tool usage evaluator (AC: #2, #3, #4)
  - [x] 2.1 Create src/core/evaluators/tool-usage.ts with ToolUsageDetails type
  - [x] 2.2 Build judge prompt with manifest + transcript for tool usage analysis
  - [x] 2.3 Parse judge response for used tools, missed tools, and utilization score
  - [x] 2.4 Handle empty manifest gracefully (return appropriate score/reasoning)
  - [x] 2.5 Conform to Evaluator type signature
- [x] Task 3: Integrate with pipeline (AC: #1)
  - [x] 3.1 Update run-pipeline.ts to scan manifest before evaluation
  - [x] 3.2 Add tool usage evaluator call when metrics.toolUsage is enabled
- [x] Task 4: Write comprehensive tests (AC: #1-5)
  - [x] 4.1 Create tests/core/tools/manifest-scanner.test.ts (8 tests)
  - [x] 4.2 Test scanning .claude/ with skills, rules, sub-agents, MCP configs
  - [x] 4.3 Test empty manifest for missing .claude/ directory
  - [x] 4.4 Create tests/core/evaluators/tool-usage.test.ts with mocked judge (12 tests)
  - [x] 4.5 Test judge prompt includes manifest and transcript
  - [x] 4.6 Test response parsing for used/missed tools
  - [x] 4.7 Test graceful handling of empty manifest
  - [x] 4.8 Test pipeline integration (via run-pipeline tests)

## Dev Notes

### Architecture Requirements

- ToolsManifest type already exists in types.ts: { skills, rules, subAgents, mcpConfigs } arrays of ToolEntry
- ToolEntry: { name, path, contentSummary? }
- Scanner reads .claude/ directory structure: commands/*.md for skills, rules/*.md for rules
- Tool usage evaluator uses judge-client for LLM analysis
- Empty manifest should return score reflecting "no tools available" rather than error
- Judge-based evaluator runs in parallel with fulfillment (both use judge API)

### Project Structure Notes

- New file: src/core/tools/manifest-scanner.ts
- New file: src/core/evaluators/tool-usage.ts
- Update: src/core/pipeline/run-pipeline.ts
- Types already defined in src/core/types.ts (ToolsManifest, ToolEntry)

### References

- [Source: architecture.md#Tools Manifest]
- [Source: epics.md#Story 3.1]
- [Source: prd.md#FR26-28]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Completion Notes List

- All 191 tests pass (20 new: 8 manifest-scanner + 12 tool-usage)
- TypeScript compiles cleanly
- Empty manifest gracefully returns score 100 with "no tools configured" message
- Score formula: max(0, round((1 - missedCount / totalTools) * 100))
- Pipeline updated to scan manifest and call evaluator when metrics.toolUsage enabled

### File List

- src/core/tools/manifest-scanner.ts (new)
- src/core/evaluators/tool-usage.ts (new)
- src/core/pipeline/run-pipeline.ts (modified)
- tests/core/tools/manifest-scanner.test.ts (new, 8 tests)
- tests/core/evaluators/tool-usage.test.ts (new, 12 tests)
