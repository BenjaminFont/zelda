# Story 4.2: Functional Correctness Terminal Display

Status: ready-for-dev

## Story

As a **developer using Zelda**,
I want to see build/test results in the terminal,
So that I know immediately whether the generated code compiles and passes tests.

## Acceptance Criteria

1. **Given** a functional correctness `EvalResult` **When** the terminal reporter displays results **Then** build status (PASS green / FAIL red), test pass/fail counts, and coverage percentage are shown (FR53)

2. **Given** a run with all four metrics **When** the terminal reporter displays results **Then** all metric sections (efficiency, fulfillment, tool usage, functional correctness) are shown in consistent layout

## Tasks / Subtasks

- [ ] Task 1: Add functional correctness renderer to terminal reporter (AC: #1, #2)
  - [ ] 1.1 Add renderFunctionalCorrectness function
  - [ ] 1.2 Display build status (PASS/FAIL) with color coding
  - [ ] 1.3 Display test pass/fail counts
  - [ ] 1.4 Display coverage percentage with threshold comparison
  - [ ] 1.5 Register in metricRenderers map
- [ ] Task 2: Write comprehensive tests (AC: #1, #2)
  - [ ] 2.1 Test build status display
  - [ ] 2.2 Test test pass/fail counts
  - [ ] 2.3 Test coverage display
  - [ ] 2.4 Test combined report with all four metrics
  - [ ] 2.5 Test no emojis

## Dev Notes

### Architecture Requirements

- Consistent with existing metric renderers
- Color conventions: green=pass, red=fail, cyan=labels
- No emojis

### Project Structure Notes

- Update: src/core/reporter/terminal-reporter.ts
- Update: tests/core/reporter/terminal-reporter.test.ts

### References

- [Source: epics.md#Story 4.2]
- [Source: prd.md#FR53]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Completion Notes List

### File List
