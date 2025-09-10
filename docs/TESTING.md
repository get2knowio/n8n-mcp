# Testing the apply_ops Tool

This document demonstrates how to test the `apply_ops` tool manually.

## Example Operations

### 1. Basic Batch Operation

```json
{
  "workflowId": 1,
  "ops": [
    {
      "type": "addNode",
      "node": {
        "id": "webhook-trigger",
        "name": "Webhook Trigger",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 1,
        "position": [100, 100],
        "parameters": {
          "httpMethod": "POST",
          "path": "webhook-test"
        }
      }
    },
    {
      "type": "addNode",
      "node": {
        "id": "http-request",
        "name": "HTTP Request",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 1,
        "position": [300, 100],
        "parameters": {
          "url": "https://api.example.com/process",
          "method": "POST"
        }
      }
    },
    {
      "type": "connect",
      "from": {
        "nodeName": "Webhook Trigger",
        "outputIndex": 0,
        "outputType": "main"
      },
      "to": {
        "nodeName": "HTTP Request",
        "inputIndex": 0,
        "inputType": "main"
      }
    },
    {
      "type": "setWorkflowProperty",
      "property": "name",
      "value": "Batch Updated Workflow"
    },
    {
      "type": "addTag",
      "tag": "batch-created"
    }
  ]
}
```

### 2. Parameter Updates

```json
{
  "workflowId": 1,
  "ops": [
    {
      "type": "setParam",
      "nodeId": "webhook-trigger",
      "paramPath": "httpMethod",
      "value": "GET"
    },
    {
      "type": "setParam",
      "nodeId": "http-request",
      "paramPath": "headers.authorization",
      "value": "Bearer token123"
    }
  ]
}
```

### 3. Error Testing (should fail atomically)

```json
{
  "workflowId": 1,
  "ops": [
    {
      "type": "setWorkflowProperty",
      "property": "active",
      "value": true
    },
    {
      "type": "addNode",
      "node": {
        "id": "webhook-trigger",
        "name": "Duplicate Node",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 1,
        "position": [200, 200]
      }
    },
    {
      "type": "addTag",
      "tag": "should-not-be-added"
    }
  ]
}
```

## Expected Behavior

1. **Success Case**: All operations in batch are applied atomically
2. **Failure Case**: If any operation fails, entire batch fails with detailed error reporting
3. **Atomicity**: Partial application never occurs - workflow remains in original state if any operation fails

## Error Response Format

```json
{
  "success": false,
  "errors": [
    {
      "operationIndex": 1,
      "operation": { "type": "addNode", "..." },
      "error": "Node with ID \"webhook-trigger\" already exists",
      "details": "..."
    }
  ]
}
```

## MCP Tool Schema

The `apply_ops` tool accepts:
- `workflowId` (number): Target workflow ID
- `ops` (array): Array of operations to apply

Supported operation types:
- `addNode`: Add a new node
- `deleteNode`: Remove a node and its connections
- `updateNode`: Update node properties
- `setParam`: Set node parameter (supports dot notation)
- `unsetParam`: Remove node parameter
- `connect`: Create connection between nodes
- `disconnect`: Remove connection between nodes
- `setWorkflowProperty`: Update workflow-level property
- `addTag`: Add workflow tag
- `removeTag`: Remove workflow tag