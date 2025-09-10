# n8n-mcp

[![CI/CD](https://github.com/get2knowio/n8n-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/get2knowio/n8n-mcp/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/get2knowio/n8n-mcp/branch/main/graph/badge.svg)](https://codecov.io/gh/get2knowio/n8n-mcp)
[![npm version](https://badge.fury.io/js/n8n-mcp.svg)](https://badge.fury.io/js/n8n-mcp)
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

## Installation

### From GitHub Packages
```bash
npm install @get2knowio/n8n-mcp
```

### From Source
```bash
git clone https://github.com/get2knowio/n8n-mcp.git
cd n8n-mcp
npm install
npm run build
```

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

### As an MCP Server

```bash
npm start
```

The server runs on stdio and implements the MCP protocol for integration with AI agents.

### As a CLI Tool

For testing and development, you can use the CLI interface:

```bash
# List all workflows
npm run cli list

# List workflows with pagination
npm run cli list --limit 25 --cursor NEXT_CURSOR

# Get a specific workflow
npm run cli get 1

# Create a workflow from JSON file
npm run cli create examples/example-workflow.json

# Delete a workflow
npm run cli delete 1

# Activate/deactivate workflows
npm run cli activate 1
npm run cli deactivate 1

# Source control operations
npm run cli source-control pull
# Get credential schema
npm run cli get-credential-schema httpHeaderAuth

# Transfer workflows between projects/owners (Enterprise feature)
# Note: Transfer operations require appropriate permissions and enterprise n8n setup
npm run cli transfer_workflow 1 --project-id "project-123"
npm run cli transfer_credential 2 --new-owner-id "user-456"

# List workflow tags
npm run cli workflows tags 1

# Set workflow tags
npm run cli workflows set-tags 1 --tags tag1,tag2,tag3

# Variables management
npm run cli variables list
# Variables with pagination
npm run cli variables list --limit 50 --cursor NEXT_CURSOR
npm run cli variables create --key mykey --value myvalue
npm run cli variables update var-123 --value newvalue
npm run cli variables delete var-123

# List executions
npm run cli executions list

# List executions with pagination and filtering
npm run cli executions list --limit 50 --workflow-id 1

# Get a specific execution
npm run cli executions get exec_123

# Delete an execution
npm run cli executions delete exec_123

# Get webhook URLs for a webhook node
npm run cli webhook-urls 1 webhook-node-id

# Execute a workflow manually once
npm run cli run-once 1

# Execute a workflow with input data
npm run cli run-once 1 input-data.json

# Tag commands
npm run cli tags list
npm run cli tags list 10
npm run cli tags get 1
npm run cli tags create "My Tag" "#ff0000"
npm run cli tags update 1 "Updated Tag" "#00ff00"
npm run cli tags delete 1
```

### Available Tools

#### Workflow Tools
1. **list_workflows** - List all workflows
2. **get_workflow** - Get workflow by ID
3. **create_workflow** - Create a new workflow
4. **update_workflow** - Update existing workflow (supports optional optimistic concurrency)
5. **delete_workflow** - Delete a workflow
6. **activate_workflow** - Activate a workflow
7. **deactivate_workflow** - Deactivate a workflow
8. **source_control_pull** - Pull changes from source control
8. **get_credential_schema** - Get JSON schema for a credential type
9. **list_workflow_tags** - List tags for a specific workflow
10. **set_workflow_tags** - Set tags for a specific workflow
11. **transfer_workflow** - Transfer a workflow to a different project or owner
12. **transfer_credential** - Transfer a credential to a different project or owner
13. **list_executions** - List workflow executions with pagination
14. **get_execution** - Get execution by ID
15. **delete_execution** - Delete an execution
16. **webhook_urls** - Get webhook URLs for a webhook node
17. **run_once** - Execute a workflow manually once

#### Variables Tools
18. **list_variables** - List all variables with pagination support
19. **create_variable** - Create a new variable (requires unique key)
20. **update_variable** - Update an existing variable value
21. **delete_variable** - Delete a variable

#### Tag Tools
22. **list_tags** - List all tags with optional pagination
23. **get_tag** - Get tag by ID
24. **create_tag** - Create a new tag
25. **update_tag** - Update existing tag
26. **delete_tag** - Delete a tag

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
npm run cli variables create --key environment --value production

# List all variables
npm run cli variables list

# Update a variable value
npm run cli variables update var-123 --value "https://api.newdomain.com/v2"

# Delete a variable
npm run cli variables delete var-123
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
npm run cli executions list

# List with pagination
npm run cli executions list --limit 20 --cursor next_page_cursor

# Filter by workflow
npm run cli executions list --workflow-id 1
```

The `list_executions` tool supports:
- **limit**: Maximum number of executions to return (pagination)
- **cursor**: Pagination cursor for getting next/previous pages
- **workflowId**: Filter executions by specific workflow ID

### Getting Execution Details

```bash
npm run cli executions get exec_12345
```

Returns complete execution data including:
- Execution status and timing
- Input/output data
- Error details (if failed)
- Node execution results

### Deleting Executions

```bash
npm run cli executions delete exec_12345
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

## Development

### Setup
```bash
npm install
npm run build
```

### Testing
```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Lint code (TypeScript type checking)
npm run lint
```

### Scripts
```bash
npm run dev      # Watch mode for development
npm run build    # Build TypeScript
npm run test     # Run tests
npm run lint     # TypeScript type checking
```

### Contributing
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

All contributions are welcome! Please make sure to update tests as appropriate and follow the existing code style.

## Releases

This project uses automated releases. When a new release is published on GitHub:

1. The release workflow automatically triggers
2. The package is built and tested
3. If all tests pass, the package is published to GitHub Packages
4. The package can then be installed using: `npm install @get2knowio/n8n-mcp`

To create a new release:
1. Update the version in `package.json`
2. Create a new release on GitHub with a tag matching the version
3. The automated workflow will handle the rest

## License

MIT
