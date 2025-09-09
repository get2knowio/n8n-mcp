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
- **Tags CRUD**: Create, read, update, and delete tags with pagination support

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

# Tag commands
npm run cli tags list
npm run cli tags list 10
npm run cli tags get 1
npm run cli tags create "My Tag" "#ff0000"
npm run cli tags update 1 "Updated Tag" "#00ff00"
npm run cli tags delete 1
```

### Available Tools

**Workflow Tools:**
1. **list_workflows** - List all workflows
2. **get_workflow** - Get workflow by ID
3. **create_workflow** - Create a new workflow
4. **update_workflow** - Update existing workflow
5. **delete_workflow** - Delete a workflow
6. **activate_workflow** - Activate a workflow
7. **deactivate_workflow** - Deactivate a workflow

**Tag Tools:**
8. **list_tags** - List all tags with optional pagination
9. **get_tag** - Get tag by ID
10. **create_tag** - Create a new tag
11. **update_tag** - Update existing tag
12. **delete_tag** - Delete a tag

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
