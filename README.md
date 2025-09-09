# n8n-mcp

An MCP (Model Context Protocol) server for managing n8n workflows. This server allows AI agents to create, retrieve, update, and manage n8n workflows through the n8n API.

## Features

- **List Workflows**: Get all workflows from your n8n instance
- **Get Workflow**: Retrieve a specific workflow by ID
- **Create Workflow**: Create new workflows with nodes and connections
- **Update Workflow**: Modify existing workflows
- **Delete Workflow**: Remove workflows
- **Activate/Deactivate**: Control workflow execution state

## Installation

```bash
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

### Available Tools

1. **list_workflows** - List all workflows
2. **get_workflow** - Get workflow by ID
3. **create_workflow** - Create a new workflow
4. **update_workflow** - Update existing workflow
5. **delete_workflow** - Delete a workflow
6. **activate_workflow** - Activate a workflow
7. **deactivate_workflow** - Deactivate a workflow

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

## Development

```bash
npm run dev  # Watch mode for development
npm run build  # Build TypeScript
```

## License

MIT
