# n8n-mcp: MCP Server for n8n Workflow Management

An MCP (Model Context Protocol) server for managing n8n workflows. This TypeScript Node.js project provides both a stdio MCP server and CLI interface for creating, retrieving, updating, and managing n8n workflows through the n8n API.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Bootstrap, Build, and Test
**CRITICAL**: All commands have been validated and measured. Set appropriate timeouts and NEVER CANCEL builds or tests.

```bash
# Install dependencies - takes ~11 seconds
npm install

# Lint TypeScript code - takes ~2 seconds  
npm run lint

# Build TypeScript to JavaScript - takes ~2 seconds
npm run build

# Run full test suite - takes ~6 seconds
npm test

# Run tests with coverage - takes ~9 seconds. NEVER CANCEL. Set timeout to 30+ seconds.
npm run test:coverage
```

**TIMEOUT REQUIREMENTS**:
- `npm install`: 60+ seconds (network dependent)
- `npm run build`: 30 seconds  
- `npm run test`: 30 seconds
- `npm run test:coverage`: 60 seconds
- NEVER CANCEL any build or test command - wait for completion

### Development Workflow
```bash
# Start development watch mode (rebuilds on file changes)
npm run dev

# Start the MCP server (requires environment variables)
npm start

# Use CLI interface for testing
npm run cli [command]
```

### Environment Configuration
The application requires n8n instance configuration via environment variables:

```bash
# Option 1: API Key Authentication (recommended)
export N8N_BASE_URL=http://localhost:5678
export N8N_API_KEY=your_api_key_here

# Option 2: Basic Authentication
export N8N_BASE_URL=http://localhost:5678
export N8N_USERNAME=your_username
export N8N_PASSWORD=your_password
```

## Validation Scenarios

### Manual Validation Requirements
**ALWAYS** perform these validation steps after making changes:

1. **Build Validation**: Run `npm run build` and verify no TypeScript errors
2. **Test Validation**: Run `npm test` and verify all 29 tests pass
3. **CLI Functionality**: Test `npm run cli` shows help menu correctly
4. **Server Startup**: Verify server starts with appropriate environment variables
5. **Lint Validation**: Run `npm run lint` before committing (CI requirement)

### End-to-End Testing
```bash
# Test CLI help
npm run cli

# Test server startup (requires environment variables)
N8N_BASE_URL=http://localhost:5678 N8N_API_KEY=test npm start

# Validate example workflow JSON structure
cat examples/example-workflow.json | jq .
```

### CI/CD Validation
**ALWAYS** run these commands before committing to match CI pipeline:
```bash
npm ci          # Clean install (CI uses this, not npm install)
npm run lint    # TypeScript type checking
npm run build   # Build project
npm run test    # Run test suite
npm run test:coverage  # Produce coverage/lcov.info (uploaded to Coveralls in CI)
```

**CI Pipeline Requirements**: The project tests against Node.js versions 18.x, 20.x, and 22.x. Current development uses Node.js v20.19.4. Coverage is uploaded to Coveralls (parallel uploads with a finalize step).

## Pull Request Hygiene: Auto-close Issues

**ALWAYS** include a closing keyword in the PR description body so GitHub auto-closes related issues when the PR merges.

- Use one of: `Fixes #<issue>`, `Closes #<issue>`, or `Resolves #<issue>`
- Put the keywords in the PR BODY (not only the title or commits)
- For multiple issues, list each keyword on its own line
- This works with squash merges as long as the PR body contains the keywords

Example:

```
Implements execution management tools and CLI.

Fixes #12
```

Copilot coding agent guideline: When opening PRs for this repo, always add the correct closing keywords for any issues being addressed. If a PR merged without the keywords, add a comment on the issue referencing the PR and close the issue manually.

## Architecture and Key Components

### Project Structure
```
/home/runner/work/n8n-mcp/n8n-mcp/
├── src/
│   ├── index.ts          # Main MCP server implementation
│   ├── cli.ts            # CLI interface
│   ├── n8n-client.ts     # n8n API client
│   ├── types.ts          # TypeScript type definitions
│   └── __tests__/        # Jest test suite (29 tests)
├── examples/             # Example workflows and documentation
├── dist/                 # Built JavaScript output
├── .github/workflows/    # CI/CD pipelines
└── package.json          # Node.js configuration
```

### Available MCP Tools
1. **list_workflows** - List all workflows
2. **get_workflow** - Get workflow by ID  
3. **create_workflow** - Create a new workflow
4. **update_workflow** - Update existing workflow
5. **delete_workflow** - Delete a workflow
6. **activate_workflow** - Activate a workflow
7. **deactivate_workflow** - Deactivate a workflow

### Key Files to Monitor
- **src/index.ts**: Main server logic - modify when adding new MCP tools
- **src/n8n-client.ts**: API client - modify when changing n8n integration
- **src/types.ts**: Type definitions - modify when adding new data structures
- **src/cli.ts**: CLI interface - modify when adding new CLI commands

## Technology Stack

### Dependencies
- **Runtime**: Node.js (v18.x, 20.x, 22.x supported)
- **Language**: TypeScript with ESNext modules
- **Testing**: Jest with ts-jest preset
- **MCP SDK**: @modelcontextprotocol/sdk v1.17.5
- **HTTP Client**: axios v1.6.0

### Configuration Files
- **tsconfig.json**: TypeScript compiler configuration (ESNext modules)
- **jest.config.js**: Test configuration with ESM support
- **package.json**: ESM project with type: "module"

## Common Development Tasks

### Adding New MCP Tools
1. Add tool definition to `ListToolsRequestSchema` handler in `src/index.ts`
2. Add case to `CallToolRequestSchema` handler 
3. Implement handler method following existing patterns
4. Add corresponding method to `N8nClient` if needed
5. Add unit tests in `src/__tests__/`
6. Run full validation sequence

### Debugging Connection Issues
- Check environment variables are set correctly
- Verify n8n instance is accessible at configured URL
- Test with CLI first: `npm run cli list`
- Check error logs in server stderr output

### Working with Workflows
- Example workflows available in `examples/` directory
- Use `examples/example-workflow.json` as template for new workflows
- Workflow structure requires: name, nodes, connections, active, tags

## Build Artifacts and Deployment

### Generated Files (Excluded from Git)
```bash
dist/           # TypeScript compilation output
node_modules/   # npm dependencies  
coverage/       # Test coverage reports
*.log          # Log files
```

### Release Process
1. Automated via GitHub Releases (tag publish)
2. Triggers `.github/workflows/release.yml`
3. Publishes to the public npm registry as `@get2knowio/n8n-mcp`
4. Runs a post-publish smoke test (installs from npm, verifies ESM import and CLI)
5. Requires passing CI tests and successful build

Release notes formatting rules:
- Write plain Markdown in the GitHub Release body (do NOT include escaped `\n` sequences)
- Use short sections and bullet lists; avoid long single-line paragraphs
- Example title: `v0.1.2`
- Example body:
	- Publish to npm
	- Post-publish verify (install, ESM import, CLI)
	- CI: Coveralls coverage upload (parallel + finalize)

## Troubleshooting

### Common Issues
- **TypeScript errors**: Run `npm run lint` to see detailed type checking
- **Test failures**: Check `src/__tests__/setup.ts` for mock configuration
- **Build failures**: Verify Node.js version compatibility (18.x, 20.x, 22.x)
- **CLI not working**: Ensure built with `npm run build` first

### Performance Notes
- Build time: ~2 seconds (very fast)
- Test execution: ~6 seconds (29 tests)
- npm install: ~11 seconds (332 packages)
- Development watch mode: instant rebuilds on file changes

**REMEMBER**: Always validate your changes with the full CI sequence before committing. This codebase has excellent test coverage and fast build times - use them to your advantage.