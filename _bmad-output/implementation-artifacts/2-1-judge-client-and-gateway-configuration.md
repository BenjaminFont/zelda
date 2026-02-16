# Story 2.1: Judge Client & Gateway Configuration

Status: review

## Story

As a **developer using Zelda**,
I want judge LLM calls routed through a configurable gateway,
So that I can control which model evaluates my code and route through Portkey.

## Acceptance Criteria

1. **Given** a `zelda.yaml` with `judgeModel` and `gatewayUrl` settings **When** the judge client is initialized **Then** it uses the configured model and routes calls through the specified Portkey endpoint (FR29-30)

2. **Given** gateway credentials (`PORTKEY_API_KEY`, `PORTKEY_GATEWAY_URL`) **When** the judge client reads credentials **Then** they are read from environment variables, separate from `ANTHROPIC_API_KEY` used for execution (FR31)

3. **Given** the judge client module **When** external code imports it **Then** no Anthropic SDK types leak beyond the module — only Zelda-owned types (`JudgeResponse`, etc.) are exposed (NFR11)

4. **Given** a judge API call that fails **When** the error is transient (network timeout, rate limit) **Then** the system retries with backoff before throwing `JudgeError` (FR32)

5. **Given** a judge API call that fails after retries **When** the error is final **Then** a `JudgeError` is thrown with a clear `userMessage` and the system degrades gracefully — no data loss of captured transcript (NFR12)

## Tasks / Subtasks

- [x] Task 1: Implement judge client module (AC: #1, #2, #3)
  - [x] 1.1 Create src/core/judge/judge-client.ts with JudgeRequest, JudgeResponse, JudgeClientOptions types
  - [x] 1.2 Implement createClient using Anthropic SDK with baseURL for gateway routing
  - [x] 1.3 Implement credential separation (PORTKEY_API_KEY / ANTHROPIC_API_KEY fallback)
  - [x] 1.4 Implement judgeQuery function that sends system+user prompt and returns Zelda-owned JudgeResponse
- [x] Task 2: Implement retry logic with exponential backoff (AC: #4, #5)
  - [x] 2.1 Implement isTransientError detection (429, 5xx, network errors)
  - [x] 2.2 Implement exponential backoff retry loop (1s, 2s, 4s)
  - [x] 2.3 Throw JudgeError with clear userMessage after final failure
- [x] Task 3: Write comprehensive tests (AC: #1-5)
  - [x] 3.1 Create tests/core/judge/judge-client.test.ts with mocked Anthropic SDK
  - [x] 3.2 Test system+user prompt forwarding to API
  - [x] 3.3 Test JudgeResponse contains only Zelda-owned fields
  - [x] 3.4 Test retry on transient errors (429, 500)
  - [x] 3.5 Test success after retry recovery
  - [x] 3.6 Test no retry on non-transient errors
  - [x] 3.7 Test JudgeError with clear userMessage on final failure

## Dev Notes

### Architecture Requirements

- Thin wrapper module — sole consumer of Anthropic SDK for judge calls
- No SDK types leak beyond judge-client.ts — only JudgeResponse, JudgeRequest, JudgeClientOptions exported
- Credential separation: execution uses ANTHROPIC_API_KEY, judge uses PORTKEY_API_KEY (falling back to ANTHROPIC_API_KEY)
- Exponential backoff for transient failures (429, 5xx, network)
- JudgeError from error hierarchy for all final failures
- Non-streaming messages.create for judge calls

### Project Structure Notes

- File: src/core/judge/judge-client.ts (kebab-case, named exports only)
- Error class: JudgeError from src/core/errors.ts (already exists)
- SDK: @anthropic-ai/sdk ^0.74.0 (already installed, supports baseURL for gateway routing)

### References

- [Source: architecture.md#SDK Integration]
- [Source: epics.md#Story 2.1]
- [Source: prd.md#FR29-32]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Completion Notes List

- Implemented judge-client.ts: thin Anthropic SDK wrapper with baseURL for Portkey gateway routing
- JudgeRequest/JudgeResponse/JudgeClientOptions — Zelda-owned types only, no SDK leakage
- Credential chain: apiKey param -> PORTKEY_API_KEY -> ANTHROPIC_API_KEY
- Retry with exponential backoff (1s, 2s, 4s) for transient errors (429, 5xx, network)
- isTransientError detects rate limits, server errors, timeout/connection errors
- JudgeError thrown with clear userMessage after all retries exhausted
- 10 tests covering prompt forwarding, response parsing, retry behavior, error handling
- 146 total tests passing, no regressions

### Change Log

- 2026-02-14: Story 2.1 implemented — judge client with gateway routing and retry logic

### File List

- src/core/judge/judge-client.ts (new)
- tests/core/judge/judge-client.test.ts (new)
