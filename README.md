# Zelda

Evaluation framework for the Claude Code tooling ecosystem. Define test suites, run Claude Code in isolated workspaces, and measure what matters: requirement fulfillment, tool usage effectiveness, functional correctness, and efficiency.

## Quick Start

```bash
npm install
npm run build

# Initialize in your project
zelda init

# Edit zelda/test-example.yaml with your prompt and criteria

# Run an evaluation
zelda run example
```

## Setup

### Prerequisites

- Node.js >= 20
- An Anthropic API key

### Environment Variables

```bash
# Required: used by Claude Code for execution
export ANTHROPIC_API_KEY=sk-ant-...

# Optional: if routing judge calls through Portkey
export PORTKEY_API_KEY=pk-...
```

### Installation

```bash
npm install -g zelda    # global install
# or
npx zelda              # run without installing
```

## Configuration

### Project Config (`zelda.yaml`)

Created by `zelda init` in your project root.

```yaml
# Model used for LLM-as-judge evaluations
judgeModel: claude-sonnet-4-5-20250929

# AI gateway URL (Portkey, LiteLLM, or direct Anthropic)
# Note: omit /v1 suffix — the SDK appends it automatically
gatewayUrl: https://api.anthropic.com

# Directory where run results are stored
resultsDir: .zelda/runs

# Directory containing test suite YAML files
testDir: zelda

# Default execution settings (can be overridden per test suite)
# taskSize: small (10 turns), medium (25), large (50), xl (100)
execution:
  model: claude-sonnet-4-5-20250929
  taskSize: medium

# Default metric toggles (can be overridden per test suite)
metrics:
  efficiency: true
  requirementFulfillment: true
  toolUsage: true
  functionalCorrectness: true
```

### Test Suite Config (`zelda/test-<name>.yaml`)

Each test suite defines a prompt, acceptance criteria, and optional overrides.

```yaml
prompt: |
  Create a REST API with GET /api/hello that returns
  { "message": "Hello, World!" } with a 200 status code.

acceptanceCriteria:
  - The endpoint GET /api/hello exists and is reachable
  - The response status code is 200
  - The response body is valid JSON with a "message" field
  - The message value is "Hello, World!"

# Override execution settings for this suite
execution:
  taskSize: small    # or: maxTurns: 15 (explicit maxTurns overrides taskSize)

# Override which metrics are evaluated
metrics:
  efficiency: true
  requirementFulfillment: true
  toolUsage: true
  functionalCorrectness: true

# Functional correctness commands (run in workspace after Claude finishes)
buildCommand: npm run build
testCommand: npm test
coverageThreshold: 80
```

### Task Size

Instead of specifying raw `maxTurns`, use `taskSize` for a human-friendly abstraction:

| taskSize | maxTurns | Use case |
|----------|----------|----------|
| `small`  | 10       | Single file fix, simple function |
| `medium` | 25       | Multi-file feature, basic tests |
| `large`  | 50       | Full-stack feature with tests and review |
| `xl`     | 100      | Complex app from scratch, full test suite |

If both `taskSize` and `maxTurns` are set, explicit `maxTurns` takes priority. A test suite's `taskSize` overrides any project-level `maxTurns`.

## Commands

### `zelda init`

Scaffolds a new Zelda project in the current directory.

```bash
zelda init           # create config + example test suite
zelda init --force   # overwrite existing files
```

Creates:
- `zelda.yaml` — project configuration
- `zelda/test-example.yaml` — example test suite
- Updates `.gitignore` with `.zelda/`

### `zelda run [test-name]`

Run the evaluation pipeline.

```bash
zelda run            # run all test suites in zelda/
zelda run example    # run only zelda/test-example.yaml
```

The pipeline:
1. Loads and validates config
2. Creates an isolated workspace (git worktree at repo root, or directory copy for subdirectories/non-git)
3. Executes Claude Code with your prompt
4. Runs enabled evaluators
5. Persists results to `.zelda/runs/<run-id>/`
6. Displays a colored terminal report (includes workspace path)

### `zelda apply <run-id>`

Apply code changes from a run's workspace back to your project.

```bash
zelda apply <run-id>           # apply changes to project
zelda apply <run-id> --dry-run # preview changes without applying
```

For git worktree workspaces, this extracts the diff and applies it with `git apply`. For directory-copy workspaces, it copies modified files back.

### `zelda clean [run-id]`

Remove evaluation workspaces.

```bash
zelda clean           # remove all workspaces
zelda clean <run-id>  # remove a specific workspace
```

Workspaces persist after each run at `.zelda/workspaces/<run-id>` so you can inspect the generated code. Use `zelda clean` to reclaim disk space when done.

### `zelda list`

Browse past evaluation runs.

```bash
zelda list
```

Shows run ID, test suite name, date, and key metric scores for each past run.

### `zelda compare <run1> <run2>`

Compare two runs side-by-side.

```bash
zelda compare test-api-2026-02-14T10-00-00-000 test-api-2026-02-15T14-30-00-000
```

Shows metric scores from both runs with deltas — green for improvements, red for regressions.

## Metrics

### Efficiency

Computed directly from session telemetry. No LLM judge call needed.

- Total tokens (input + output)
- API cost in USD
- Turn count and wall-clock duration
- Tool call counts grouped by type (Read, Write, Bash, etc.)
- Error and retry count

### Requirement Fulfillment

LLM-as-judge evaluation of each acceptance criterion.

- Per-criterion PASS/FAIL with reasoning
- Overall score = percentage of criteria met
- Automatically chunks large transcripts for reliable evaluation

### Tool Usage

Scans your `.claude/` directory for available tools, then uses an LLM judge to analyze whether Claude Code effectively used them. Distinguishes between two categories:

- **Invocable tools** (skills, sub-agents, MCP): Checked for explicit invocation in the transcript
- **Rules**: Checked for output compliance — rules are implicit context loaded into Claude Code's memory, not tool calls

Scans: `.claude/commands/*.md` (skills), `.claude/rules/*.md`, `.claude/agents/*.md`, `mcp.json`

Results include:
- Invocable tools used (with frequency) and tools missed
- Rule compliance assessment per rule
- Overall utilization effectiveness score

### Functional Correctness

Runs build and test commands in the workspace after Claude Code finishes.

- Build status (PASS/FAIL from exit code)
- Test pass/fail counts (parses Jest, vitest, TAP output)
- Coverage percentage with optional threshold checking
- Score weighted: build 30-40%, tests 50-60%, coverage 20%

## Project Structure

```
your-project/
  zelda.yaml              # project config
  zelda/                   # test suite directory
    test-api.yaml          # test suite file
    test-auth.yaml         # another test suite
  .zelda/                  # gitignored
    runs/                  # persisted results
      test-api-2026.../
        result.json        # metric scores + config snapshot
        transcript.json    # full session transcript
    workspaces/            # persistent (use `zelda clean` to remove)
```

## Tool Usage Detection

Zelda scans your `.claude/` directory to build a tools manifest:

```
.claude/
  commands/         # Skills (slash commands) — checked for invocation
    deploy.md
    test.md
  rules/            # Rules — checked for output compliance
    no-console.md
  agents/           # Sub-agents — checked for invocation
    reviewer.md
  mcp.json          # MCP server configurations — checked for invocation
```

The tool usage evaluator analyzes two things:
- **Invocable tools** (skills, sub-agents, MCP): Were they explicitly called during the session?
- **Rules**: Did the generated code comply with the rule's guidelines? Rules are implicit context — they're loaded into Claude Code's memory automatically, not invoked as tool calls. Rules with `paths:` frontmatter are only evaluated when matching files were touched.

## Development

```bash
npm run build        # build with tsup
npm run dev          # watch mode
npm test             # run tests (vitest)
npm run test:watch   # watch mode
npm run typecheck    # tsc --noEmit
```

## License

MIT
