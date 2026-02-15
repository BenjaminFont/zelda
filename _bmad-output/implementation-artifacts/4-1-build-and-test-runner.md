# Story 4.1: Build & Test Runner

Status: done

## Story

As a **developer using Zelda**,
I want Zelda to run build and test commands on the generated code,
So that I can verify the code actually compiles and tests pass — not just "looks right."

## Acceptance Criteria

1. **Given** a test suite with a `buildCommand` configured (e.g., `npm run build`) **When** the functional correctness evaluator runs **Then** it executes the build command in the workspace and reports pass/fail based on exit code (FR33-34)

2. **Given** a test suite with a `testCommand` configured (e.g., `npm test`) **When** the evaluator runs the test command **Then** it parses the output to extract pass/fail counts (FR35-36)

3. **Given** a test suite with a `coverageThreshold` configured **When** coverage data is available from the test run **Then** the evaluator reports coverage percentage and whether it meets the threshold (FR37-38)

4. **Given** a test suite without build/test commands configured **When** the functional correctness evaluator runs **Then** it skips gracefully and returns a result indicating "not configured" (score omitted per null-handling pattern)

5. **Given** the functional correctness evaluator **When** it conforms to the `Evaluator` type **Then** it accepts `EvalContext` and returns `Promise<EvalResult>` with `metric: "functionalCorrectness"` containing build status, test counts, and coverage

6. **Given** functional correctness in the pipeline **When** it runs **Then** it executes sequentially (subprocess in workspace), not in parallel with judge calls

## Tasks / Subtasks

- [x] Task 1: Implement functional correctness evaluator (AC: #1-5)
  - [x] 1.1 Create src/core/evaluators/functional-correctness.ts
  - [x] 1.2 Implement runCommand helper for subprocess execution in workspace
  - [x] 1.3 Build command: execute and report pass/fail from exit code
  - [x] 1.4 Test command: execute and parse output for pass/fail counts
  - [x] 1.5 Parse common test output formats (TAP, Jest/vitest summary, generic pass/fail)
  - [x] 1.6 Coverage: parse coverage percentage from output
  - [x] 1.7 Coverage threshold: compare reported coverage to configured threshold
  - [x] 1.8 Handle "not configured" gracefully (no build/test commands)
  - [x] 1.9 Compute overall score from build pass + test ratio + coverage threshold
- [x] Task 2: Integrate with pipeline (AC: #6)
  - [x] 2.1 Update run-pipeline.ts to call functional correctness evaluator when enabled
  - [x] 2.2 Ensure sequential execution (after Claude session, before judge evaluators)
- [x] Task 3: Write comprehensive tests (AC: #1-6)
  - [x] 3.1 Create tests/core/evaluators/functional-correctness.test.ts (22 tests)
  - [x] 3.2 Test build pass/fail from exit code
  - [x] 3.3 Test test command parsing (pass/fail counts, TAP format)
  - [x] 3.4 Test coverage parsing (Istanbul, Coverage:, Statements:) and threshold
  - [x] 3.5 Test "not configured" returns neutral result
  - [x] 3.6 Test overall score computation (build+test, build-only, test-only, with coverage)
  - [x] 3.7 Test pipeline integration (via run-pipeline tests)

## Dev Notes

### Architecture Requirements

- Subprocess execution: use Node.js child_process.execSync or exec for build/test commands
- Parse test output for pass/fail counts: look for common patterns (Jest "X passed, Y failed", TAP "ok/not ok", vitest "X passed")
- Coverage: look for percentage patterns in output (e.g., "Coverage: 85%", "Statements: 85%")
- Score computation: build pass (0 or 100) weighted with test pass ratio and coverage threshold pass/fail
- Sequential in pipeline — subprocess execution cannot be parallelized with judge calls

### Project Structure Notes

- New file: src/core/evaluators/functional-correctness.ts
- Update: src/core/pipeline/run-pipeline.ts
- New file: tests/core/evaluators/functional-correctness.test.ts

### References

- [Source: architecture.md#Functional Correctness]
- [Source: epics.md#Story 4.1]
- [Source: prd.md#FR33-38]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Completion Notes List

- All 222 tests pass (22 new functional correctness tests)
- TypeScript compiles cleanly
- Weighted scoring: build 40% + tests 60% (or 30/50/20 when coverage included)
- Parses Jest/vitest, TAP, and coverage formats (Istanbul, Coverage:, Statements:)
- 5-minute timeout on subprocess execution
- Output truncated to 2000 chars in details

### File List

- src/core/evaluators/functional-correctness.ts (new)
- src/core/pipeline/run-pipeline.ts (modified)
- tests/core/evaluators/functional-correctness.test.ts (new, 22 tests)
