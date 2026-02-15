# Story 7.1: Differentiate Rule Compliance from Tool Invocation in Tool Usage Evaluator

Status: done

## Story

As a **developer using Zelda**,
I want the tool usage evaluator to distinguish between invocable tools (skills, sub-agents, MCP) and implicit context (rules),
so that rules are evaluated by output compliance rather than transcript invocation — producing accurate scores.

## Acceptance Criteria

1. **Given** a workspace with `.claude/rules/*.md` files **When** the tool usage evaluator runs **Then** rules are evaluated for **compliance** (did the output follow the rule?) not **invocation** (was the rule called as a tool?)

2. **Given** a workspace with both rules and skills/sub-agents **When** the evaluator produces results **Then** the result separates `invokedTools` (skills, sub-agents, MCP with invocation frequency) from `ruleCompliance` (rules with compliance assessment per rule) in the details

3. **Given** rules that were followed implicitly **When** the score is computed **Then** followed rules contribute positively to the score, not penalized as "missed tools"

4. **Given** a rule scoped with `paths:` YAML frontmatter **When** the evaluator checks compliance **Then** it only evaluates compliance for rules whose path patterns match files touched in the session

5. **Given** the judge prompt for tool usage **When** it evaluates rules vs. invocable tools **Then** it uses different evaluation criteria: "Was this rule's guidance reflected in the code?" for rules vs. "Was this tool explicitly called?" for skills/sub-agents

6. **Given** a workspace with no rules but with skills **When** the evaluator runs **Then** only invocation-based evaluation is performed (no rule compliance section)

7. **Given** chunked transcripts **When** tool usage is synthesized across chunks **Then** rule compliance results are merged correctly (worst-case compliance per rule across chunks)

## Tasks / Subtasks

- [x] Task 1: Extend manifest scanner to parse rule frontmatter (AC: #4)
  - [x] 1.1 Parse YAML frontmatter from `.claude/rules/*.md` files for `paths:` field
  - [x] 1.2 Add `pathPatterns?: string[]` to `ToolEntry` type in `types.ts`
  - [x] 1.3 Update `scanDirectory` to extract frontmatter when scanning rules
  - [x] 1.4 Add tests for frontmatter parsing (with paths, without paths, malformed)

- [x] Task 2: Update types for split evaluation (AC: #2)
  - [x] 2.1 Add `RuleComplianceEntry` type: `{ name: string; compliant: boolean; reasoning: string }`
  - [x] 2.2 Update `ToolUsageDetails` to add `ruleCompliance: RuleComplianceEntry[]` field
  - [x] 2.3 Keep existing `usedTools` and `missedTools` for invocable tools only
  - [x] 2.4 Update type tests

- [x] Task 3: Update judge prompt to differentiate categories (AC: #1, #5)
  - [x] 3.1 Rewrite `buildSystemPrompt()` to instruct judge on two evaluation modes
  - [x] 3.2 Update `buildUserPrompt()` / `formatManifest()` to separate rules from invocable tools in the manifest section
  - [x] 3.3 Update expected JSON response to include `ruleCompliance` array
  - [x] 3.4 Update `parseJudgeResponse()` to extract `ruleCompliance` from judge output

- [x] Task 4: Update scoring logic (AC: #3)
  - [x] 4.1 Compute invocable tool score: penalize for missed skills/agents/MCP
  - [x] 4.2 Compute rule compliance score: percentage of rules complied with
  - [x] 4.3 Combine into overall score (weighted or averaged)
  - [x] 4.4 Update reasoning string to reflect both dimensions

- [x] Task 5: Update transcript synthesizer for rule compliance (AC: #7)
  - [x] 5.1 Update `synthesizeToolUsage()` in `synthesizer.ts` to merge `ruleCompliance` across chunks
  - [x] 5.2 For each rule appearing in multiple chunks, take worst-case compliance (if any chunk says non-compliant, mark non-compliant)
  - [x] 5.3 Add tests for rule compliance synthesis

- [x] Task 6: Update terminal reporter (AC: #2)
  - [x] 6.1 Add "Rule Compliance" subsection under Tool Usage in terminal output
  - [x] 6.2 Show each rule with COMPLIANT (green) or NOT COMPLIANT (red) + reasoning
  - [x] 6.3 Keep existing "Used Tools" and "Missed Tools" display for invocable tools

- [x] Task 7: Filter path-scoped rules (AC: #4)
  - [x] 7.1 Extract file paths touched from transcript (tool calls to Read, Write, Edit, etc.)
  - [x] 7.2 Match against rule `pathPatterns` using glob matching (picomatch already in deps via tinyglobby)
  - [x] 7.3 Only include applicable rules in the judge prompt
  - [x] 7.4 Add tests for path filtering logic

- [x] Task 8: Update evaluator tests (AC: all)
  - [x] 8.1 Update existing tool-usage.test.ts for new response structure
  - [x] 8.2 Add tests for rules-only manifest, skills-only manifest, mixed manifest
  - [x] 8.3 Add tests for path-scoped rule filtering
  - [x] 8.4 Add test for empty rules (no ruleCompliance section in output)
  - [x] 8.5 Verify score computation with both dimensions

## Dev Notes

### Architecture Patterns

- **Evaluator signature**: `(context: EvalContext) => Promise<EvalResult>` — do not change
- **Score range**: 0-100 normalized, same as all other evaluators
- **Judge client**: Use `judgeQuery()` from `src/core/judge/judge-client.ts` — do not import Anthropic SDK directly
- **No null values**: Use optional fields, empty arrays for missing data
- **Named exports only**: No `export default`
- **File naming**: `kebab-case.ts`

### Key Distinction: Rules vs. Invocable Tools

| Category | Detection Method | Evaluation Question |
|----------|-----------------|-------------------|
| Skills (`.claude/commands/`) | Explicit tool call in transcript | "Was this skill invoked?" |
| Sub-agents (`.claude/agents/`) | Explicit tool call in transcript | "Was this sub-agent invoked?" |
| MCP configs | Explicit tool call in transcript | "Were MCP tools used?" |
| Rules (`.claude/rules/`) | **Output compliance** | "Does the generated code follow this rule's guidance?" |

Rules are loaded into Claude Code's system prompt/memory at session startup. They are never "called" — they influence behavior implicitly. The only way to evaluate them is by examining the output code.

Rules with `paths:` YAML frontmatter are conditionally loaded — only active when Claude Code works with matching files. Example:

```markdown
---
paths:
  - "src/api/**/*.ts"
---
# API conventions
Always validate input at the boundary...
```

### Files to Modify

| File | Change |
|------|--------|
| `src/core/types.ts` | Add `pathPatterns?: string[]` to `ToolEntry`, add `RuleComplianceEntry` type, update `ToolUsageDetails` |
| `src/core/tools/manifest-scanner.ts` | Parse YAML frontmatter from rule files for `paths:` field |
| `src/core/evaluators/tool-usage.ts` | Split prompt into rules vs. invocable tools, update scoring, update response parsing |
| `src/core/transcript/synthesizer.ts` | Update `synthesizeToolUsage()` to merge `ruleCompliance` |
| `src/core/reporter/terminal-reporter.ts` | Add Rule Compliance subsection to tool usage display |
| `tests/core/tools/manifest-scanner.test.ts` | Add frontmatter parsing tests |
| `tests/core/evaluators/tool-usage.test.ts` | Update for new response structure, add rule compliance tests |
| `tests/core/transcript/synthesizer.test.ts` | Add rule compliance synthesis tests |
| `tests/core/reporter/terminal-reporter.test.ts` | Add rule compliance display tests |

### Scoring Formula

Proposed combined scoring:

```
invocableScore = missedCount === 0 ? 100 : max(0, round((1 - missedCount / invocableTotal) * 100))
ruleScore = round((compliantCount / ruleTotal) * 100)

// If both present: weighted average (invocable tools are more actionable)
// If only rules: use ruleScore
// If only invocable: use invocableScore (current behavior)
overallScore = hasRules && hasInvocable
  ? round(invocableScore * 0.5 + ruleScore * 0.5)
  : hasRules ? ruleScore : invocableScore
```

### YAML Frontmatter Parsing

Rule files may have YAML frontmatter delimited by `---`:

```markdown
---
paths:
  - "src/**/*.ts"
  - "tests/**/*.test.ts"
---

# Rule content here...
```

Parse with the `yaml` package (already a dependency). Extract `paths` array if present. The `contentSummary` should come from the first non-empty line AFTER the frontmatter block.

### Extracting Touched Files from Transcript

To determine which files were touched during the session (for path-scoped rule filtering), scan transcript tool calls for:
- `Read` tool: `input.file_path`
- `Write` tool: `input.file_path`
- `Edit` tool: `input.file_path`
- `Glob` tool: results (if available)
- `Bash` tool: not reliably parseable — skip

Convert absolute workspace paths to relative paths before matching against rule `pathPatterns`.

### Previous Story Patterns

From Story 3.1 (`c9dbbdd`) — original tool usage evaluator + manifest scanner:
- Commit convention: `feat(story-7-1): description`
- Tests co-located in `tests/core/` mirroring `src/core/`
- Mock pattern: `vi.mock('../judge/judge-client.js', ...)` for evaluator tests
- Temp directory pattern: `mkdtempSync` + `afterEach` cleanup for scanner tests
- All chalk-based terminal tests avoid checking ANSI codes directly (chalk disables colors in non-TTY)

### Project Structure Notes

- All changes stay within `src/core/` — no new top-level directories
- No new dependencies needed (yaml, picomatch already available)
- Maintains one-way dependency: evaluators → judge-client, evaluators → types (never reverse)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7] — Story 7.1 specification
- [Source: _bmad-output/planning-artifacts/prd.md#FR27-28] — Updated tool usage requirements
- [Source: _bmad-output/planning-artifacts/prd.md#FR54-56] — New post-launch FRs
- [Source: src/core/evaluators/tool-usage.ts] — Current evaluator implementation
- [Source: src/core/tools/manifest-scanner.ts] — Current scanner implementation
- [Source: src/core/transcript/synthesizer.ts#synthesizeToolUsage] — Chunked synthesis
- [Source: src/core/reporter/terminal-reporter.ts#L91-118] — Current tool usage display
- [Source: src/core/types.ts] — Shared type definitions

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- picomatch v4.0.3 is CJS without types — installed as direct dependency with @types/picomatch
- Empty frontmatter `paths: []` needed explicit check to return `undefined` instead of empty array
- Synthesizer defensive: `result.ruleCompliance ?? []` for backward compat with test data lacking the field

### Completion Notes List

- All 8 tasks and 30 subtasks completed
- 323 tests pass (43 new tests added, up from 280), zero regressions
- TypeScript typecheck passes, build succeeds
- Key architectural changes:
  - `ToolEntry` type extended with optional `pathPatterns?: string[]`
  - New `RuleComplianceEntry` type added to `tool-usage.ts`
  - `ToolUsageDetails` now includes `ruleCompliance: RuleComplianceEntry[]`
  - Manifest scanner uses `ContentParser` strategy pattern — `scanDirectory` accepts parser callback, eliminating code duplication
  - Judge prompt dynamically adapts based on whether invocable tools and/or rules are present
  - Scoring uses 50/50 weighted average when both invocable tools and rules exist
  - Path-scoped rules filtered via `extractTouchedFiles()` + `filterApplicableRules()` using picomatch
  - `extractTouchedFiles` handles Read/Write/Edit (input.file_path) and Glob (output array/string)
  - `parseJudgeResponse` validates individual ruleCompliance entry shapes (name, compliant, reasoning)
  - `filterApplicableRules` pre-compiles picomatch matchers before filtering
  - Terminal reporter shows COMPLIANT/NOT COMPLIANT per rule in Rule Compliance subsection
  - Synthesizer merges rule compliance with worst-case-wins semantics

### Code Review Fixes Applied

- **[HIGH]** Added Glob tool support to `extractTouchedFiles` — handles both array and string output formats
- **[MEDIUM]** Eliminated `scanRules` duplication — refactored `scanDirectory` to accept a `ContentParser` callback
- **[MEDIUM]** Added validation of individual ruleCompliance entries from judge response — filters malformed entries
- **[MEDIUM]** Pre-compiled picomatch matchers in `filterApplicableRules` before the filter loop
- **[LOW]** Removed unused `RuleComplianceEntry` import from test file
- **[LOW]** Added test for `formatManifest` with `applicableRules` override parameter

### File List

- `src/core/types.ts` — Added `pathPatterns?: string[]` to `ToolEntry`
- `src/core/tools/manifest-scanner.ts` — Added `parseFrontmatter()`, `scanRules()`, `extractSummary()` for YAML frontmatter parsing
- `src/core/evaluators/tool-usage.ts` — Rewrote with split evaluation: `RuleComplianceEntry` type, `extractTouchedFiles()`, `filterApplicableRules()`, `computeScore()`, differentiated prompts
- `src/core/transcript/synthesizer.ts` — Added `ruleCompliance` merging with worst-case-wins per rule
- `src/core/reporter/terminal-reporter.ts` — Added Rule Compliance subsection with COMPLIANT/NOT COMPLIANT display
- `tests/core/tools/manifest-scanner.test.ts` — Added 5 frontmatter parsing tests + 5 `parseFrontmatter` unit tests
- `tests/core/evaluators/tool-usage.test.ts` — Rewrote with 35 tests covering split evaluation, scoring, path filtering
- `tests/core/transcript/synthesizer.test.ts` — Added 2 rule compliance synthesis tests
- `tests/core/reporter/terminal-reporter.test.ts` — Added 3 rule compliance display tests
- `package.json` — Added `picomatch` dependency, `@types/picomatch` devDependency
- `package-lock.json` — Updated with new dependencies

## Change Log

- 2026-02-15: Implemented Story 7.1 — Split tool usage evaluator into invocable tools (invocation-based) and rules (compliance-based). Added YAML frontmatter parsing for path-scoped rules, path filtering via picomatch, 50/50 weighted scoring, worst-case synthesis, and Rule Compliance terminal display.
