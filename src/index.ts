#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { N8nClient } from './n8n-client.js';
import { N8nConfig, N8nWorkflow, N8nSourceControlPullResponse } from './types.js';

export class N8nMcpServer {
  private server: Server;
  private n8nClient!: N8nClient;

  constructor() {
    this.server = new Server({
      name: 'n8n-mcp',
      version: '1.0.0',
    });

    this.setupConfig();
    this.setupToolHandlers();
  }

  private setupConfig() {
    // Get configuration from environment variables
    const config: N8nConfig = {
      baseUrl: process.env.N8N_BASE_URL || 'http://localhost:5678',
      apiKey: process.env.N8N_API_KEY,
      username: process.env.N8N_USERNAME,
      password: process.env.N8N_PASSWORD,
    };

    if (!config.apiKey && (!config.username || !config.password)) {
      console.error('Warning: No authentication configured. Set N8N_API_KEY or N8N_USERNAME/N8N_PASSWORD environment variables.');
    }

    if (!config.baseUrl) {
      throw new Error('N8N_BASE_URL must be configured');
    }

    this.n8nClient = new N8nClient(config);
    console.error(`N8n MCP server configured for: ${config.baseUrl}`);
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'list_workflows',
            description: 'List all n8n workflows',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_workflow',
            description: 'Get a specific n8n workflow by ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: 'The workflow ID',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'create_workflow',
            description: 'Create a new n8n workflow',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'The name of the workflow',
                },
                nodes: {
                  type: 'array',
                  description: 'Array of workflow nodes',
                  items: {
                    type: 'object',
                  },
                },
                connections: {
                  type: 'object',
                  description: 'Node connections configuration',
                },
                active: {
                  type: 'boolean',
                  description: 'Whether the workflow should be active',
                  default: false,
                },
                tags: {
                  type: 'array',
                  description: 'Workflow tags',
                  items: {
                    type: 'string',
                  },
                },
              },
              required: ['name', 'nodes', 'connections'],
            },
          },
          {
            name: 'update_workflow',
            description: 'Update an existing n8n workflow',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: 'The workflow ID',
                },
                name: {
                  type: 'string',
                  description: 'The name of the workflow',
                },
                nodes: {
                  type: 'array',
                  description: 'Array of workflow nodes',
                  items: {
                    type: 'object',
                  },
                },
                connections: {
                  type: 'object',
                  description: 'Node connections configuration',
                },
                active: {
                  type: 'boolean',
                  description: 'Whether the workflow should be active',
                },
                tags: {
                  type: 'array',
                  description: 'Workflow tags',
                  items: {
                    type: 'string',
                  },
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'delete_workflow',
            description: 'Delete an n8n workflow',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: 'The workflow ID',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'activate_workflow',
            description: 'Activate an n8n workflow',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: 'The workflow ID',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'deactivate_workflow',
            description: 'Deactivate an n8n workflow',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: 'The workflow ID',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'source_control_pull',
            description: 'Pull changes from source control to sync with remote',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        console.error(`Executing tool: ${request.params.name}`);
        
        switch (request.params.name) {
          case 'list_workflows':
            return await this.handleListWorkflows();

          case 'get_workflow':
            return await this.handleGetWorkflow(request.params.arguments as { id: number });

          case 'create_workflow':
            return await this.handleCreateWorkflow(request.params.arguments as Omit<N8nWorkflow, 'id'>);

          case 'update_workflow':
            return await this.handleUpdateWorkflow(request.params.arguments as { id: number } & Partial<N8nWorkflow>);

          case 'delete_workflow':
            return await this.handleDeleteWorkflow(request.params.arguments as { id: number });

          case 'activate_workflow':
            return await this.handleActivateWorkflow(request.params.arguments as { id: number });

          case 'deactivate_workflow':
            return await this.handleDeactivateWorkflow(request.params.arguments as { id: number });

          case 'source_control_pull':
            return await this.handleSourceControlPull();

          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Tool execution failed: ${errorMessage}`);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
        };
      }
    });
  }

  private async handleListWorkflows() {
    const workflows = await this.n8nClient.listWorkflows();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(workflows, null, 2),
        },
      ],
    };
  }

  private async handleGetWorkflow(args: { id: number }) {
    const workflow = await this.n8nClient.getWorkflow(args.id);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(workflow, null, 2),
        },
      ],
    };
  }

  private async handleCreateWorkflow(args: Omit<N8nWorkflow, 'id'>) {
    const workflow = await this.n8nClient.createWorkflow(args);
    return {
      content: [
        {
          type: 'text',
          text: `Workflow created successfully:\n${JSON.stringify(workflow, null, 2)}`,
        },
      ],
    };
  }

  private async handleUpdateWorkflow(args: { id: number } & Partial<N8nWorkflow>) {
    const { id, ...updateData } = args;
    const workflow = await this.n8nClient.updateWorkflow(id, updateData);
    return {
      content: [
        {
          type: 'text',
          text: `Workflow updated successfully:\n${JSON.stringify(workflow, null, 2)}`,
        },
      ],
    };
  }

  private async handleDeleteWorkflow(args: { id: number }) {
    await this.n8nClient.deleteWorkflow(args.id);
    return {
      content: [
        {
          type: 'text',
          text: `Workflow ${args.id} deleted successfully`,
        },
      ],
    };
  }

  private async handleActivateWorkflow(args: { id: number }) {
    const workflow = await this.n8nClient.activateWorkflow(args.id);
    return {
      content: [
        {
          type: 'text',
          text: `Workflow activated successfully:\n${JSON.stringify(workflow, null, 2)}`,
        },
      ],
    };
  }

  private async handleDeactivateWorkflow(args: { id: number }) {
    const workflow = await this.n8nClient.deactivateWorkflow(args.id);
    return {
      content: [
        {
          type: 'text',
          text: `Workflow deactivated successfully:\n${JSON.stringify(workflow, null, 2)}`,
        },
      ],
    };
  }

  private async handleSourceControlPull() {
    const result = await this.n8nClient.sourceControlPull();
    return {
      content: [
        {
          type: 'text',
          text: `Source control pull completed successfully:\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('N8n MCP server running on stdio');
  }
}

const server = new N8nMcpServer();
server.run().catch((error) => {
  console.error('Server failed:', error);
  process.exit(1);
});