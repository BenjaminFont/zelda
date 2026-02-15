# Story 5.1: List & Retrieve Runs

Status: done

## Story

As a **developer using Zelda**,
I want to list all past evaluation runs and retrieve their details,
So that I can browse my evaluation history and review any past run.

## Acceptance Criteria

1. **Given** multiple runs persisted in `.zelda/runs/` **When** `zelda list` is executed **Then** all runs are displayed with date, test suite name, and key scores (fulfillment %, tool usage %, efficiency summary) sorted by date descending (FR45)

2. **Given** a run ID **When** `zelda list` displays the run **Then** the full result can be retrieved by its identifier without loading the transcript (FR46)

3. **Given** no past runs exist **When** `zelda list` is executed **Then** a helpful message is displayed

## Tasks / Subtasks

- [x] Task 1: Run retrieval already implemented in result-store (AC: #1, #2)
  - [x] 1.1 listRuns() already exists in src/core/storage/result-store.ts
  - [x] 1.2 getRun() already exists
  - [x] 1.3 Already sorted by timestamp descending
- [x] Task 2: Implement list command terminal display (AC: #1, #3)
  - [x] 2.1 Create src/core/reporter/list-reporter.ts with renderRunList
  - [x] 2.2 Display run ID, suite name, date, key scores (fulfillment, tool usage, efficiency)
  - [x] 2.3 Display "No runs found" message when empty
- [x] Task 3: Wire CLI command (AC: #1-3)
  - [x] 3.1 Add `zelda list` command to src/cli.ts
- [x] Task 4: Write tests (AC: #1-3)
  - [x] 4.1-4.4 Already tested in result-store.test.ts
  - [x] 4.5 Test list display formatting (8 new tests in list-reporter.test.ts)
  - [x] 4.6 Test empty list message

## Dev Notes

### Architecture Requirements

- listRuns reads .zelda/runs/*/result.json files
- Sorted by timestamp descending (newest first)
- getRun reads .zelda/runs/<id>/result.json
- No transcript loading for list/retrieve (separate file)

### Project Structure Notes

- Update: src/core/storage/result-store.ts (add listRuns, getRun)
- New file: src/core/reporter/list-reporter.ts
- Update: src/cli.ts (add list command)

### References

- [Source: epics.md#Story 5.1]
- [Source: prd.md#FR45-46]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Completion Notes List

- listRuns/getRun/getTranscript already existed in result-store (from Story 1-6)
- Created list-reporter for formatted terminal output
- Wired `zelda list` CLI command
- 8 new display tests, total 239

### File List

- src/core/reporter/list-reporter.ts (new)
- src/cli.ts (modified — wired list command)
- tests/core/reporter/list-reporter.test.ts (new, 8 tests)
