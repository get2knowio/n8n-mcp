# Example: Simple HTTP Request Workflow

This example creates a basic n8n workflow that makes an HTTP request and processes the response.

```json
{
  "name": "Simple HTTP Request Workflow",
  "nodes": [
    {
      "id": "start",
      "name": "Start",
      "type": "n8n-nodes-base.start",
      "typeVersion": 1,
      "position": [250, 300],
      "parameters": {}
    },
    {
      "id": "http-request",
      "name": "HTTP Request",
      "type": "n8n-nodes-base.httpRequest", 
      "typeVersion": 4,
      "position": [450, 300],
      "parameters": {
        "url": "https://jsonplaceholder.typicode.com/posts/1",
        "method": "GET"
      }
    },
    {
      "id": "set-data",
      "name": "Set Data",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3,
      "position": [650, 300],
      "parameters": {
        "values": {
          "string": [
            {
              "name": "title",
              "value": "={{$json.title}}"
            },
            {
              "name": "body",
              "value": "={{$json.body}}"
            }
          ]
        }
      }
    }
  ],
  "connections": {
    "Start": {
      "main": [
        [
          {
            "node": "HTTP Request",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "HTTP Request": {
      "main": [
        [
          {
            "node": "Set Data",
            "type": "main", 
            "index": 0
          }
        ]
      ]
    }
  },
  "active": false,
  "tags": ["example", "http", "api"]
}
```

## Usage with MCP

To create this workflow using the MCP server:

```bash
# Using the create_workflow tool
{
  "name": "create_workflow",
  "arguments": {
    "name": "Simple HTTP Request Workflow",
    "nodes": [...], // nodes array from above
    "connections": {...}, // connections object from above
    "active": false,
    "tags": ["example", "http", "api"]
  }
}
```