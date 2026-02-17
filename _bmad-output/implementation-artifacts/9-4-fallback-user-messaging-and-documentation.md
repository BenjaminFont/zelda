# Story 9.4: Fallback, User Messaging & Documentation

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer setting up Zelda**,
I want clear guidance on installing agentbox and understanding execution modes,
so that I can set up containerized execution quickly or understand why local mode is being used.

## Acceptance Criteria

1. **Given** Docker/Podman is not installed **When** Zelda falls back to local execution **Then** a yellow warning is displayed: "Docker/Podman not found. Running in local mode. Containerized execution is recommended for host isolation." (FR77)
2. **Given** agentbox is not installed but Docker is available **When** Zelda cannot find the agentbox binary **Then** a clear error is displayed with installation instructions: clone repo, make executable, add to PATH
3. **Given** `zelda init` scaffolds a new project **When** the generated `zelda.config.yaml` is created **Then** it includes the `execution.backend` field with a comment explaining container vs. local modes
4. **Given** a successful containerized run **When** the terminal reporter shows results **Then** a subtle indicator shows the execution mode used (e.g., "Executed in: container" in dim text)
5. **Given** a successful local run **When** the terminal reporter shows results **Then** the execution mode is shown as "local"

## Tasks / Subtasks

- [ ] Task 1: Update init config template (AC: #3)
  - [ ] 1.1 Add `backend` field to `DEFAULT_CONFIG` inline string in `init-project.ts`
  - [ ] 1.2 Add `agentboxPath` as a commented-out option
  - [ ] 1.3 Add inline comment explaining container vs. local modes
  - [ ] 1.4 Update init tests to verify new fields in generated config
- [ ] Task 2: Add execution mode to terminal reporter (AC: #4, #5)
  - [ ] 2.1 Add "Executed in" line to `renderRunHeader()` in `terminal-reporter.ts`
  - [ ] 2.2 Show `container` (green) or `local` (dim) based on run metadata
  - [ ] 2.3 Update reporter tests for new header line
- [ ] Task 3: Add execution mode to compare reporter (AC: #4, #5)
  - [ ] 3.1 Show execution mode in run metadata section of compare output
  - [ ] 3.2 Update compare reporter tests
- [ ] Task 4: Verify warning and error messages (AC: #1, #2)
  - [ ] 4.1 Verify yellow fallback warning from Story 9.1's runtime detector is displayed correctly
  - [ ] 4.2 Verify red agentbox-not-found error includes installation instructions
  - [ ] 4.3 Add integration tests for warning/error message display
- [ ] Task 5: Persist execution mode in run results (AC: #4, #5)
  - [ ] 5.1 Add `executionBackend` field to `RunResult` type in `types.ts`
  - [ ] 5.2 Set field in pipeline when building `RunResult`
  - [ ] 5.3 Update result persistence tests

## Dev Notes

### Architecture Patterns & Constraints

- **Inline template strings**: Init templates are `const` multiline strings in `init-project.ts`, NOT external files
- **Chalk conventions**: green=pass, red=fail, yellow=warning, cyan=labels, dim=secondary
- **No emojis** in terminal output
- **Named exports only**, no `export default`, no barrel files
- **kebab-case.ts** file naming

### Init Template Update

**Location**: `src/core/init/init-project.ts`

The `DEFAULT_CONFIG` constant is a multiline template string. Add `backend` to the existing `execution:` section:

```typescript
const DEFAULT_CONFIG = `# Zelda configuration
# See documentation for all available options

# Model used for LLM-as-judge evaluations
judgeModel: claude-sonnet-4-5-20250929

# AI gateway URL (Portkey, LiteLLM, or direct Anthropic)
gatewayUrl: https://api.anthropic.com/v1

# Directory where run results are stored
resultsDir: .zelda/runs

# Directory containing test suite YAML files
testDir: zelda

# Default execution settings (can be overridden per test suite)
# taskSize: small (10 turns), medium (25), large (50), xl (100)
# backend: container (recommended, requires Docker + agentbox) or local
execution:
  model: claude-sonnet-4-5-20250929
  taskSize: medium
  backend: container
  # agentboxPath: /path/to/agentbox  # optional, auto-detected from PATH

# Default metric toggles (can be overridden per test suite)
metrics:
  efficiency: true
  # requirementFulfillment: true
  # toolUsage: true
  # functionalCorrectness: true
`;
```

**Key changes:**
- Added comment explaining `backend` options
- Added `backend: container` as default value
- Added commented `agentboxPath` with explanation
- Kept consistent style with existing comments

### Terminal Reporter: Execution Mode Display

**Location**: `src/core/reporter/terminal-reporter.ts`

Add to `renderRunHeader()` after the Model line, following the exact existing pattern:

```typescript
export const renderRunHeader = (run: RunResult): string => {
  const lines: string[] = [];
  lines.push(chalk.bold(`\n Zelda Evaluation Results`));
  lines.push(`  ${chalk.cyan(padLabel('Run ID'))} ${chalk.dim(run.id)}`);
  lines.push(`  ${chalk.cyan(padLabel('Test Suite'))} ${run.testSuite.name}`);
  lines.push(`  ${chalk.cyan(padLabel('Timestamp'))} ${chalk.dim(run.timestamp)}`);
  lines.push(`  ${chalk.cyan(padLabel('Model'))} ${run.testSuite.execution.model ?? chalk.dim('default')}`);
  // NEW: Execution mode indicator
  const backendLabel = run.executionBackend === 'container'
    ? chalk.green('container')
    : chalk.dim('local');
  lines.push(`  ${chalk.cyan(padLabel('Executed in'))} ${backendLabel}`);
  if (run.workspacePath) {
    lines.push(`  ${chalk.cyan(padLabel('Workspace'))} ${chalk.dim(run.workspacePath)}`);
  }
  return lines.join('\n');
};
```

**Output example:**
```
 Zelda Evaluation Results
  Run ID:          run-api-20260214
  Test Suite:      test-api
  Timestamp:       2026-02-14T10:00:00.000Z
  Model:           claude-sonnet-4-5-20250929
  Executed in:     container          ← green for container
  Workspace:       .zelda/workspaces/run-api-20260214
```

Or for local mode:
```
  Executed in:     local              ← dim for local
```

### Compare Reporter: Execution Mode in Metadata

**Location**: `src/core/reporter/compare-reporter.ts`

Add to the run metadata section at the bottom of the comparison:

```typescript
// Existing pattern:
lines.push(`  ${chalk.dim('Run A:')} ${chalk.dim(runA.id)} (${runA.testSuite.name})`);
lines.push(`  ${chalk.dim('Run B:')} ${chalk.dim(runB.id)} (${runB.testSuite.name})`);

// NEW: Add execution mode
const modeA = runA.executionBackend ?? 'local';
const modeB = runB.executionBackend ?? 'local';
if (modeA !== modeB) {
  lines.push(`  ${chalk.yellow('Note:')} Runs used different execution modes (${modeA} vs ${modeB})`);
}
```

### RunResult Type Extension

**Location**: `src/core/types.ts`

Add `executionBackend` to the `RunResult` type:

```typescript
export type RunResult = {
  id: string;
  timestamp: string;
  testSuite: {
    name: string;
    // ... existing fields
  };
  metrics: Record<string, EvalResult>;
  workspacePath?: string;
  executionBackend?: 'container' | 'local';  // NEW
};
```

**Pipeline integration** (`run-pipeline.ts`):
```typescript
const runResult: RunResult = {
  id: runId,
  timestamp: new Date().toISOString(),
  testSuite: { name: suiteName, execution: resolvedConfig.execution },
  metrics,
  workspacePath,
  executionBackend: resolvedConfig.execution.backend ?? 'local',  // NEW
};
```

### Warning & Error Messages

These messages are implemented in Stories 9.1 (runtime detector) and 9.3 (container adapter). This story verifies they display correctly end-to-end.

**Fallback warning** (from `runtime-detector.ts`, Story 9.1):
```typescript
// When Docker/Podman not found:
console.log(chalk.yellow(
  'Docker/Podman not found. Running in local mode. ' +
  'Containerized execution is recommended for host isolation. ' +
  'See: https://github.com/fletchgqc/agentbox'
));
```

**Agentbox not found error** (from `runtime-detector.ts`, Story 9.1):
```typescript
throw new ExecutionError(
  'agentbox binary not found',
  'AGENTBOX_NOT_FOUND',
  'agentbox not found. Install agentbox for containerized execution:\n' +
  '  git clone https://github.com/fletchgqc/agentbox\n' +
  '  chmod +x agentbox/agentbox\n' +
  '  Add agentbox directory to your PATH',
);
```

**This story should verify:**
- Warning is visible in terminal during `zelda run`
- Error message includes actionable install steps
- Colors are correct (yellow for warning, red for error)

### Test Patterns

**Init tests** (`tests/core/init/init-project.test.ts`):
```typescript
it('generated config includes backend field', () => {
  initProject(tempDir);
  const config = readFileSync(join(tempDir, 'zelda.yaml'), 'utf-8');
  expect(config).toContain('backend: container');
  expect(config).toContain('# agentboxPath:');
});
```

**Reporter tests** (`tests/core/reporter/terminal-reporter.test.ts`):
```typescript
it('shows execution mode in run header', () => {
  const run: RunResult = {
    ...baseRun,
    executionBackend: 'container',
  };
  const output = renderRunHeader(run);
  expect(output).toContain('Executed in');
  expect(output).toContain('container');
});

it('shows local mode when executionBackend is local', () => {
  const run: RunResult = {
    ...baseRun,
    executionBackend: 'local',
  };
  const output = renderRunHeader(run);
  expect(output).toContain('local');
});

it('defaults to local when executionBackend is not set', () => {
  const run: RunResult = { ...baseRun };
  delete run.executionBackend;
  const output = renderRunHeader(run);
  expect(output).toContain('local');
});
```

**Compare reporter tests** (`tests/core/reporter/compare-reporter.test.ts`):
```typescript
it('shows note when execution modes differ', () => {
  const comparison: ComparisonResult = {
    runA: { ...baseRun, executionBackend: 'container' },
    runB: { ...baseRun, executionBackend: 'local' },
    deltas: [...],
  };
  const output = renderComparison(comparison);
  expect(output).toContain('different execution modes');
});
```

**Important**: Chalk disables colors in non-TTY environments (vitest). Do NOT test for ANSI escape codes directly. Test for text content only.

### Previous Story Intelligence

**Story 9.1 provides:**
- Runtime detection with fallback logic — warning messages already implemented
- `ExecutionError` with `AGENTBOX_NOT_FOUND` code — error messages already implemented
- `backend` field in config schema

**Story 9.2 provides:**
- Container lifecycle — this story doesn't modify lifecycle behavior

**Story 9.3 provides:**
- `resolveExecutionBackend()` factory — execution mode is determined here
- `executionBackend` value flows from resolved config through execution

**This story is the polish layer** — it ensures the user experience is clear, the init templates are updated, and the execution mode is visible in all reports.

### Project Structure Notes

**New files to create:**
- None

**Existing files to modify:**
- `src/core/init/init-project.ts` — update `DEFAULT_CONFIG` inline string
- `src/core/reporter/terminal-reporter.ts` — add execution mode to `renderRunHeader()`
- `src/core/reporter/compare-reporter.ts` — add execution mode to metadata section
- `src/core/types.ts` — add `executionBackend` to `RunResult`
- `src/core/pipeline/run-pipeline.ts` — set `executionBackend` in `RunResult`
- `tests/core/init/init-project.test.ts` — verify backend in generated config
- `tests/core/reporter/terminal-reporter.test.ts` — verify execution mode display
- `tests/core/reporter/compare-reporter.test.ts` — verify mode comparison note

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 9, Story 9.4]
- [Source: _bmad-output/planning-artifacts/prd.md — FR77]
- [Source: src/core/init/init-project.ts — DEFAULT_CONFIG inline template, initProject() function]
- [Source: src/core/reporter/terminal-reporter.ts — renderRunHeader(), padLabel(), chalk patterns]
- [Source: src/core/reporter/compare-reporter.ts — renderComparison(), run metadata section]
- [Source: src/core/types.ts — RunResult type]
- [Source: _bmad-output/implementation-artifacts/9-1-execution-backend-configuration-and-runtime-detection.md]
- [Source: _bmad-output/implementation-artifacts/9-2-container-lifecycle-manager.md]
- [Source: _bmad-output/implementation-artifacts/9-3-container-execution-adapter.md]

### Git Intelligence

- Commit convention: `feat(story-9-4): fallback messaging and execution mode display`
- Reporter module has 4 files — 2 of them modified here
- Init module is a single file — straightforward update

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
