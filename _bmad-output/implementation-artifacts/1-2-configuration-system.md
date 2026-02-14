# Story 1.2: Configuration System

Status: done

## Story

As a **developer using Zelda**,
I want to define project configuration and test suites in YAML files with validation,
So that I can configure how Zelda runs evaluations with clear error messages on invalid input.

## Acceptance Criteria

1. **Given** a valid `zelda.config.yaml` with judgeModel, gatewayUrl, execution defaults, and results directory **When** the config loader reads the file **Then** it returns a validated config object matching the Zod schema (FR2)

2. **Given** a YAML file with invalid or missing required fields **When** the config loader validates it **Then** a `ConfigError` is thrown with a clear, human-readable message describing the validation failure (FR3)

3. **Given** a test suite YAML with prompt, acceptance criteria, execution parameters, and metric toggles **When** the config loader reads the test suite **Then** it returns a validated test suite object with all fields (FR6-9)

4. **Given** a project config and a test suite with overlapping settings **When** the resolver merges them **Then** test suite values override project defaults, and unset test suite values fall back to project defaults (FR4-5)

5. **Given** a `zelda/` directory with multiple `test-*.yaml` files **When** the config loader discovers test suites **Then** all matching files are loaded and validated (FR10)

## Tasks / Subtasks

- [x] Task 1: Create Zod schemas for project config and test suite config (AC: #1, #3)
  - [x] 1.1 Create src/core/config/schemas.ts with ProjectConfigSchema using Zod 4
  - [x] 1.2 Define TestSuiteConfigSchema with prompt, acceptanceCriteria, execution, metrics
  - [x] 1.3 Export inferred types from schemas
- [x] Task 2: Implement config loader with YAML parsing and Zod validation (AC: #1, #2, #3, #5)
  - [x] 2.1 Create src/core/config/loader.ts with loadProjectConfig function
  - [x] 2.2 Implement loadTestSuite function for individual test suite files
  - [x] 2.3 Implement discoverTestSuites function to find all test-*.yaml files in test directory
  - [x] 2.4 Wrap Zod validation errors in ConfigError with clear human-readable messages
- [x] Task 3: Implement config resolver for merging project defaults with test suite overrides (AC: #4)
  - [x] 3.1 Create src/core/config/resolver.ts with resolveConfig function
  - [x] 3.2 Merge execution defaults (test suite overrides project)
  - [x] 3.3 Merge metric toggles (test suite overrides project)
  - [x] 3.4 Merge other overlapping fields with test suite taking priority
- [x] Task 4: Write comprehensive tests (AC: #1-5)
  - [x] 4.1 Create tests/core/config/schemas.test.ts — schema validation tests
  - [x] 4.2 Create tests/core/config/loader.test.ts — loading, discovery, error handling tests
  - [x] 4.3 Create tests/core/config/resolver.test.ts — merge/override tests
  - [x] 4.4 Create test fixtures: sample-config.yaml, sample-test-suite.yaml

## Dev Notes

### Architecture Requirements

From architecture.md:
- `config/schemas.ts` — Zod schemas for project config + test suite config
- `config/loader.ts` — YAML file loading + Zod validation
- `config/resolver.ts` — Merge project defaults with test suite overrides

### Zod 4 Breaking Changes (CRITICAL)

Using Zod 4 (`^4.3.6`), NOT Zod 3:
- String format validators are top-level: `z.email()`, `z.uuid()`, `z.url()` (not `.string().email()`)
- `z.record()` requires two arguments (key schema, value schema)
- Error customization uses `error` not `message`
- Import: `import { z } from "zod"` (Zod 4 default export) or `import { z } from "zod/v4"` (explicit)

### Config File Structures

**zelda.config.yaml:**
```yaml
judgeModel: claude-sonnet-4-5-20250929
gatewayUrl: https://api.portkey.ai/v1
resultsDir: .zelda/runs
testDir: zelda
execution:
  model: claude-sonnet-4-5-20250929
  maxTurns: 25
metrics:
  efficiency: true
  requirementFulfillment: true
  toolUsage: true
  functionalCorrectness: true
```

**zelda/test-example.yaml:**
```yaml
prompt: "Build a REST API endpoint"
acceptanceCriteria:
  - "Endpoint returns 200 on GET /api/health"
  - "Response includes JSON body with status field"
execution:
  model: claude-sonnet-4-5-20250929
  maxTurns: 10
metrics:
  functionalCorrectness: false
buildCommand: npm run build
testCommand: npm test
coverageThreshold: 80
```

### Anti-Patterns to Avoid

- Do NOT use `export default` — named exports only
- Do NOT use TypeScript `enum` — use `as const` or union types
- Do NOT use `null` values — use optional properties
- Do NOT expose Zod types externally — wrap in Zelda-owned types
- YAML keys must be camelCase

### References

- [Source: architecture.md#Config Patterns]
- [Source: architecture.md#Project Structure]
- [Source: epics.md#Story 1.2]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None yet.

### Completion Notes List

- Implemented Zod 4 schemas in schemas.ts: ProjectConfigSchema (judgeModel, gatewayUrl as z.url(), resultsDir, testDir, optional execution/metrics), TestSuiteConfigSchema (prompt, acceptanceCriteria min 1, optional execution/metrics/build/test/coverage)
- Implemented loader.ts: loadProjectConfig, loadTestSuite, discoverTestSuites — all with YAML parsing, Zod validation, ConfigError wrapping
- Implemented resolver.ts: resolveConfig merges project + suite with spread operator, suite overrides project
- 36 new tests across 3 test files (schemas: 17, loader: 11, resolver: 8)
- All architecture patterns followed: kebab-case files, named exports, no barrel files, camelCase YAML keys, ConfigError for all failures
- TypeScript typecheck clean, all 56 tests passing

### Change Log

- 2026-02-14: Story 1.2 created and implementation started
- 2026-02-14: Story 1.2 implementation complete — schemas, loader, resolver with 36 tests

### File List

- src/core/config/schemas.ts (new)
- src/core/config/loader.ts (new)
- src/core/config/resolver.ts (new)
- tests/core/config/schemas.test.ts (new)
- tests/core/config/loader.test.ts (new)
- tests/core/config/resolver.test.ts (new)
- tests/fixtures/sample-config.yaml (new)
- tests/fixtures/sample-test-suite.yaml (new)
