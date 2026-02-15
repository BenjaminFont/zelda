# Story 3.2: Tool Usage Terminal Display

Status: done

## Story

As a **developer using Zelda**,
I want to see tool usage analysis in the terminal,
So that I can immediately identify which tools were used, which were missed, and act on it.

## Acceptance Criteria

1. **Given** a tool usage `EvalResult` **When** the terminal reporter displays tool usage results **Then** it shows: tools called (with frequency), tools missed (highlighted in yellow/red), utilization assessment, and the overall score (FR51)

2. **Given** a run with efficiency, fulfillment, and tool usage results **When** the terminal reporter displays all results **Then** all three metric sections are shown consistently

## Tasks / Subtasks

- [x] Task 1: Add tool usage renderer to terminal reporter (AC: #1, #2)
  - [x] 1.1 Add renderToolUsage function to src/core/reporter/terminal-reporter.ts
  - [x] 1.2 Display overall utilization score with color coding
  - [x] 1.3 Display used tools with invocation frequency (count + "x" suffix)
  - [x] 1.4 Display missed tools highlighted in yellow with reasoning
  - [x] 1.5 Display utilization assessment reasoning (dim text)
  - [x] 1.6 Register tool usage renderer in metricRenderers map
- [x] Task 2: Write comprehensive tests (AC: #1, #2)
  - [x] 2.1 Test tool usage section header and score display
  - [x] 2.2 Test used tools with frequency counts
  - [x] 2.3 Test missed tools displayed
  - [x] 2.4 Test assessment reasoning shown
  - [x] 2.5 Test combined report with all three metric sections
  - [x] 2.6 Test no emojis in output
  - [x] 2.7 Test no used tools (empty section omitted)
  - [x] 2.8 Test no missed tools (section omitted)
  - [x] 2.9 Test available tool count shown

## Dev Notes

### Architecture Requirements

- Color conventions: green=pass, red=fail, yellow=warning/missed, cyan=labels, dim=secondary
- Missed tools highlighted in yellow to draw attention without alarm
- No emojis — clean professional output
- Consistent layout with efficiency and fulfillment sections

### Project Structure Notes

- Update: src/core/reporter/terminal-reporter.ts (add renderToolUsage)
- Update: tests/core/reporter/terminal-reporter.test.ts (add tool usage tests)

### References

- [Source: architecture.md#Terminal Display]
- [Source: epics.md#Story 3.2]
- [Source: prd.md#FR51]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Completion Notes List

- All 200 tests pass (9 new tool usage reporter tests)
- TypeScript compiles cleanly
- Used tools: green labels with "Nx" frequency counts
- Missed tools: yellow names with reasoning text
- Assessment shown as dim text
- Empty used/missed sections omitted cleanly

### File List

- src/core/reporter/terminal-reporter.ts (modified — added renderToolUsage)
- tests/core/reporter/terminal-reporter.test.ts (modified — 9 new tests)
