#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { N8nClient } from './n8n-client.js';
import { logger, newCorrelationId, getLogLevel } from './logger.js';
import { 
  N8nConfig, 
  N8nWorkflow,
  N8nExecutionResponse,
  TransferRequest,
  CreateNodeRequest,
  UpdateNodeRequest,
  ConnectNodesRequest,
  DeleteNodeRequest,
  SetNodePositionRequest,
  ApplyOpsRequest,
  ValidationResult
} from './types.js';
import { success as jsonSuccess, error as jsonError } from './output.js';

export class N8nMcpServer {
  private server: Server;
  private n8nClient!: N8nClient;

  constructor() {
    this.server = new Server({
      name: 'n8n-mcp',
      version: '1.0.0',
    }, {
      capabilities: {
        tools: {},
      },
    });

    this.setupConfig();
    this.setupToolHandlers();
  }

  private setupConfig() {
    const config: N8nConfig = {
      baseUrl: process.env.N8N_BASE_URL || 'http://localhost:5678',
      apiKey: process.env.N8N_API_KEY,
      username: process.env.N8N_USERNAME,
      password: process.env.N8N_PASSWORD,
    };

    if (!config.apiKey && (!config.username || !config.password)) {
      logger.warn('No authentication configured. Set N8N_API_KEY or N8N_USERNAME/N8N_PASSWORD environment variables.');
    }

    if (!config.baseUrl) {
      throw new Error('N8N_BASE_URL must be configured');
    }

    this.n8nClient = new N8nClient(config);
    logger.info('N8n MCP server configured', { baseUrl: config.baseUrl });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          { name: 'list_workflows', description: 'List all n8n workflows', inputSchema: { type: 'object', properties: { limit: { type: 'number' }, cursor: { type: 'string' } } } },
          { name: 'get_workflow', description: 'Get a specific n8n workflow by ID', inputSchema: { type: 'object', properties: { id: { oneOf: [{ type: 'string' }, { type: 'number' }], description: 'The workflow ID' } }, required: ['id'] } },
          { name: 'create_workflow', description: 'Create a new n8n workflow', inputSchema: { type: 'object', properties: { name: { type: 'string' }, nodes: { type: 'array', items: { type: 'object' } }, connections: { type: 'object' }, active: { type: 'boolean', default: false }, tags: { type: 'array', items: { type: 'string' } } }, required: ['name', 'nodes', 'connections'] } },
          { name: 'update_workflow', description: 'Update an existing n8n workflow', inputSchema: { type: 'object', properties: { id: { oneOf: [{ type: 'string' }, { type: 'number' }] }, name: { type: 'string' }, nodes: { type: 'array', items: { type: 'object' } }, connections: { type: 'object' }, active: { type: 'boolean' }, tags: { type: 'array', items: { type: 'string' } }, ifMatch: { type: 'string', description: 'Optional If-Match header value for optimistic concurrency control' } }, required: ['id'] } },
          { name: 'delete_workflow', description: 'Delete an n8n workflow', inputSchema: { type: 'object', properties: { id: { oneOf: [{ type: 'string' }, { type: 'number' }] } }, required: ['id'] } },
          { name: 'activate_workflow', description: 'Activate an n8n workflow', inputSchema: { type: 'object', properties: { id: { oneOf: [{ type: 'string' }, { type: 'number' }] } }, required: ['id'] } },
          { name: 'deactivate_workflow', description: 'Deactivate an n8n workflow', inputSchema: { type: 'object', properties: { id: { oneOf: [{ type: 'string' }, { type: 'number' }] } }, required: ['id'] } },
          {
            name: 'apply_ops',
            description: 'Apply multiple graph operations atomically to a workflow',
            inputSchema: {
              type: 'object',
              properties: {
                workflowId: { oneOf: [{ type: 'string' }, { type: 'number' }], description: 'The workflow ID' },
                ops: {
                  type: 'array',
                  description: 'Array of operations to apply',
                  items: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['addNode', 'deleteNode', 'updateNode', 'setParam', 'unsetParam', 'connect', 'disconnect', 'setWorkflowProperty', 'addTag', 'removeTag'],
                        description: 'The type of operation'
                      }
                    },
                    required: ['type']
                  }
                }
              },
              required: ['workflowId', 'ops'],
            },
          },
          {
            name: 'list_node_types',
            description: 'List all available n8n node types',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_node_type',
            description: 'Get details about a specific n8n node type',
            inputSchema: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  description: 'The node type name (e.g., n8n-nodes-base.httpRequest)',
                },
              },
              required: ['type'],
            },
          },
          {
            name: 'examples',
            description: 'Get examples for a specific n8n node type',
            inputSchema: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  description: 'The node type name (e.g., n8n-nodes-base.webhook)',
                },
              },
              required: ['type'],
            },
          },
          {
            name: 'validate_node_config',
            description: 'Validate a node configuration against its type definition',
            inputSchema: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  description: 'The node type name',
                },
                params: {
                  type: 'object',
                  description: 'The node parameters to validate',
                },
                credentials: {
                  type: 'object',
                  description: 'Optional credentials object',
                },
              },
              required: ['type', 'params'],
            },
          },
          {
            name: 'list_credentials',
            description: 'List all n8n credentials',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'resolve_credential_alias',
            description: 'Resolve a credential alias to its ID',
            inputSchema: {
              type: 'object',
              properties: {
                alias: {
                  type: 'string',
                  description: 'The credential alias/name to resolve',
                },
              },
              required: ['alias'],
            },
          },
          { name: 'get_credential_schema', description: 'Get JSON schema for a credential type', inputSchema: { type: 'object', properties: { credentialTypeName: { type: 'string', description: 'The name of the credential type' } }, required: ['credentialTypeName'] } },

          { name: 'list_variables', description: 'List all variables with pagination support', inputSchema: { type: 'object', properties: { limit: { type: 'number' }, cursor: { type: 'string' } } } },
          { name: 'create_variable', description: 'Create a new variable (requires unique key)', inputSchema: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] } },
          { name: 'update_variable', description: 'Update an existing variable value', inputSchema: { type: 'object', properties: { id: { type: 'string' }, value: { type: 'string' } }, required: ['id', 'value'] } },
          { name: 'delete_variable', description: 'Delete a variable by ID', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },

          { name: 'list_workflow_tags', description: 'List tags for a specific n8n workflow', inputSchema: { type: 'object', properties: { workflowId: { oneOf: [{ type: 'string' }, { type: 'number' }] } }, required: ['workflowId'] } },
          { name: 'set_workflow_tags', description: 'Set tags for a specific n8n workflow', inputSchema: { type: 'object', properties: { workflowId: { oneOf: [{ type: 'string' }, { type: 'number' }] }, tagIds: { type: 'array', items: { oneOf: [{ type: 'string' }, { type: 'number' }] } } }, required: ['workflowId', 'tagIds'] } },

          { name: 'transfer_workflow', description: 'Transfer an n8n workflow to a different project or owner', inputSchema: { type: 'object', properties: { id: { oneOf: [{ type: 'string' }, { type: 'number' }] }, projectId: { type: 'string' }, newOwnerId: { type: 'string' } }, required: ['id'] } },
          { name: 'transfer_credential', description: 'Transfer an n8n credential to a different project or owner', inputSchema: { type: 'object', properties: { id: { oneOf: [{ type: 'string' }, { type: 'number' }] }, projectId: { type: 'string' }, newOwnerId: { type: 'string' } }, required: ['id'] } },

          { name: 'list_executions', description: 'List n8n workflow executions', inputSchema: { type: 'object', properties: { limit: { type: 'number' }, cursor: { type: 'string' }, workflowId: { type: 'string' } } } },
          { name: 'get_execution', description: 'Get a specific n8n execution by ID', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
          { name: 'delete_execution', description: 'Delete an n8n execution', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },

          { name: 'webhook_urls', description: 'Get webhook URLs for a webhook node in a workflow', inputSchema: { type: 'object', properties: { workflowId: { oneOf: [{ type: 'string' }, { type: 'number' }] }, nodeId: { type: 'string' } }, required: ['workflowId', 'nodeId'] } },
          { name: 'run_once', description: 'Execute a workflow manually once and return execution details', inputSchema: { type: 'object', properties: { workflowId: { oneOf: [{ type: 'string' }, { type: 'number' }] }, input: { type: 'object' } }, required: ['workflowId'] } },

          { name: 'list_tags', description: 'List all tags with optional pagination', inputSchema: { type: 'object', properties: { limit: { type: 'number' }, cursor: { type: 'string' } } } },
          { name: 'get_tag', description: 'Get a specific tag by ID', inputSchema: { type: 'object', properties: { id: { oneOf: [{ type: 'string' }, { type: 'number' }] } }, required: ['id'] } },
          { name: 'create_tag', description: 'Create a new tag', inputSchema: { type: 'object', properties: { name: { type: 'string' }, color: { type: 'string' } }, required: ['name'] } },
          { name: 'update_tag', description: 'Update an existing tag', inputSchema: { type: 'object', properties: { id: { oneOf: [{ type: 'string' }, { type: 'number' }] }, name: { type: 'string' }, color: { type: 'string' } }, required: ['id'] } },
          { name: 'delete_tag', description: 'Delete a tag by ID', inputSchema: { type: 'object', properties: { id: { oneOf: [{ type: 'string' }, { type: 'number' }] } }, required: ['id'] } },

          { name: 'source_control_pull', description: 'Pull changes from source control to sync with remote', inputSchema: { type: 'object', properties: {} } },

          // Graph mutation tools
          { name: 'create_node', description: 'Create a new node in an existing n8n workflow', inputSchema: { type: 'object', properties: { workflowId: { oneOf: [{ type: 'string' }, { type: 'number' }], description: 'The workflow ID' }, type: { type: 'string', description: 'The node type (e.g., n8n-nodes-base.webhook)' }, name: { type: 'string', description: 'Optional name for the node' }, params: { type: 'object', description: 'Optional node parameters' }, position: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2, description: 'Optional [x, y] position' }, credentials: { type: 'object', description: 'Optional credentials configuration' } }, required: ['workflowId', 'type'] } },
          { name: 'update_node', description: 'Update an existing node in an n8n workflow', inputSchema: { type: 'object', properties: { workflowId: { oneOf: [{ type: 'string' }, { type: 'number' }] }, nodeId: { type: 'string' }, params: { type: 'object' }, credentials: { type: 'object' }, name: { type: 'string' }, typeVersion: { type: 'number' } }, required: ['workflowId', 'nodeId'] } },
          { name: 'connect_nodes', description: 'Connect two nodes in an n8n workflow', inputSchema: { type: 'object', properties: { workflowId: { oneOf: [{ type: 'string' }, { type: 'number' }] }, from: { type: 'object', properties: { nodeId: { type: 'string' }, outputIndex: { type: 'number' } }, required: ['nodeId'] }, to: { type: 'object', properties: { nodeId: { type: 'string' }, inputIndex: { type: 'number' } }, required: ['nodeId'] } }, required: ['workflowId', 'from', 'to'] } },
          { name: 'delete_node', description: 'Delete a node from an n8n workflow', inputSchema: { type: 'object', properties: { workflowId: { oneOf: [{ type: 'string' }, { type: 'number' }] }, nodeId: { type: 'string' } }, required: ['workflowId', 'nodeId'] } },
          { name: 'set_node_position', description: 'Set the position of a node in an n8n workflow', inputSchema: { type: 'object', properties: { workflowId: { oneOf: [{ type: 'string' }, { type: 'number' }] }, nodeId: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' } }, required: ['workflowId', 'nodeId', 'x', 'y'] } },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const correlationId = newCorrelationId();
      try {
        logger.info('Executing tool', { tool: request.params.name, correlationId });

        switch (request.params.name) {
          case 'list_workflows':
            return await this.handleListWorkflows(request.params.arguments as { limit?: number; cursor?: string });
          case 'get_workflow':
            return await this.handleGetWorkflow(request.params.arguments as { id: string | number });
          case 'create_workflow':
            return await this.handleCreateWorkflow(request.params.arguments as Omit<N8nWorkflow, 'id'>);
          case 'update_workflow':
            return await this.handleUpdateWorkflow(request.params.arguments as { id: string | number; ifMatch?: string } & Partial<N8nWorkflow>);
          case 'delete_workflow':
            return await this.handleDeleteWorkflow(request.params.arguments as { id: string | number });
          case 'activate_workflow':
            return await this.handleActivateWorkflow(request.params.arguments as { id: string | number });
          case 'deactivate_workflow':
            return await this.handleDeactivateWorkflow(request.params.arguments as { id: string | number });

          case 'list_credentials':
            return await this.handleListCredentials();

          case 'resolve_credential_alias':
            return await this.handleResolveCredentialAlias(request.params.arguments as { alias: string });

          case 'apply_ops':
            return await this.handleApplyOps(request.params.arguments as unknown as ApplyOpsRequest);

          case 'list_node_types':
            return await this.handleListNodeTypes();

          case 'get_node_type':
            return await this.handleGetNodeType(request.params.arguments as { type: string });

          case 'examples':
            return await this.handleGetExamples(request.params.arguments as { type: string });

          case 'validate_node_config':
            return await this.handleValidateNodeConfig(request.params.arguments as { 
              type: string; 
              params: Record<string, any>; 
              credentials?: Record<string, string> 
            });

          case 'get_credential_schema':
            return await this.handleGetCredentialSchema(request.params.arguments as { credentialTypeName: string });

          case 'list_workflow_tags':
            return await this.handleListWorkflowTags(request.params.arguments as { workflowId: string | number });
          case 'set_workflow_tags':
            return await this.handleSetWorkflowTags(request.params.arguments as { workflowId: string | number; tagIds: (string | number)[] });

          case 'transfer_workflow':
            return await this.handleTransferWorkflow(request.params.arguments as unknown as { id: string | number } & TransferRequest);
          case 'transfer_credential':
            return await this.handleTransferCredential(request.params.arguments as unknown as { id: string | number } & TransferRequest);

          case 'list_variables':
            return await this.handleListVariables(request.params.arguments as { limit?: number; cursor?: string });
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
            return await this.handleWebhookUrls(request.params.arguments as { workflowId: string | number; nodeId: string });
          case 'run_once':
            return await this.handleRunOnce(request.params.arguments as { workflowId: string | number; input?: any });

          case 'list_tags':
            return await this.handleListTags(request.params.arguments as { limit?: number; cursor?: string });
          case 'get_tag':
            return await this.handleGetTag(request.params.arguments as { id: string | number });
          case 'create_tag':
            return await this.handleCreateTag(request.params.arguments as { name: string; color?: string });
          case 'update_tag':
            return await this.handleUpdateTag(request.params.arguments as { id: string | number; name?: string; color?: string });
          case 'delete_tag':
            return await this.handleDeleteTag(request.params.arguments as { id: string | number });

          case 'source_control_pull':
            return await this.handleSourceControlPull();

          // Graph mutation handlers
          case 'create_node':
            return await this.handleCreateNode(request.params.arguments as unknown as CreateNodeRequest);
          case 'update_node':
            return await this.handleUpdateNode(request.params.arguments as unknown as UpdateNodeRequest);
          case 'connect_nodes':
            return await this.handleConnectNodes(request.params.arguments as unknown as ConnectNodesRequest);
          case 'delete_node':
            return await this.handleDeleteNode(request.params.arguments as unknown as DeleteNodeRequest);
          case 'set_node_position':
            return await this.handleSetNodePosition(request.params.arguments as unknown as SetNodePositionRequest);

          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        const isError = error instanceof Error;
        const errorMessage = isError ? error.message : 'Unknown error';
        const stack = isError ? error.stack : undefined;
        logger.error('Tool execution failed', { tool: request.params.name, correlationId, error: errorMessage, stack });
        const payload = jsonError(error, 'TOOL_ERROR');
        return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
      }
    });
  }

  private async handleListWorkflows(args?: { limit?: number; cursor?: string }) {
    const workflows = await this.n8nClient.listWorkflows(args?.limit, args?.cursor);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(workflows), null, 2) }] };
  }

  private async handleGetWorkflow(args: { id: string | number }) {
    const workflow = await this.n8nClient.getWorkflow(args.id);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(workflow), null, 2) }] };
  }

  private async handleCreateWorkflow(args: Omit<N8nWorkflow, 'id'>) {
    const workflow = await this.n8nClient.createWorkflow(args);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(workflow), null, 2) }] };
  }

  private async handleUpdateWorkflow(args: { id: string | number; ifMatch?: string } & Partial<N8nWorkflow>) {
    const { id, ifMatch, ...updateData } = args;
    const workflow = await this.n8nClient.updateWorkflow(id, updateData, ifMatch);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(workflow), null, 2) }] };
  }

  private async handleDeleteWorkflow(args: { id: string | number }) {
    await this.n8nClient.deleteWorkflow(args.id);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess({ id: args.id }), null, 2) }] };
  }

  private async handleActivateWorkflow(args: { id: string | number }) {
    const workflow = await this.n8nClient.activateWorkflow(args.id);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(workflow), null, 2) }] };
  }

  private async handleDeactivateWorkflow(args: { id: string | number }) {
    const workflow = await this.n8nClient.deactivateWorkflow(args.id);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(workflow), null, 2) }] };
  }

  private async handleGetCredentialSchema(args: { credentialTypeName: string }) {
    const schema = await this.n8nClient.getCredentialSchema(args.credentialTypeName);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(schema), null, 2) }] };
  }

  private async handleListWorkflowTags(args: { workflowId: string | number }) {
    const tags = await this.n8nClient.listWorkflowTags(args.workflowId);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(tags), null, 2) }] };
  }

  private async handleSetWorkflowTags(args: { workflowId: string | number; tagIds: (string | number)[] }) {
    const tags = await this.n8nClient.setWorkflowTags(args.workflowId, args.tagIds);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(tags), null, 2) }] };
  }

  private async handleTransferWorkflow(args: { id: string | number } & TransferRequest) {
    const { id, ...transferData } = args;
    const result = await this.n8nClient.transferWorkflow(id, transferData);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(result), null, 2) }] };
  }

  private async handleTransferCredential(args: { id: string | number } & TransferRequest) {
    const { id, ...transferData } = args;
    const result = await this.n8nClient.transferCredential(id, transferData);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(result), null, 2) }] };
  }

  private async handleListVariables(args?: { limit?: number; cursor?: string }) {
    const response = await this.n8nClient.listVariables(args?.limit, args?.cursor);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(response), null, 2) }] };
  }

  private async handleCreateVariable(args: { key: string; value: string }) {
    const variable = await this.n8nClient.createVariable(args);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(variable), null, 2) }] };
  }

  private async handleUpdateVariable(args: { id: string; value: string }) {
    const variable = await this.n8nClient.updateVariable(args.id, { value: args.value });
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(variable), null, 2) }] };
  }

  private async handleDeleteVariable(args: { id: string }) {
    await this.n8nClient.deleteVariable(args.id);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess({ id: args.id }), null, 2) }] };
  }

  private async handleListExecutions(args: { limit?: number; cursor?: string; workflowId?: string }) {
    const executions = await this.n8nClient.listExecutions(args);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(executions), null, 2) }] };
  }

  private async handleGetExecution(args: { id: string }) {
    const execution = await this.n8nClient.getExecution(args.id);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(execution), null, 2) }] };
  }

  private async handleDeleteExecution(args: { id: string }) {
    await this.n8nClient.deleteExecution(args.id);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess({ id: args.id }), null, 2) }] };
  }

  private async handleWebhookUrls(args: { workflowId: string | number; nodeId: string }) {
    const urls = await this.n8nClient.getWebhookUrls(args.workflowId, args.nodeId);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(urls), null, 2) }] };
  }

  private async handleRunOnce(args: { workflowId: string | number; input?: any }) {
    const execution = await this.n8nClient.runOnce(args.workflowId, args.input);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(execution), null, 2) }] };
  }

  private async handleListTags(args: { limit?: number; cursor?: string }) {
    const tags = await this.n8nClient.listTags(args.limit, args.cursor);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(tags), null, 2) }] };
  }

  private async handleGetTag(args: { id: string | number }) {
    const tag = await this.n8nClient.getTag(args.id);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(tag), null, 2) }] };
  }

  private async handleCreateTag(args: { name: string; color?: string }) {
    const tag = await this.n8nClient.createTag(args);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(tag), null, 2) }] };
  }

  private async handleUpdateTag(args: { id: string | number; name?: string; color?: string }) {
    const { id, ...updateData } = args;
    const tag = await this.n8nClient.updateTag(id, updateData);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(tag), null, 2) }] };
  }

  private async handleDeleteTag(args: { id: string | number }) {
    await this.n8nClient.deleteTag(args.id);
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess({ id: args.id }), null, 2) }] };
  }

  private async handleSourceControlPull() {
    const result = await this.n8nClient.sourceControlPull();
    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(result), null, 2) }] };
  }

  private async handleCreateNode(args: CreateNodeRequest) {
    const result = await this.n8nClient.createNode(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(jsonSuccess(result), null, 2),
        },
      ],
    };
  }

  private async handleUpdateNode(args: UpdateNodeRequest) {
    const result = await this.n8nClient.updateNode(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(jsonSuccess(result), null, 2),
        },
      ],
    };
  }

  private async handleListCredentials() {
    const credentials = await this.n8nClient.listCredentials();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(jsonSuccess(credentials), null, 2),
        },
      ],
    };
  }

  private async handleResolveCredentialAlias(args: { alias: string }) {
    const credentialId = await this.n8nClient.resolveCredentialAlias(args.alias);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(jsonSuccess({ alias: args.alias, id: credentialId }), null, 2),
        },
      ],
    };
  }

  private async handleConnectNodes(args: ConnectNodesRequest) {
    const result = await this.n8nClient.connectNodes(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(jsonSuccess(result), null, 2),
        },
      ],
    };
  }

  private async handleDeleteNode(args: DeleteNodeRequest) {
    const result = await this.n8nClient.deleteNode(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(jsonSuccess(result), null, 2),
        },
      ],
    };
  }

  private async handleSetNodePosition(args: SetNodePositionRequest) {
    const result = await this.n8nClient.setNodePosition(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(jsonSuccess(result), null, 2),
        },
      ],
    };
  }

  private async handleApplyOps(args: ApplyOpsRequest) {
    const result = await this.n8nClient.applyOperations(args.workflowId, args.ops);
    
    if (result.success) {
      return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(result.workflow), null, 2) }] };
    } else {
      return { content: [{ type: 'text', text: JSON.stringify(jsonError('Operations failed', 'APPLY_OPS_FAILED', { errors: result.errors }), null, 2) }] };
    }
  }

  private async handleListNodeTypes() {
    const nodeTypes = await this.n8nClient.getNodeTypes();
    const summary = nodeTypes.map(nodeType => ({
      name: nodeType.name,
      displayName: nodeType.displayName,
      description: nodeType.description,
      version: nodeType.version,
      category: nodeType.category,
    }));
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(jsonSuccess(summary), null, 2),
        },
      ],
    };
  }

  private async handleGetNodeType(args: { type: string }) {
    const nodeType = await this.n8nClient.getNodeTypeByName(args.type);
    if (!nodeType) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(jsonError(`Node type '${args.type}' not found. Use list_node_types to see available types.`, 'NOT_FOUND'), null, 2),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(jsonSuccess(nodeType), null, 2),
        },
      ],
    };
  }

  private async handleGetExamples(args: { type: string }) {
    const examples = await this.n8nClient.getNodeTypeExamples(args.type);
    if (examples.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(jsonError(`No examples available for node type '${args.type}'.`, 'NOT_FOUND'), null, 2),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(jsonSuccess(examples), null, 2),
        },
      ],
    };
  }

  private async handleValidateNodeConfig(args: { 
    type: string; 
    params: Record<string, any>; 
    credentials?: Record<string, string> 
  }) {
    const result = await this.n8nClient.validateNodeConfiguration(
      args.type,
      args.params,
      args.credentials
    );

    return { content: [{ type: 'text', text: JSON.stringify(jsonSuccess(result), null, 2) }] };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('N8n MCP server running on stdio');
  }
}

const server = new N8nMcpServer();
server.run().catch((error) => {
  logger.error('Server failed', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
  process.exit(1);
});
