# Patch DSL Operation Candidates

This document outlines the initial operation candidates for the JSON-based patch DSL.

## Core Operations

### Node Operations

#### addNode
Adds a new node to the workflow.
```json
{
  "type": "addNode",
  "node": {
    "id": "unique-node-id",
    "name": "HTTP Request",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 1,
    "position": [300, 200],
    "parameters": {
      "url": "https://api.example.com/data",
      "method": "GET"
    }
  }
}
```

#### deleteNode
Removes a node from the workflow.
```json
{
  "type": "deleteNode",
  "nodeId": "node-to-delete"
}
```

#### updateNode
Updates an existing node's properties.
```json
{
  "type": "updateNode", 
  "nodeId": "existing-node-id",
  "updates": {
    "name": "Updated HTTP Request",
    "position": [400, 250]
  }
}
```

### Parameter Operations

#### setParam
Sets a parameter value on a node.
```json
{
  "type": "setParam",
  "nodeId": "target-node-id",
  "paramPath": "url",
  "value": "https://new-api.example.com"
}
```

#### unsetParam
Removes a parameter from a node.
```json
{
  "type": "unsetParam",
  "nodeId": "target-node-id", 
  "paramPath": "headers.authorization"
}
```

### Connection Operations

#### connect
Creates a connection between two nodes.
```json
{
  "type": "connect",
  "from": {
    "nodeId": "source-node",
    "outputIndex": 0,
    "outputType": "main"
  },
  "to": {
    "nodeId": "target-node",
    "inputIndex": 0,
    "inputType": "main"
  }
}
```

#### disconnect
Removes a connection between nodes.
```json
{
  "type": "disconnect",
  "from": {
    "nodeId": "source-node",
    "outputIndex": 0,
    "outputType": "main"
  },
  "to": {
    "nodeId": "target-node",
    "inputIndex": 0,
    "inputType": "main"
  }
}
```

### Workflow Metadata Operations

#### setWorkflowProperty
Updates workflow-level properties.
```json
{
  "type": "setWorkflowProperty",
  "property": "name",
  "value": "Updated Workflow Name"
}
```

#### addTag
Adds a tag to the workflow.
```json
{
  "type": "addTag",
  "tag": "production"
}
```

#### removeTag
Removes a tag from the workflow.
```json
{
  "type": "removeTag", 
  "tag": "development"
}
```

## Batch Operation Example

```json
{
  "workflowId": 123,
  "ops": [
    {
      "type": "addNode",
      "node": {
        "id": "webhook-node",
        "name": "Webhook",
        "type": "n8n-nodes-base.webhook", 
        "typeVersion": 1,
        "position": [100, 100],
        "parameters": {
          "path": "/webhook"
        }
      }
    },
    {
      "type": "addNode", 
      "node": {
        "id": "http-node",
        "name": "HTTP Request",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 1,
        "position": [300, 100],
        "parameters": {
          "url": "https://api.example.com",
          "method": "POST"
        }
      }
    },
    {
      "type": "connect",
      "from": {
        "nodeId": "webhook-node",
        "outputIndex": 0,
        "outputType": "main"
      },
      "to": {
        "nodeId": "http-node", 
        "inputIndex": 0,
        "inputType": "main"
      }
    }
  ]
}
```

## Error Handling

All operations should include context for error reporting:
- Operation index in the batch
- Operation type
- Target node/connection information
- Specific error details

Operations are applied atomically - if any operation fails, the entire batch is rolled back and no changes are persisted.