# Story 6.1: Transcript Chunking & Synthesis

Status: done

## Story

As a **developer using Zelda**,
I want large Claude Code transcripts handled automatically,
So that judge evaluations work reliably even for complex, long-running sessions.

## Acceptance Criteria

1. **Given** a transcript that fits within the judge LLM's context capacity **When** the transcript manager evaluates size **Then** it routes the transcript directly to the judge — single call, full fidelity (FR42)

2. **Given** a transcript that exceeds the judge LLM's context capacity **When** the transcript manager detects this **Then** it splits the transcript at turn boundaries using the token budget (80% of context limit), never splitting mid-turn (FR39-40)

3. **Given** chunked transcript evaluation **When** each chunk is evaluated independently **Then** incremental results are synthesized into a cohesive final assessment without losing critical information (FR41)

4. **Given** token estimation **When** the transcript manager estimates size **Then** it uses a character-count heuristic (chars / 4)

5. **Given** the transcript manager **When** integrated with requirement fulfillment and tool usage evaluators **Then** both judge-based evaluators use transcript management transparently — chunking is applied when needed without evaluator changes

## Tasks / Subtasks

- [x] Task 1: Implement transcript chunking (AC: #1, #2, #4)
  - [x] 1.1 Create src/core/transcript/chunker.ts
  - [x] 1.2 Implement estimateTokens (chars / 4 heuristic)
  - [x] 1.3 Implement chunkTranscript that splits at turn boundaries
  - [x] 1.4 Use 80% of context limit as token budget per chunk
  - [x] 1.5 Never split mid-turn — each chunk contains complete messages
  - [x] 1.6 Return single chunk for small transcripts (pass-through)
- [x] Task 2: Implement synthesis (AC: #3)
  - [x] 2.1 Create src/core/transcript/synthesizer.ts
  - [x] 2.2 For fulfillment: merge per-criterion results across chunks (worst result wins per criterion)
  - [x] 2.3 For tool usage: merge used/missed tools across chunks (union, sum counts, dedupe missed)
- [x] Task 3: Integrate with evaluators (AC: #5)
  - [x] 3.1 Update fulfillment evaluator to use transcript chunking when needed
  - [x] 3.2 Update tool usage evaluator to use transcript chunking when needed
- [x] Task 4: Write tests (AC: #1-5)
  - [x] 4.1 Test small transcript passes through as single chunk (12 chunker tests)
  - [x] 4.2 Test large transcript splits at turn boundaries
  - [x] 4.3 Test never splits mid-turn
  - [x] 4.4 Test token estimation heuristic
  - [x] 4.5 Test fulfillment synthesis — worst-result-wins (5 tests)
  - [x] 4.6 Test tool usage synthesis — union merge, dedup, count sum (7 tests)

## Dev Notes

### Architecture Requirements

- Token budget: 80% of context limit (default 200k tokens → 160k budget)
- Character-count heuristic: chars / 4
- Turn-boundary chunking: never split mid-turn
- Fulfillment synthesis: conservative (if any chunk says FAIL, criterion is FAIL)
- Tool usage synthesis: union of all used/missed tools across chunks
- Transparent integration: evaluators don't need to know about chunking

### Project Structure Notes

- New file: src/core/transcript/chunker.ts
- New file: src/core/transcript/synthesizer.ts
- Update: src/core/evaluators/fulfillment.ts
- Update: src/core/evaluators/tool-usage.ts

### References

- [Source: architecture.md#Transcript Management]
- [Source: epics.md#Story 6.1]
- [Source: prd.md#FR39-42]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Completion Notes List

- All 280 tests pass across 24 test files (24 new transcript tests)
- TypeScript compiles cleanly, build succeeds
- Chunking is transparent: evaluators use needsChunking + chunkTranscript
- Fulfillment synthesis: worst-result-wins per criterion
- Tool usage synthesis: union of used (sum counts), dedup missed (remove if found in used)
- Default context limit: 200k tokens, 80% budget per chunk
- All 6 epics complete

### File List

- src/core/transcript/chunker.ts (new)
- src/core/transcript/synthesizer.ts (new)
- src/core/evaluators/fulfillment.ts (modified — added chunking integration)
- src/core/evaluators/tool-usage.ts (modified — added chunking integration)
- tests/core/transcript/chunker.test.ts (new, 12 tests)
- tests/core/transcript/synthesizer.test.ts (new, 12 tests)
