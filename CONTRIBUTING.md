# Contributing to n8n-mcp

Thanks for your interest in contributing! This document describes the local development workflow, validation steps, and helpful commands.

## Prerequisites
- Node.js 18, 20, or 22 (project is tested against all three)
- npm

## Setup
```bash
npm install
npm run build
```

## Development
- Watch mode: `npm run dev`
- Lint/typecheck: `npm run lint`

## Testing
```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## Local CLI (from repository)
When working from a local checkout, use the npm script that runs the built CLI:
```bash
npm run cli list
npm run cli get 1
npm run cli create examples/example-workflow.json
npm run cli delete 1
npm run cli activate 1
npm run cli deactivate 1
npm run cli executions list
npm run cli variables list
npm run cli tags list
```

Pagination and flags examples:
```bash
npm run cli list -- --limit 25 --cursor NEXT_CURSOR
npm run cli executions list -- --limit 50 --workflow-id 1
```
(Note the `--` to pass flags through npm when needed.)

## Local MCP server (from repository)
Start the stdio MCP server directly from the build output:
```bash
npm start
```
This runs `node dist/index.js` and prints status to stderr. Ensure required environment variables are set (see README).

## Validation Checklist (before committing)
Run these fast checks locally to match CI:
```bash
npm run lint
npm run build
npm test
npm run test:coverage
```

## Pull Requests
- Follow existing code style
- Add or update tests when changing behavior
- Include issue auto-closing keywords in the PR description (e.g., `Fixes #12`)

Thanks again for contributing!