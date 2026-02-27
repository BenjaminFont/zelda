# Todo App Example

This is an example test case for Zelda that evaluates Claude Code's ability to build a complete full-stack to-do list application from scratch.

## Test Case Overview

**Task:** Build a full-stack to-do list application with Express + TypeScript backend and vanilla JS frontend

**Complexity:** XL (100 turns)

**Key Features:**
- REST API with CRUD operations
- In-memory storage (Map-based)
- Filtering and bulk operations
- Stats endpoint
- Responsive frontend UI
- Comprehensive test suite (80%+ coverage target)
- Error handling and validation

## Running the Evaluation

```bash
cd examples/todo-app

# Ensure you have your ANTHROPIC_API_KEY set
export ANTHROPIC_API_KEY=sk-ant-...

# Run the evaluation
zelda run todo-app
```

## What Gets Evaluated

### Metrics
- **Efficiency:** Token usage, API cost, turn count, tool calls
- **Requirement Fulfillment:** All acceptance criteria checked by LLM judge
- **Tool Usage:** Appropriate use of available tools
- **Functional Correctness:** Build success, test pass/fail, coverage threshold
- **Code Quality:** Static analysis via TypeScript compiler
- **Complexity:** Cyclomatic complexity threshold (25)

### Acceptance Criteria
- All CRUD endpoints functional
- Filtering and bulk operations work
- Stats endpoint accurate
- Input validation with proper error codes
- Dynamic frontend without page reloads
- Responsive design (375px minimum)
- Test coverage ≥80%

## Expected Artifacts

After Claude Code completes the task, the workspace will contain:

```
.zelda/workspaces/<run-id>/
├── src/
│   └── server/
│       ├── app.ts
│       ├── index.ts
│       ├── models/
│       │   └── todo.ts
│       ├── routes/
│       │   └── todos.ts
│       └── middleware/
│           ├── error-handler.ts
│           └── request-logger.ts
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── tests/
│   └── server/
│       ├── routes/
│       ├── models/
│       └── middleware/
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Viewing Results

```bash
# List all evaluation runs
zelda list

# Compare two runs
zelda compare <run-id-1> <run-id-2>

# Inspect workspace
cd .zelda/workspaces/<run-id>
npm install
npm run dev

# Clean up workspaces when done
zelda clean
```

## Purpose

This example demonstrates Zelda's ability to evaluate:
- Complex, multi-file implementations
- Full-stack development (backend + frontend)
- Test-driven development with coverage requirements
- Proper error handling and validation
- API design and RESTful conventions
- Code organization and project structure
