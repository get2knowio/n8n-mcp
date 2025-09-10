import { N8nNodeType, N8nNodeExample } from './types.js';

/**
 * Curated catalog of common n8n node types with their metadata.
 * This serves as a fallback when n8n's node registry is not available.
 */
export const NODE_CATALOG: Record<string, N8nNodeType> = {
  'n8n-nodes-base.httpRequest': {
    name: 'n8n-nodes-base.httpRequest',
    displayName: 'HTTP Request',
    description: 'Makes an HTTP request and returns the response data',
    version: [1, 2, 3, 4],
    defaults: {
      name: 'HTTP Request',
      color: '#2196F3',
    },
    inputs: ['main'],
    outputs: ['main'],
    category: 'Core Nodes',
    properties: [
      {
        displayName: 'Method',
        name: 'method',
        type: 'options',
        required: true,
        default: 'GET',
        description: 'The HTTP method to use',
        options: [
          { name: 'DELETE', value: 'DELETE' },
          { name: 'GET', value: 'GET' },
          { name: 'HEAD', value: 'HEAD' },
          { name: 'OPTIONS', value: 'OPTIONS' },
          { name: 'PATCH', value: 'PATCH' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
        ],
      },
      {
        displayName: 'URL',
        name: 'url',
        type: 'string',
        required: true,
        default: '',
        placeholder: 'https://httpbin.org/get',
        description: 'The URL to make the request to',
      },
      {
        displayName: 'Authentication',
        name: 'authentication',
        type: 'options',
        default: 'none',
        description: 'The authentication method to use',
        options: [
          { name: 'None', value: 'none' },
          { name: 'Basic Auth', value: 'basicAuth' },
          { name: 'Header Auth', value: 'headerAuth' },
          { name: 'OAuth1', value: 'oAuth1Api' },
          { name: 'OAuth2', value: 'oAuth2Api' },
        ],
      },
      {
        displayName: 'Request Headers',
        name: 'headers',
        type: 'fixedCollection',
        default: {},
        description: 'Headers to send with the request',
      },
      {
        displayName: 'Send Body',
        name: 'sendBody',
        type: 'boolean',
        default: false,
        description: 'Whether to send a body with the request',
        displayOptions: {
          show: {
            method: ['POST', 'PUT', 'PATCH'],
          },
        },
      },
      {
        displayName: 'Body Content Type',
        name: 'contentType',
        type: 'options',
        default: 'json',
        description: 'Content-Type to use to send body',
        options: [
          { name: 'JSON', value: 'json' },
          { name: 'Form-Data Multipart', value: 'multipart-form-data' },
          { name: 'Form Encoded', value: 'form-urlencoded' },
          { name: 'Raw/Custom', value: 'raw' },
        ],
        displayOptions: {
          show: {
            sendBody: [true],
          },
        },
      },
    ],
    credentials: [
      { name: 'httpBasicAuth' },
      { name: 'httpHeaderAuth' },
      { name: 'oAuth1Api' },
      { name: 'oAuth2Api' },
    ],
  },

  'n8n-nodes-base.webhook': {
    name: 'n8n-nodes-base.webhook',
    displayName: 'Webhook',
    description: 'Starts the workflow when a webhook is called',
    version: [1, 2],
    defaults: {
      name: 'Webhook',
      color: '#FF6D5A',
    },
    inputs: [],
    outputs: ['main'],
    category: 'Core Nodes',
    properties: [
      {
        displayName: 'HTTP Method',
        name: 'httpMethod',
        type: 'options',
        required: true,
        default: 'GET',
        description: 'The HTTP method to listen for',
        options: [
          { name: 'DELETE', value: 'DELETE' },
          { name: 'GET', value: 'GET' },
          { name: 'HEAD', value: 'HEAD' },
          { name: 'PATCH', value: 'PATCH' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
        ],
      },
      {
        displayName: 'Path',
        name: 'path',
        type: 'string',
        required: true,
        default: '',
        placeholder: 'webhook-path',
        description: 'The path for the webhook. All paths are case sensitive.',
      },
      {
        displayName: 'Authentication',
        name: 'authentication',
        type: 'options',
        default: 'none',
        description: 'The authentication method to use',
        options: [
          { name: 'None', value: 'none' },
          { name: 'Basic Auth', value: 'basicAuth' },
          { name: 'Header Auth', value: 'headerAuth' },
        ],
      },
      {
        displayName: 'Response Mode',
        name: 'responseMode',
        type: 'options',
        default: 'onReceived',
        description: 'When to respond to the webhook',
        options: [
          { name: 'Immediately', value: 'onReceived', description: 'As soon as this node executes' },
          { name: 'When Last Node Finishes', value: 'lastNode', description: 'Returns data of the last-executed node' },
          { name: 'Using Respond to Webhook Node', value: 'responseNode', description: 'Response defined in that node' },
        ],
      },
    ],
    credentials: [
      { name: 'httpBasicAuth' },
      { name: 'httpHeaderAuth' },
    ],
  },

  'n8n-nodes-base.set': {
    name: 'n8n-nodes-base.set',
    displayName: 'Edit Fields',
    description: 'Sets values on items and optionally remove other values',
    version: [1, 2, 3],
    defaults: {
      name: 'Edit Fields',
      color: '#0000FF',
    },
    inputs: ['main'],
    outputs: ['main'],
    category: 'Core Nodes',
    properties: [
      {
        displayName: 'Fields to Set',
        name: 'fields',
        type: 'fixedCollection',
        required: true,
        default: { values: [] },
        description: 'The fields to add to the output',
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        default: {},
        description: 'Additional options',
      },
    ],
  },

  'n8n-nodes-base.noOp': {
    name: 'n8n-nodes-base.noOp',
    displayName: 'No Operation, do nothing',
    description: 'No Operation',
    version: 1,
    defaults: {
      name: 'No Op',
      color: '#b0b0b0',
    },
    inputs: ['main'],
    outputs: ['main'],
    category: 'Core Nodes',
    properties: [],
  },
};

/**
 * Example workflows for common node types
 */
export const NODE_EXAMPLES: Record<string, N8nNodeExample[]> = {
  'n8n-nodes-base.httpRequest': [
    {
      name: 'Simple GET Request',
      description: 'Make a basic GET request to an API',
      workflow: {
        nodes: [
          {
            id: 'http-request',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 4,
            position: [250, 300],
            parameters: {
              method: 'GET',
              url: 'https://httpbin.org/get',
              authentication: 'none',
            },
          },
        ],
        connections: {},
      },
    },
    {
      name: 'POST with JSON Body',
      description: 'Make a POST request with JSON data',
      workflow: {
        nodes: [
          {
            id: 'http-request',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 4,
            position: [250, 300],
            parameters: {
              method: 'POST',
              url: 'https://httpbin.org/post',
              sendBody: true,
              contentType: 'json',
              jsonParameters: true,
              body: {
                name: 'John Doe',
                email: 'john@example.com',
              },
            },
          },
        ],
        connections: {},
      },
    },
  ],

  'n8n-nodes-base.webhook': [
    {
      name: 'Simple Webhook',
      description: 'Basic webhook that receives GET requests',
      workflow: {
        nodes: [
          {
            id: 'webhook',
            name: 'Webhook',
            type: 'n8n-nodes-base.webhook',
            typeVersion: 2,
            position: [250, 300],
            parameters: {
              httpMethod: 'GET',
              path: 'my-webhook',
              responseMode: 'onReceived',
            },
          },
        ],
        connections: {},
      },
    },
    {
      name: 'Webhook with Authentication',
      description: 'Webhook that requires basic authentication',
      workflow: {
        nodes: [
          {
            id: 'webhook',
            name: 'Webhook',
            type: 'n8n-nodes-base.webhook',
            typeVersion: 2,
            position: [250, 300],
            parameters: {
              httpMethod: 'POST',
              path: 'secure-webhook',
              authentication: 'basicAuth',
              responseMode: 'lastNode',
            },
            credentials: {
              httpBasicAuth: 'webhook-auth',
            },
          },
        ],
        connections: {},
      },
    },
  ],

  'n8n-nodes-base.set': [
    {
      name: 'Add Fields',
      description: 'Add new fields to the data',
      workflow: {
        nodes: [
          {
            id: 'set',
            name: 'Edit Fields',
            type: 'n8n-nodes-base.set',
            typeVersion: 3,
            position: [250, 300],
            parameters: {
              fields: {
                values: [
                  {
                    name: 'timestamp',
                    type: 'string',
                    value: '={{ $now }}',
                  },
                  {
                    name: 'processed',
                    type: 'boolean',
                    value: true,
                  },
                ],
              },
            },
          },
        ],
        connections: {},
      },
    },
  ],

  'n8n-nodes-base.noOp': [
    {
      name: 'Pass Through',
      description: 'Simply pass data through without modification',
      workflow: {
        nodes: [
          {
            id: 'no-op',
            name: 'No Op',
            type: 'n8n-nodes-base.noOp',
            typeVersion: 1,
            position: [250, 300],
            parameters: {},
          },
        ],
        connections: {},
      },
    },
  ],
};

/**
 * Get all available node types
 */
export function getNodeTypes(): N8nNodeType[] {
  return Object.values(NODE_CATALOG);
}

/**
 * Get a specific node type by name
 */
export function getNodeType(typeName: string): N8nNodeType | undefined {
  return NODE_CATALOG[typeName];
}

/**
 * Get examples for a specific node type
 */
export function getNodeExamples(typeName: string): N8nNodeExample[] {
  return NODE_EXAMPLES[typeName] || [];
}

/**
 * Get all available node type names
 */
export function getNodeTypeNames(): string[] {
  return Object.keys(NODE_CATALOG);
}