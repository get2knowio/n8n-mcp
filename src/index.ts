#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { N8nClient } from './n8n-client.js';
import { N8nConfig, N8nWorkflow, N8nVariable, N8nExecution, N8nWebhookUrls, N8nExecutionResponse } from './types.js';

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
            name: 'list_variables',
            description: 'List all n8n variables',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'create_variable',
            description: 'Create a new n8n variable',
            inputSchema: {
              type: 'object',
              properties: {
                key: {
                  type: 'string',
                  description: 'The variable key (must be unique)',
                },
                value: {
                  type: 'string',
                  description: 'The variable value',
                },
              },
              required: ['key', 'value'],
            },
          },
          {
            name: 'update_variable',
            description: 'Update an existing n8n variable',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'The variable ID',
                },
                value: {
                  type: 'string',
                  description: 'The new variable value',
                },
              },
              required: ['id', 'value'],
            },
          },
          {
            name: 'delete_variable',
            description: 'Delete an n8n variable',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'The variable ID',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'list_executions',
            description: 'List n8n workflow executions',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Maximum number of executions to return',
                },
                cursor: {
                  type: 'string',
                  description: 'Cursor for pagination',
                },
                workflowId: {
                  type: 'string',
                  description: 'Filter executions by workflow ID',
                },
              },
            },
          },
          {
            name: 'get_execution',
            description: 'Get a specific n8n execution by ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'The execution ID',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'delete_execution',
            description: 'Delete an n8n execution',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'The execution ID',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'webhook_urls',
            description: 'Get webhook URLs for a webhook node in a workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'number',
                  description: 'The workflow ID',
                },
                nodeId: {
                  type: 'string',
                  description: 'The webhook node ID',
                },
              },
              required: ['workflowId', 'nodeId'],
            },
          },
          {
            name: 'run_once',
            description: 'Execute a workflow manually once and return execution details',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: {
                  type: 'number',
                  description: 'The workflow ID',
                },
                input: {
                  type: 'object',
                  description: 'Optional input data for the workflow execution',
                },
              },
              required: ['workflowId'],
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

          case 'list_variables':
            return await this.handleListVariables();

          case 'create_variable':
            return await this.handleCreateVariable(request.params.arguments as { key: string; value: string });

          case 'update_variable':
            return await this.handleUpdateVariable(request.params.arguments as { id: string; value: string });

          case 'delete_variable':
            return await this.handleDeleteVariable(request.params.arguments as { id: string });

          case 'list_executions':
            return await this.handleListExecutions(request.params.arguments as { limit?: number; cursor?: string; workflowId?: string });

          case 'get_execution':
            return await this.handleGetExecution(request.params.arguments as { id: string });

          case 'delete_execution':
            return await this.handleDeleteExecution(request.params.arguments as { id: string });

          case 'webhook_urls':
            return await this.handleWebhookUrls(request.params.arguments as { workflowId: number; nodeId: string });

          case 'run_once':
            return await this.handleRunOnce(request.params.arguments as { workflowId: number; input?: any });

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

  private async handleListVariables() {
    const response = await this.n8nClient.listVariables();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  private async handleCreateVariable(args: { key: string; value: string }) {
    const variable = await this.n8nClient.createVariable(args);
    return {
      content: [
        {
          type: 'text',
          text: `Variable created successfully:\n${JSON.stringify(variable, null, 2)}`,
        },
      ],
    };
  }

  private async handleUpdateVariable(args: { id: string; value: string }) {
    const variable = await this.n8nClient.updateVariable(args.id, { value: args.value });
    return {
      content: [
        {
          type: 'text',
          text: `Variable updated successfully:\n${JSON.stringify(variable, null, 2)}`,
        },
      ],
    };
  }

  private async handleDeleteVariable(args: { id: string }) {
    const result = await this.n8nClient.deleteVariable(args.id);
    return {
      content: [
        {
          type: 'text',
          text: `Variable ${args.id} deleted successfully`,
        },
      ],
    };
  }

  private async handleListExecutions(args: { limit?: number; cursor?: string; workflowId?: string }) {
    const executions = await this.n8nClient.listExecutions(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(executions, null, 2),
        },
      ],
    };
  }

  private async handleGetExecution(args: { id: string }) {
    const execution = await this.n8nClient.getExecution(args.id);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(execution, null, 2),
        },
      ],
    };
  }

  private async handleDeleteExecution(args: { id: string }) {
    const result = await this.n8nClient.deleteExecution(args.id);
    return {
      content: [
        {
          type: 'text',
          text: `Execution ${args.id} deleted successfully`,
        },
      ],
    };
  }

  private async handleWebhookUrls(args: { workflowId: number; nodeId: string }) {
    const urls = await this.n8nClient.getWebhookUrls(args.workflowId, args.nodeId);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(urls, null, 2),
        },
      ],
    };
  }

  private async handleRunOnce(args: { workflowId: number; input?: any }) {
    const execution = await this.n8nClient.runOnce(args.workflowId, args.input);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(execution, null, 2),
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