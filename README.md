# n8n-mcp

[![CI/CD](https://github.com/get2knowio/n8n-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/get2knowio/n8n-mcp/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/get2knowio/n8n-mcp/branch/main/graph/badge.svg)](https://codecov.io/gh/get2knowio/n8n-mcp)
[![npm version](https://badge.fury.io/js/n8n-mcp.svg)](https://badge.fury.io/js/n8n-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An MCP (Model Context Protocol) server for managing n8n workflows. This server allows AI agents to create, retrieve, update, and manage n8n workflows through the n8n API.

## Features

- **List Workflows**: Get all workflows from your n8n instance
- **Get Workflow**: Retrieve a specific workflow by ID
- **Create Workflow**: Create new workflows with nodes and connections
- **Update Workflow**: Modify existing workflows
- **Delete Workflow**: Remove workflows
- **Activate/Deactivate**: Control workflow execution state
- **List Executions**: Get workflow executions with pagination support
- **Get Execution**: Retrieve specific execution details by ID
- **Delete Execution**: Remove execution records

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

# Get a specific workflow
npm run cli get 1

# Create a workflow from JSON file
npm run cli create examples/example-workflow.json

# Delete a workflow
npm run cli delete 1

# Activate/deactivate workflows
npm run cli activate 1
npm run cli deactivate 1

# List executions
npm run cli executions list

# List executions with pagination and filtering
npm run cli executions list --limit 50 --workflow-id 1

# Get a specific execution
npm run cli executions get exec_123

# Delete an execution
npm run cli executions delete exec_123
```

### Available Tools

1. **list_workflows** - List all workflows
2. **get_workflow** - Get workflow by ID
3. **create_workflow** - Create a new workflow
4. **update_workflow** - Update existing workflow
5. **delete_workflow** - Delete a workflow
6. **activate_workflow** - Activate a workflow
7. **deactivate_workflow** - Deactivate a workflow
8. **list_executions** - List workflow executions with pagination
9. **get_execution** - Get execution by ID
10. **delete_execution** - Delete an execution

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
