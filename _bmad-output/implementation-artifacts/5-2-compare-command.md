# Story 5.2: Compare Command

Status: done

## Story

As a **developer using Zelda**,
I want to compare two evaluation runs side-by-side,
So that I can see exactly which metrics improved or regressed after a configuration change.

## Acceptance Criteria

1. **Given** two valid run IDs **When** `zelda compare <run1> <run2>` is executed **Then** both runs' metrics are displayed side-by-side with numerical deltas for every metric (FR47)

2. **Given** a comparison result **When** deltas are displayed **Then** directional indicators show which run performed better per metric (FR48)

3. **Given** an invalid run ID **When** `zelda compare` is executed **Then** a clear error message identifies which run ID was not found

4. **Given** two runs with different metrics available **When** comparison is displayed **Then** missing metrics are shown as "N/A" rather than failing

## Tasks / Subtasks

- [x] Task 1: Implement compare logic (AC: #1-4)
  - [x] 1.1 Create src/core/compare/compare-runs.ts with compareRuns function
  - [x] 1.2 Compute deltas for all shared metrics (B - A)
  - [x] 1.3 Handle missing metrics gracefully (undefined delta, N/A display)
- [x] Task 2: Implement compare terminal display (AC: #1, #2)
  - [x] 2.1 Create src/core/reporter/compare-reporter.ts with renderComparison
  - [x] 2.2 Show side-by-side metric scores with directional indicators (+/-%)
  - [x] 2.3 Color code: green for improvements, red for regressions, dim for zero/N/A
- [x] Task 3: Wire CLI command (AC: #1-3)
  - [x] 3.1 Add `zelda compare <run1> <run2>` command to src/cli.ts
  - [x] 3.2 Error handling for invalid run IDs (clear message identifying which is missing)
- [x] Task 4: Write tests (AC: #1-4)
  - [x] 4.1 Test compare with matching metrics (7 tests in compare-runs.test.ts)
  - [x] 4.2 Test compare with different metrics (N/A handling)
  - [x] 4.3 Test directional indicators (positive, negative, zero deltas)
  - [x] 4.4 Test invalid run ID error (handled in CLI)
  - [x] 4.5 Test display formatting (10 tests in compare-reporter.test.ts)

## Dev Notes

### Architecture Requirements

- Uses getRun from result-store to load both runs
- Delta = run2.score - run1.score (positive = improvement)
- Green for positive delta, red for negative, dim for zero
- Directional indicators: +X.X% or -X.X%

### Project Structure Notes

- New file: src/core/compare/compare-runs.ts
- New file: src/core/reporter/compare-reporter.ts
- Update: src/cli.ts (add compare command)

### References

- [Source: epics.md#Story 5.2]
- [Source: prd.md#FR47-48]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Completion Notes List

- All 256 tests pass (17 new: 7 compare-runs + 10 compare-reporter)
- TypeScript compiles cleanly
- Metrics sorted alphabetically in comparison output
- Human-readable metric labels (camelCase → Title Case)
- Delta: positive = green (+X.X%), negative = red (-X.X%), zero = dim
- Missing metrics shown as N/A with --- delta
- Epic 5 complete

### File List

- src/core/compare/compare-runs.ts (new)
- src/core/reporter/compare-reporter.ts (new)
- src/cli.ts (modified — wired compare command)
- tests/core/compare/compare-runs.test.ts (new, 7 tests)
- tests/core/reporter/compare-reporter.test.ts (new, 10 tests)
