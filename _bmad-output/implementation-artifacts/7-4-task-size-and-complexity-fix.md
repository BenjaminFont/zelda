# Story 7.4: Task Size Abstraction and Complexity Evaluator Fix

Status: done

## Story

As a **developer using Zelda**,
I want a human-friendly task size config instead of raw maxTurns numbers, and I want the complexity evaluator to exclude generated directories like coverage reports,
So that test suites are easier to configure and complexity scores are not corrupted by non-source files.

## Acceptance Criteria

1. **Given** a test suite YAML with `execution: { taskSize: large }` **When** the config is resolved **Then** `maxTurns` is set to 50 (mapped from the taskSize)

2. **Given** a test suite with both `taskSize` and `maxTurns` set **When** the config is resolved **Then** explicit `maxTurns` takes priority over `taskSize`

3. **Given** a project config with `maxTurns: 25` and a test suite with `taskSize: small` **When** the config is resolved **Then** the suite's `taskSize` overrides the project's `maxTurns` (resolved to 10)

4. **Given** an invalid `taskSize` value (e.g., "huge") **When** the config is parsed **Then** schema validation rejects it with a clear error

5. **Given** a workspace where vitest generated `coverage/lcov-report/` files **When** the complexity evaluator runs **Then** coverage report files are excluded from density calculations

6. **Given** the complexity evaluator in git mode **When** `git diff` returns paths inside excluded directories (coverage/, build/, .next/) **Then** those files are filtered out before analysis

7. **Given** the complexity evaluator in snapshot mode **When** walking source files **Then** excluded directories (coverage, build, .next, .nuxt, __pycache__, .tox, vendor) are skipped

## Tasks / Subtasks

- [x] Task 1: Expand EXCLUDED_DIRS in complexity evaluator (AC: #5, #6, #7)
  - [x]1.1 Add coverage, build, .next, .nuxt, __pycache__, .tox, vendor to EXCLUDED_DIRS
  - [x]1.2 Add `isInExcludedDir()` helper that checks path segments
  - [x]1.3 Apply isInExcludedDir filter in git mode detectTouchedFiles
  - [x]1.4 Add tests for git mode exclusion of coverage/build/.next dirs

- [x] Task 2: Add taskSize to config schema (AC: #1, #4)
  - [x]2.1 Add TASK_SIZE_MAP constant and TaskSizeSchema to schemas.ts
  - [x]2.2 Add TaskSize type and taskSize field to ExecutionDefaults in types.ts
  - [x]2.3 Add schema validation tests for valid/invalid taskSize values

- [x] Task 3: Implement taskSize resolution (AC: #1, #2, #3)
  - [x]3.1 Update resolver.ts to map taskSize → maxTurns after config merge
  - [x]3.2 Handle suite taskSize overriding project maxTurns (clear inherited maxTurns)
  - [x]3.3 Add resolver tests for all priority/override cases

- [x]Task 4: Update defaults and documentation (AC: #1)
  - [x]4.1 Update init-project.ts default config to use taskSize: medium
  - [x]4.2 Update README.md with taskSize mapping table and examples

## Dev Notes

### Task Size Mapping

| taskSize | maxTurns | Use case |
|----------|----------|----------|
| small    | 10       | Single file fix, simple function |
| medium   | 25       | Multi-file feature, basic tests |
| large    | 50       | Full-stack feature, tests + review |
| xl       | 100      | Complex app from scratch, full test suite |

### Resolution Priority
1. Explicit `maxTurns` always wins
2. `taskSize` mapping applied when `maxTurns` is undefined
3. Suite `taskSize` overrides project `maxTurns` (suite intent wins)

### Root Cause for Complexity Bug
`coverage/lcov-report/prettify.js` is a minified Istanbul report file with density 2058 on 1 LOC. This single file blows up the average density from ~2.5 to 189.28, making complexity score = 0. The `EXCLUDED_DIRS` set only had `node_modules`, `.git`, `.zelda`, `dist`.

### Files to Modify

| File | Change |
|------|--------|
| `src/core/evaluators/complexity.ts` | Expand EXCLUDED_DIRS, add isInExcludedDir, update git mode filter |
| `src/core/config/schemas.ts` | Add TASK_SIZE_MAP, TaskSizeSchema, update ExecutionDefaultsSchema |
| `src/core/types.ts` | Add TaskSize type, add taskSize to ExecutionDefaults |
| `src/core/config/resolver.ts` | Add taskSize → maxTurns resolution logic |
| `src/core/init/init-project.ts` | Update defaults to use taskSize |
| `README.md` | Add taskSize docs |
| `tests/core/evaluators/complexity.test.ts` | Add exclusion tests |
| `tests/core/config/schemas.test.ts` | Add taskSize validation tests |
| `tests/core/config/resolver.test.ts` | Add taskSize resolution tests |

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7] — Post-launch fixes epic
- [Source: src/core/evaluators/complexity.ts#L30] — Current EXCLUDED_DIRS
- [Source: src/core/config/schemas.ts] — ExecutionDefaultsSchema
- [Source: src/core/config/resolver.ts] — resolveConfig function

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- All 4 tasks and 14 subtasks completed
- 418 tests pass (13 new tests added, up from ~405), zero regressions
- TypeScript typecheck passes, build succeeds
- Key changes:
  - `EXCLUDED_DIRS` expanded with 7 new entries (coverage, .coverage, build, .next, .nuxt, __pycache__, .tox, vendor)
  - `isInExcludedDir()` helper added for path-segment filtering in git mode
  - `TASK_SIZE_MAP` exported from schemas.ts: small=10, medium=25, large=50, xl=100
  - `TaskSize` type added to types.ts, `taskSize` field added to `ExecutionDefaults`
  - Resolver maps `taskSize → maxTurns` with priority: explicit maxTurns > taskSize > undefined
  - Suite `taskSize` clears inherited project `maxTurns` (suite intent wins)

### File List

- `src/core/evaluators/complexity.ts` — Expanded EXCLUDED_DIRS, added isInExcludedDir helper, updated git mode filter
- `src/core/config/schemas.ts` — Added TASK_SIZE_MAP constant, taskSize field to ExecutionDefaultsSchema
- `src/core/types.ts` — Added TaskSize type, taskSize field to ExecutionDefaults
- `src/core/config/resolver.ts` — Added taskSize → maxTurns resolution logic with override semantics
- `src/core/init/init-project.ts` — Updated default config to use taskSize: medium
- `README.md` — Added Task Size section with mapping table, updated config examples
- `tests/core/evaluators/complexity.test.ts` — Added 3 git mode exclusion tests
- `tests/core/config/schemas.test.ts` — Added 5 taskSize validation tests
- `tests/core/config/resolver.test.ts` — Added 7 taskSize resolution tests

## Change Log

- 2026-02-16: Implemented Story 7.4 — Added taskSize abstraction layer (small/medium/large/xl → maxTurns) and fixed complexity evaluator scanning coverage report files by expanding EXCLUDED_DIRS and adding path-segment filtering in git mode.
