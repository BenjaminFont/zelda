# Story 2.2: Requirement Fulfillment Evaluator

Status: review

## Story

As a **developer using Zelda**,
I want my generated code evaluated against each acceptance criterion,
So that I know exactly which requirements were met and which weren't — with reasoning.

## Acceptance Criteria

1. **Given** generated code from a Claude Code session and acceptance criteria from the test suite **When** the requirement fulfillment evaluator runs **Then** the code and criteria are sent to the LLM judge for evaluation (FR23)

2. **Given** a judge response for requirement fulfillment **When** the evaluation completes **Then** each acceptance criterion has an individual PASS/FAIL result with reasoning explaining why (FR24)

3. **Given** per-criterion results **When** the overall score is computed **Then** it equals the percentage of criteria that passed (e.g., 4/5 = 80.0%) normalized to 0-100 (FR25)

4. **Given** the requirement fulfillment evaluator **When** it conforms to the `Evaluator` type **Then** it accepts `EvalContext` and returns `Promise<EvalResult>` with `metric: "requirementFulfillment"` and `details` containing per-criterion breakdown

5. **Given** a completed fulfillment evaluation **When** the pipeline orchestrates evaluators **Then** the fulfillment evaluator runs alongside the existing efficiency evaluator and results are persisted together

## Tasks / Subtasks

- [x] Task 1: Implement fulfillment evaluator module (AC: #1, #2, #3, #4)
  - [x] 1.1 Create src/core/evaluators/fulfillment.ts with CriterionResult and FulfillmentDetails types
  - [x] 1.2 Implement buildSystemPrompt for judge instructions (JSON array response format)
  - [x] 1.3 Implement buildUserPrompt with transcript summary + criteria list
  - [x] 1.4 Implement parseJudgeResponse to extract per-criterion PASS/FAIL from JSON
  - [x] 1.5 Implement fulfillmentEvaluator conforming to Evaluator type signature
  - [x] 1.6 Compute overall score as percentage of passed criteria (0-100)
- [x] Task 2: Integrate with run pipeline (AC: #5)
  - [x] 2.1 Update src/core/pipeline/run-pipeline.ts to call fulfillmentEvaluator when metrics.requirementFulfillment is enabled
- [x] Task 3: Write comprehensive tests (AC: #1-5)
  - [x] 3.1 Create tests/core/evaluators/fulfillment.test.ts with mocked judge client
  - [x] 3.2 Test system prompt instructs JSON array response
  - [x] 3.3 Test user prompt includes transcript and criteria
  - [x] 3.4 Test parseJudgeResponse with valid JSON response
  - [x] 3.5 Test parseJudgeResponse with markdown-wrapped JSON
  - [x] 3.6 Test parseJudgeResponse with invalid/unparseable JSON (all criteria fail)
  - [x] 3.7 Test score computation (e.g., 2/3 = 66.7%)
  - [x] 3.8 Test evaluator returns metric: "requirementFulfillment"
  - [x] 3.9 Test pipeline integration (fulfillment runs alongside efficiency)

## Dev Notes

### Architecture Requirements

- Evaluator interface: `(context: EvalContext) => Promise<EvalResult>` — same as efficiency evaluator
- Judge prompt asks for JSON array with criterion/passed/reasoning fields
- Parse response with fallback: if JSON parse fails, all criteria marked as failed
- Fuzzy criterion matching (normalized lowercase trim) for robustness
- Score = passedCount / totalCount * 100, rounded to 1 decimal
- Details type: `{ criteria: CriterionResult[], passedCount: number, totalCount: number }`

### Project Structure Notes

- File: src/core/evaluators/fulfillment.ts (alongside existing efficiency.ts)
- Depends on: src/core/judge/judge-client.ts (Story 2.1)
- Pipeline update: src/core/pipeline/run-pipeline.ts

### References

- [Source: architecture.md#Evaluator Interface]
- [Source: epics.md#Story 2.2]
- [Source: prd.md#FR23-25]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Completion Notes List

- Implemented fulfillment.ts: LLM-as-judge evaluator with per-criterion PASS/FAIL
- buildSystemPrompt instructs judge to return JSON array with criterion/passed/reasoning
- buildUserPrompt formats transcript messages (including tool calls) and numbered criteria
- parseJudgeResponse handles: valid JSON, markdown-wrapped JSON, invalid JSON (all fail), non-array (all fail), missing criteria (fail), fuzzy case-insensitive matching
- Score computed as passedCount/totalCount * 100 rounded to 1 decimal
- Pipeline integration: fulfillmentEvaluator runs when metrics.requirementFulfillment is enabled
- 16 fulfillment tests + 1 pipeline integration test, 163 total tests passing

### Change Log

- 2026-02-14: Story 2.2 implemented — fulfillment evaluator with judge integration and pipeline wiring

### File List

- src/core/evaluators/fulfillment.ts (new)
- src/core/pipeline/run-pipeline.ts (modified — added fulfillment import and evaluation call)
- tests/core/evaluators/fulfillment.test.ts (new)
- tests/core/pipeline/run-pipeline.test.ts (modified — added judge mock and fulfillment test)
