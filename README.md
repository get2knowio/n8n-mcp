# n8n-mcp

[![CI/CD](https://github.com/get2knowio/n8n-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/get2knowio/n8n-mcp/actions/workflows/ci.yml)
[![Release](https://github.com/get2knowio/n8n-mcp/actions/workflows/release.yml/badge.svg)](https://github.com/get2knowio/n8n-mcp/actions/workflows/release.yml)
[![Coverage Status](https://coveralls.io/repos/github/get2knowio/n8n-mcp/badge.svg?branch=main)](https://coveralls.io/github/get2knowio/n8n-mcp?branch=main)
[![npm version](https://img.shields.io/npm/v/@get2knowio/n8n-mcp.svg)](https://www.npmjs.com/package/@get2knowio/n8n-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An MCP (Model Context Protocol) server for managing n8n workflows. This server allows AI agents to create, retrieve, update, and manage n8n workflows through the n8n API.

## Features

### Workflow Management
- **List Workflows**: Get all workflows from your n8n instance
- **Get Workflow**: Retrieve a specific workflow by ID
- **Create Workflow**: Create new workflows with nodes and connections
- **Update Workflow**: Modify existing workflows
- **Delete Workflow**: Remove workflows
- **Activate/Deactivate**: Control workflow execution state
- **Credential Management**: List credentials and resolve credential aliases
- **Credential Aliasing**: Use human-friendly names for credentials in workflows
- **Source Control**: Pull changes from source control to sync with remote
- **Get Credential Schema**: Fetch JSON schema for credential types to validate or drive UIs
- **Transfer Workflows**: Move workflows across projects or owners
- **Transfer Credentials**: Move credentials across projects or owners
- **List Executions**: Get workflow executions with pagination support
- **Get Execution**: Retrieve specific execution details by ID
- **Delete Execution**: Remove execution records

### Tags Management
- **Tags CRUD**: Create, read, update, and delete tags with pagination support
- **List Tags**: Get all tags with optional pagination
- **Create Tag**: Create new tags with name and optional color
- **Update Tag**: Update existing tag name and/or color
- **Delete Tag**: Remove tags by ID

### Variables Management
- **List Variables**: Get all variables with pagination support
- **Create Variable**: Create new key-value variables (enforces unique keys)
- **Update Variable**: Modify existing variable values
- **Delete Variable**: Remove variables
- **CLI & MCP Support**: Full access via both command line and MCP tools

### n8n Endpoint Compatibility & Fallback

This MCP server supports multiple n8n API versions and automatically falls back between endpoints for maximum compatibility:

#### ID Support
- **UUID Support**: All tools accept both numeric IDs (e.g., `1`, `2`) and string UUIDs (e.g., `"tag-uuid-123"`, `"workflow-abc-def"`)
- Works with n8n Cloud (UUID-based) and self-hosted instances (numeric or UUID-based)

#### Tag Operations Fallback Strategy
**Listing Tags:**
1. Primary: `GET /api/v1/tags`
2. Fallback: `GET /rest/tags` (when v1 returns 404/401)

**Updating Tag Color:**
1. Try: `PATCH /rest/tags/{id}` with `{ color: "#ff0000" }`
2. Fallback: `PUT /api/v1/tags/{id}` with `{ name, color }`
3. If both fail: Returns helpful error message explaining color may need to be set via UI

**Setting Workflow Tags:**
1. Try: `PATCH /rest/workflows/{id}` with `{ tags: ["tag1", "tag2"] }` (tag names)
2. Try: `PATCH /rest/workflows/{id}` with `{ tags: [{ id: "uuid1" }, { id: "uuid2" }] }` (tag IDs as objects)
3. Fallback: `PUT /api/v1/workflows/{id}/tags` with `{ tagIds: ["uuid1", "uuid2"] }`
4. If all fail: Returns detailed error with attempted endpoints and status codes

This multi-endpoint approach ensures the MCP server works across:
- n8n Cloud (typically `/api/v1` endpoints)
- Self-hosted n8n v1.x+ (typically `/api/v1` endpoints)
- Older self-hosted versions (typically `/rest` endpoints)

#### Error Messages
When operations fail due to endpoint limitations, error responses include:
- List of attempted endpoints with HTTP methods and status codes
- Helpful hints (e.g., "Tag color may need to be set via the n8n web UI")
- Suggestions for alternative approaches

## Installation

### From npm (recommended)
```bash
npm install @get2knowio/n8n-mcp
```

### From Source
```bash
git clone https://github.com/get2knowio/n8n-mcp.git
cd n8n-mcp
npm install
// See CONTRIBUTING.md for the full local dev workflow and build steps
```

### Devcontainer (Docker Compose)

This repo includes a VS Code devcontainer powered by Docker Compose that launches:
- `dev`: your development container (this repo mounted at `/workspaces/n8n-mcp`)
- `n8n`: a local n8n instance on the same Docker network, reachable via `http://n8n:5678`

Open the folder in VS Code and “Reopen in Container”. The dev container sets these env vars so the CLI and smoke tests talk to the sidecar by default:
- `N8N_BASE_URL=http://n8n:5678`
- `N8N_USERNAME=test`, `N8N_PASSWORD=test`

You can still override these with a local `.env` if needed.

## Configuration

Set the following environment variables:

### Option 1: API Key Authentication
```bash
export N8N_BASE_URL=http://localhost:5678
export N8N_API_KEY=your_api_key_here
```

### Option 2: Basic Authentication
```bash
export N8N_BASE_URL=http://localhost:5678
export N8N_USERNAME=your_username
export N8N_PASSWORD=your_password
```

## Usage

### 1) As an MCP Server (recommended)

Run the MCP server (recommended) — unified entrypoint:

```bash
# Global install
npm i -g @get2knowio/n8n-mcp

# Start server on stdio
n8n-mcp

# Or without global install
npx @get2knowio/n8n-mcp
```

This starts the MCP server on stdio for integration with AI agents. Configure access via environment variables (see Configuration).

### 2) As a CLI Tool

The CLI binary is `n8n-mcp`. After a global install:

```bash
# Global install
npm i -g @get2knowio/n8n-mcp

# List workflows
n8n-mcp list

# With pagination
n8n-mcp list --limit 25 --cursor NEXT_CURSOR

# Get a workflow
n8n-mcp get 1

# Create from JSON
n8n-mcp create examples/example-workflow.json

# Activate / Deactivate
n8n-mcp activate 1
n8n-mcp deactivate 1

# Variables
n8n-mcp variables list
n8n-mcp variables create --key mykey --value myvalue
n8n-mcp variables update var-123 --value newvalue
n8n-mcp variables delete var-123

# Executions
n8n-mcp executions list
n8n-mcp executions get exec_123
n8n-mcp executions delete exec_123

# Tags
n8n-mcp tags list
n8n-mcp tags get 1
n8n-mcp tags create "My Tag" "#ff0000"
n8n-mcp tags update 1 "Updated Tag" "#00ff00"
n8n-mcp tags delete 1

# Webhook URLs
n8n-mcp webhook-urls 1 webhook-node-id

# Run once (optionally with input)
n8n-mcp run-once 1
n8n-mcp run-once 1 input-data.json
```

#### CLI Output Format
- All commands emit structured JSON to stdout by default.
- Success shape: `{ "ok": true, "data": <payload>, "meta"?: { ... } }`
- Error shape: `{ "ok": false, "error": { "message": string, "code"?: string, "details"?: any } }` with non-zero exit.
- Flags:
  - `--compact` prints single-line JSON (pretty is default).
  - `--verbose` enables debug logging to stderr without affecting stdout JSON.
- IDs: Workflow IDs may be strings or numbers; the CLI accepts either.

Examples:
```bash
# List (pretty JSON)
n8n-mcp list --limit 1
# => { "ok": true, "data": { "data": [ ... ], "nextCursor": "..." } }

# Get (compact JSON)
n8n-mcp --compact get i47DndfezvDVfrVx
# => {"ok":true,"data":{"id":"i47DndfezvDVfrVx", ...}}

# Errors return ok:false and exit 1
n8n-mcp get
# => { "ok": false, "error": { "message": "Workflow ID required", "code": "BAD_INPUT" } }
```

Use npx if you prefer not to install globally:

```bash
npx @get2knowio/n8n-mcp list
```

For local development (npm scripts, running from source), see [CONTRIBUTING.md](./CONTRIBUTING.md).

## MCP client configuration examples

You can point any MCP-capable client at the `n8n-mcp` command. Two ready-to-copy examples are provided in the `examples/` folder.

### Claude Desktop (macOS/Windows/Linux)
Place this in your Claude Desktop config (see Anthropic docs for the exact path):

```json
{
  "mcpServers": {
    "n8n-mcp": {
  "command": "npx",
  "args": ["-y", "-p", "@get2knowio/n8n-mcp"],
      "env": {
        "N8N_BASE_URL": "http://localhost:5678",
        "N8N_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

Example file: `examples/mcp-client-claude-desktop.json`

### Generic MCP client
```json
{
  "servers": [
    {
      "name": "n8n-mcp",
  "command": "npx",
  "args": ["-y", "-p", "@get2knowio/n8n-mcp"],
      "env": {
        "N8N_BASE_URL": "http://localhost:5678",
        "N8N_API_KEY": "your_api_key_here"
      }
    }
  ]
}
```

Example file: `examples/mcp-client-generic.json`

### VS Code MCP (Troubleshooting)

Some environments require an explicit npx invocation so the package is available on PATH at startup. If you see errors like `sh: 1: n8n-mcp: not found`, configure VS Code MCP to use the following form which installs the package on-demand and runs the server:

```jsonc
{
  "servers": {
    "n8n-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "-p",
  "@get2knowio/n8n-mcp@<version>"
      ],
      "env": {
        "N8N_BASE_URL": "${input:n8n_base_url}",
        "N8N_API_KEY": "${input:n8n_api_key}"
      }
    }
  }
}
```

Alternatively, install globally and reference the binary directly:

```bash
npm i -g @get2knowio/n8n-mcp@<version>
```

Then set `command` to `npx` with args `["-y", "-p", "@get2knowio/n8n-mcp@<version>"]` or, after global install, use `n8n-mcp`.

### Available Tools

#### Workflow Tools
1. **list_workflows** - List all workflows
2. **get_workflow** - Get workflow by ID
3. **create_workflow** - Create a new workflow
4. **update_workflow** - Update existing workflow (supports optional optimistic concurrency)
5. **delete_workflow** - Delete a workflow
6. **activate_workflow** - Activate a workflow
7. **deactivate_workflow** - Deactivate a workflow
7. **deactivate_workflow** - Deactivate a workflow
8. **list_credentials** - List all credentials
9. **resolve_credential_alias** - Resolve a credential alias to its ID
10. **source_control_pull** - Pull changes from source control
11. **get_credential_schema** - Get JSON schema for a credential type
12. **list_workflow_tags** - List tags for a specific workflow
13. **set_workflow_tags** - Set tags for a specific workflow
14. **transfer_workflow** - Transfer a workflow to a different project or owner
15. **transfer_credential** - Transfer a credential to a different project or owner
16. **list_executions** - List workflow executions with pagination
17. **get_execution** - Get execution by ID
18. **delete_execution** - Delete an execution
19. **webhook_urls** - Get webhook URLs for a webhook node
20. **run_once** - Execute a workflow manually once

#### Variables Tools
21. **list_variables** - List all variables with pagination support
22. **create_variable** - Create a new variable (requires unique key)
23. **update_variable** - Update an existing variable value
24. **delete_variable** - Delete a variable

#### Tag Tools
25. **list_tags** - List all tags with optional pagination
26. **get_tag** - Get tag by ID
27. **create_tag** - Create a new tag
28. **update_tag** - Update existing tag
29. **delete_tag** - Delete a tag

#### Optimistic Concurrency for Updates

The `update_workflow` tool supports optional optimistic concurrency control via the `ifMatch` parameter:

```json
{
  "id": 1,
  "name": "Updated Workflow Name",
  "ifMatch": "W/\"1234567890\""
}
```

When `ifMatch` is provided:
- The request includes an `If-Match` header with the provided value
- If the workflow has been modified by another user (412 Precondition Failed), you'll receive a clear error message
- This helps prevent conflicting updates in multi-user environments

## Example Workflow Creation

### Basic Workflow with Credential IDs
```json
{
  "name": "Example Workflow",
  "nodes": [
    {
      "id": "webhook",
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300],
      "parameters": {
        "httpMethod": "GET",
        "path": "example"
      }
    }
  ],
  "connections": {},
  "active": false,
  "tags": ["example"]
}
```

### Workflow with Credential Aliases
You can now use human-friendly credential names instead of IDs:

```json
{
  "name": "HTTP Request Workflow",
  "nodes": [
    {
      "id": "http-request",
      "name": "HTTP Request",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 1,
      "position": [250, 300],
      "parameters": {
        "url": "https://api.example.com/data",
        "method": "GET"
      },
      "credentials": {
        "httpBasicAuth": "my-api-credentials"
      }
    }
  ],
  "connections": {},
  "active": false,
  "tags": ["example", "api"]
}
```

The system will automatically resolve `"my-api-credentials"` to the appropriate credential ID before creating or updating the workflow.

## Credential Management

### Listing Credentials
Use the `list_credentials` tool to see all available credentials in your n8n instance:

```bash
# Through MCP tools
{
  "tool": "list_credentials",
  "arguments": {}
}
```

### Resolving Credential Aliases
Use the `resolve_credential_alias` tool to resolve a credential name to its ID:

```bash
# Through MCP tools
{
  "tool": "resolve_credential_alias", 
  "arguments": {
    "alias": "my-api-credentials"
  }
}
```

### Alias Resolution Rules
- **Unique Match**: If exactly one credential matches the alias, it returns the credential ID
- **No Match**: Throws an error if no credentials match the alias
- **Multiple Matches**: Throws an error if multiple credentials have the same name
- **Numeric Values**: Credential values that are all digits are treated as IDs and left unchanged

## Transfer Operations (Enterprise)

The transfer tools allow moving workflows and credentials across projects and owners in enterprise n8n setups:

### Transfer Workflow
```javascript
// Transfer to a different project
{
  "id": 1,
  "projectId": "project-123"
}

// Transfer to a different owner
{
  "id": 1,
  "newOwnerId": "user-456"
}

// Transfer to both different project and owner
{
  "id": 1,
  "projectId": "project-123",
  "newOwnerId": "user-456"
}
```

### Transfer Credential
```javascript
// Same structure as workflow transfer
{
  "id": 2,
  "projectId": "project-789",
  "newOwnerId": "user-123"
}
```

**Note**: Transfer operations require:
- Enterprise n8n installation with project/ownership features enabled
- Appropriate permissions for the user performing the transfer
- Valid target project IDs and user IDs

Permission errors will be returned with clear error messages if the operation is not allowed.

## Tag Management

Tags are used to organize and group workflows in n8n. The MCP server provides comprehensive tag management capabilities:

### Tag Operations

- **List Tags**: Get all tags with optional pagination
- **Get Tag**: Retrieve a specific tag by ID
- **Create Tag**: Create a new tag with name and optional color
- **Update Tag**: Modify tag name and/or color
- **Delete Tag**: Remove a tag

### Tag Examples

```json
{
  "id": 1,
  "name": "Production",
  "color": "#ff0000",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

The tag API supports:
- **Pagination**: Use `limit` and `cursor` parameters when listing tags
- **Color Support**: Optional hex color codes for visual organization
- **Error Handling**: Proper 409 responses for duplicate names, 404 for missing tags

## Example Variable Management

Variables in n8n are simple key-value pairs that can be used for configuration and state management:

```json
{
  "id": "var-123",
  "key": "api_endpoint",
  "value": "https://api.example.com/v1"
}
```

### CLI Usage Examples

```bash
# Create a variable
n8n-mcp variables create --key environment --value production

# List all variables
n8n-mcp variables list

# Update a variable value
n8n-mcp variables update var-123 --value "https://api.newdomain.com/v2"

# Delete a variable
n8n-mcp variables delete var-123
```

### MCP Tool Usage

Variables can be managed through MCP tools for integration with AI agents:

- `list_variables()` - Returns paginated list of all variables
- `create_variable({ key: "config_mode", value: "advanced" })` - Creates new variable
- `update_variable({ id: "var-123", value: "new_value" })` - Updates existing variable
- `delete_variable({ id: "var-123" })` - Removes variable

## Execution Management

The server provides comprehensive execution management capabilities:

### Listing Executions

```bash
# List recent executions
n8n-mcp executions list

# List with pagination
n8n-mcp executions list --limit 20 --cursor next_page_cursor

# Filter by workflow
n8n-mcp executions list --workflow-id 1
```

The `list_executions` tool supports:
- **limit**: Maximum number of executions to return (pagination)
- **cursor**: Pagination cursor for getting next/previous pages
- **workflowId**: Filter executions by specific workflow ID

### Getting Execution Details

```bash
n8n-mcp executions get exec_12345
```

Returns complete execution data including:
- Execution status and timing
- Input/output data
- Error details (if failed)
- Node execution results

### Deleting Executions

```bash
n8n-mcp executions delete exec_12345
```

Permanently removes execution records to help manage storage.

### Pagination Notes

When listing executions:
- Use `limit` parameter to control page size
- Use `nextCursor` from response to get the next page
- Cursors are opaque strings - store and use them as-is
- Empty `nextCursor` indicates no more pages available

## Webhook URLs

The `webhook_urls` tool helps you get the correct webhook URLs for webhook nodes in your workflows. This is useful for:

- Getting URLs to configure external systems that need to call your webhooks
- Testing webhook endpoints during development
- Documentation and integration guides

### Prerequisites for Webhook Nodes

For the `webhook_urls` tool to work correctly, your webhook node must:

1. Be of type `n8n-nodes-base.webhook`
2. Have a `path` parameter configured
3. Be part of an existing workflow

### URL Format

The tool returns URLs in n8n's standard format:
- **Test URL**: `${baseUrl}/webhook-test/${path}` - Used for testing during workflow development
- **Production URL**: `${baseUrl}/webhook/${path}` - Used when the workflow is active

### Example Usage

```javascript
// Get webhook URLs for a node
const urls = await client.getWebhookUrls(1, 'webhook-node-id');
console.log(urls);
// Output:
// {
//   "testUrl": "http://localhost:5678/webhook-test/my-webhook",
//   "productionUrl": "http://localhost:5678/webhook/my-webhook"
// }
```

## Manual Workflow Execution

The `run_once` tool allows you to manually execute workflows, which is useful for:

- Testing workflows during development
- Triggering workflows programmatically
- Running workflows with specific input data
- Debugging workflow issues

### Workflow Types

The tool handles different workflow types gracefully:

1. **Manual Workflows**: Workflows that start with manual triggers (e.g., Start node)
2. **Trigger Workflows**: Workflows with automatic triggers (e.g., Webhook, Cron, etc.)

### Input Data

You can optionally provide input data when executing a workflow:

```javascript
// Execute without input
const execution = await client.runOnce(1);

// Execute with input data
const execution = await client.runOnce(1, { 
  name: "John Doe", 
  email: "john@example.com" 
});
```

### Response Format

The tool returns execution details:

```javascript
{
  "executionId": "uuid-execution-id",
  "status": "running" // or "completed", "failed", etc.
}
```

## Releases

This project uses automated releases. When a new release is published on GitHub:

1. The release workflow automatically triggers
2. The package is built and tested
3. If all tests pass, the package is published to the public npm registry
4. A post-publish smoke test installs the package from npm and validates both module import and CLI wiring
5. The package can then be installed using: `npm install @get2knowio/n8n-mcp`

### Required GitHub Secret

- `NPM_TOKEN`: An npm Automation token with publish rights for the `@get2knowio` scope

### Cut a Release

You can cut a release from the GitHub UI or the CLI. CLI example:

```bash
# Bump the version in package.json (patch bump shown)
git add package.json README.md .github/workflows/
git commit -m "chore(release): v0.1.1"
git tag v0.1.1
git push origin main --tags

# Create the GitHub release (requires gh CLI auth)
gh release create v0.1.1 -t "v0.1.1" -n "Automated release to npm"
```

This triggers the Release workflow which builds, tests, publishes to npm, and then runs a smoke test against the published artifact.

## Coverage Reporting

Coverage is collected with Jest and uploaded in CI via Coveralls. See [CONTRIBUTING.md](./CONTRIBUTING.md) for local coverage commands.

To create a new release:
1. Update the version in `package.json`
2. Create a new release on GitHub with a tag matching the version
3. The automated workflow will handle the rest

### Smoke Tests (real n8n)

You can validate CLI wiring against a live n8n instance using:

```bash
npm run build
npm run smoke
```

The smoke runner loads `.env` (N8N_BASE_URL + credentials) and enables source maps for readable stacks.

## License

MIT

## Debugging and traceable errors

To get structured, traceable errors with correlation IDs and source-mapped stacks while developing or troubleshooting:

- Enable debug logs by setting MCP_DEBUG=debug
- Enable source maps by setting MCP_ENABLE_SOURCE_MAPS=1 (Node 18+ also supports the `--enable-source-maps` flag)

Examples:

```bash
# Start MCP server with debug logging and write logs to a file (stderr)
MCP_DEBUG=debug MCP_ENABLE_SOURCE_MAPS=1 npm start 2>server.log

# Use CLI with verbose output
N8N_BASE_URL=http://localhost:5678 N8N_API_KEY=xxx \
  node dist/cli.js --verbose list
```

Notes:
- All logs are written to stderr in JSON to avoid interfering with MCP stdout.
- Each tool call includes a correlationId you can grep across logs.
- Axios request/response traces are included in debug mode with sensitive fields redacted.
