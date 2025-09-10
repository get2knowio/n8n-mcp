import axios, { AxiosInstance } from 'axios';
import {
  N8nWorkflow,
  N8nConfig,
  N8nApiResponse,
  N8nWorkflowsListResponse,
  N8nTag,
  N8nTagsListResponse,
  N8nVariable,
  N8nVariablesListResponse,
  N8nExecution,
  N8nExecutionsListResponse,
  N8nExecutionDeleteResponse,
  N8nWebhookUrls,
  N8nExecutionResponse,
  N8nCredential,
  N8nCredentialsListResponse,
  TransferRequest,
  TransferResponse,
  N8nCredentialSchema,
  N8nSourceControlPullResponse,
  N8nNode,
  CreateNodeRequest,
  CreateNodeResponse,
  UpdateNodeRequest,
  UpdateNodeResponse,
  ConnectNodesRequest,
  ConnectNodesResponse,
  DeleteNodeRequest,
  DeleteNodeResponse,
  SetNodePositionRequest,
  SetNodePositionResponse,
  PatchOperation,
  ApplyOpsResponse,
  N8nNodeType,
  N8nNodeExample,
  ValidationResult
} from './types.js';
import { WorkflowOperationsProcessor } from './operations.js';
import { getNodeTypes, getNodeType, getNodeExamples } from './node-registry.js';
import { validateFullNodeConfig } from './node-validator.js';

export class N8nClient {
  private api: AxiosInstance;
  private baseUrl: string;
  private operationsProcessor: WorkflowOperationsProcessor;

  constructor(config: N8nConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.api = axios.create({
      baseURL: `${this.baseUrl}/api/v1`,
      headers: { 'Content-Type': 'application/json' },
    });

    this.operationsProcessor = new WorkflowOperationsProcessor();

    // Setup authentication
    if (config.apiKey) {
      this.api.defaults.headers.common['X-N8N-API-KEY'] = config.apiKey;
    } else if (config.username && config.password) {
      const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
      this.api.defaults.headers.common['Authorization'] = `Basic ${auth}`;
    }
  }

  async listWorkflows(limit?: number, cursor?: string): Promise<N8nWorkflowsListResponse> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (cursor) params.append('cursor', cursor);
    const url = params.toString() ? `/workflows?${params.toString()}` : '/workflows';
    const response = await this.api.get<N8nWorkflowsListResponse>(url);
    return response.data;
  }

  async getWorkflow(id: number): Promise<N8nWorkflow> {
    const response = await this.api.get<N8nApiResponse<N8nWorkflow>>(`/workflows/${id}`);
    return response.data.data;
  }

  async getWorkflowWithETag(id: number): Promise<{ workflow: N8nWorkflow; etag: string | null }> {
    const response = await this.api.get<N8nApiResponse<N8nWorkflow>>(`/workflows/${id}`);
    const headers: any = response.headers || {};
    const etag = headers.etag || headers.ETag || headers['etag'] || headers['ETag'] || null;
    return { workflow: response.data.data, etag };
  }

  async createWorkflow(workflow: Omit<N8nWorkflow, 'id'>): Promise<N8nWorkflow> {
    // Resolve credential aliases before creating the workflow
    await this.resolveCredentialsInWorkflow(workflow);
    
    const response = await this.api.post<N8nApiResponse<N8nWorkflow>>('/workflows', workflow);
    return response.data.data;
  }

  async updateWorkflow(id: number, workflow: Partial<N8nWorkflow>, ifMatch?: string): Promise<N8nWorkflow> {
    // Resolve credential aliases before updating the workflow
    await this.resolveCredentialsInWorkflow(workflow);
    
    const headers: Record<string, string> = {};
    if (ifMatch) headers['If-Match'] = ifMatch;
    try {
      const response = await this.api.put<N8nApiResponse<N8nWorkflow>>(`/workflows/${id}`, workflow, { headers });
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 412) {
        throw new Error(
          'Precondition failed: The workflow has been modified by another user. Please fetch the latest version and try again.',
        );
      }
      throw error;
    }
  }

  async deleteWorkflow(id: number): Promise<void> {
    await this.api.delete(`/workflows/${id}`);
  }

  async activateWorkflow(id: number): Promise<N8nWorkflow> {
    const response = await this.api.post<N8nApiResponse<N8nWorkflow>>(`/workflows/${id}/activate`);
    return response.data.data;
  }

  async deactivateWorkflow(id: number): Promise<N8nWorkflow> {
    const response = await this.api.post<N8nApiResponse<N8nWorkflow>>(`/workflows/${id}/deactivate`);
    return response.data.data;
  }

  async listCredentials(): Promise<N8nCredential[]> {
    const response = await this.api.get<N8nCredentialsListResponse>('/credentials');
    return response.data.data;
  }

  async resolveCredentialAlias(alias: string): Promise<string> {
    const credentials = await this.listCredentials();
    const matches = credentials.filter(cred => cred.name === alias);
    
    if (matches.length === 0) {
      throw new Error(`No credential found with alias: ${alias}`);
    }
    
    if (matches.length > 1) {
      throw new Error(`Multiple credentials found with alias: ${alias}. Found ${matches.length} matches.`);
    }
    
    return matches[0].id!.toString();
  }

  async resolveCredentialsInWorkflow(workflow: Omit<N8nWorkflow, 'id'> | Partial<N8nWorkflow>): Promise<void> {
    if (!workflow.nodes) return;
    
    for (const node of workflow.nodes) {
      if (node.credentials) {
        for (const [credType, credValue] of Object.entries(node.credentials)) {
          // If the value doesn't look like an ID (not all digits), try to resolve as alias
          if (credValue && !/^\d+$/.test(credValue)) {
            try {
              node.credentials[credType] = await this.resolveCredentialAlias(credValue);
            } catch (error) {
              throw new Error(`Failed to resolve credential alias '${credValue}' for node '${node.name}': ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
      }
    }
  }

  // Node type metadata methods
  
  /**
   * Get all available node types from curated catalog
   */
  async getNodeTypes(): Promise<N8nNodeType[]> {
    // Try to get from n8n API first (if available in future)
    // For now, use curated catalog
    return getNodeTypes();
  }

  /**
   * Get a specific node type by name
   */
  async getNodeTypeByName(typeName: string): Promise<N8nNodeType | null> {
    // Try to get from n8n API first (if available in future)
    // For now, use curated catalog
    const nodeType = getNodeType(typeName);
    return nodeType || null;
  }

  /**
   * Get examples for a specific node type
   */
  async getNodeTypeExamples(typeName: string): Promise<N8nNodeExample[]> {
    return getNodeExamples(typeName);
  }

  /**
   * Validate a node configuration
   */
  async validateNodeConfiguration(
    nodeType: string,
    parameters: Record<string, any>,
    credentials?: Record<string, string>
  ): Promise<ValidationResult> {
    return validateFullNodeConfig(nodeType, parameters, credentials);
  }
  /**
   * Apply a batch of operations to a workflow atomically
   */
  async applyOperations(workflowId: number, operations: PatchOperation[]): Promise<ApplyOpsResponse> {
    try {
      // Get the current workflow
      const currentWorkflow = await this.getWorkflow(workflowId);

      // Apply operations using the processor
      const result = await this.operationsProcessor.applyOperations(currentWorkflow, operations);

      if (!result.success) {
        return result;
      }

      // If operations were successful, update the workflow
      try {
        const updatedWorkflow = await this.updateWorkflow(workflowId, result.workflow!);
        return {
          success: true,
          workflow: updatedWorkflow
        };
      } catch (error) {
        // Handle version drift or other update errors
        const errorMessage = error instanceof Error ? error.message : 'Failed to update workflow';
        
        // Check if it's a version drift error (this depends on n8n's error response format)
        if (errorMessage.includes('version') || errorMessage.includes('conflict') || errorMessage.includes('409')) {
          return {
            success: false,
            errors: [{
              operationIndex: -1,
              operation: operations[0], // fallback
              error: 'Version drift detected: workflow was modified by another process',
              details: errorMessage
            }]
          };
        }

        return {
          success: false,
          errors: [{
            operationIndex: -1,
            operation: operations[0], // fallback
            error: `Failed to save workflow: ${errorMessage}`,
            details: error
          }]
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        errors: [{
          operationIndex: -1,
          operation: operations[0] || { type: 'unknown' } as any,
          error: `Failed to retrieve workflow: ${errorMessage}`,
          details: error
        }]
      };
    }
  }

  // Graph mutation helpers
  private generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private getDefaultPosition(existingNodes: N8nNode[]): [number, number] {
    if (existingNodes.length === 0) return [250, 300];
    const rightmostX = Math.max(...existingNodes.map((node) => node.position[0]));
    return [rightmostX + 200, 300];
  }

  private async performWorkflowUpdate(
    workflowId: number,
    operation: (workflow: N8nWorkflow) => void,
    maxRetries: number = 3,
  ): Promise<void> {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        const { workflow, etag } = await this.getWorkflowWithETag(workflowId);
        operation(workflow);
        await this.updateWorkflow(workflowId, workflow, etag || undefined);
        return;
      } catch (error: any) {
        const message = error?.message || '';
        if (message.includes('Precondition failed') && retries < maxRetries - 1) {
          retries++;
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retries) * 100));
          continue;
        }
        throw error;
      }
    }
  }

  async createNode(request: CreateNodeRequest): Promise<CreateNodeResponse> {
    const nodeId = this.generateNodeId();
    await this.performWorkflowUpdate(request.workflowId, (workflow) => {
      const position = request.position || this.getDefaultPosition(workflow.nodes);
      const newNode: N8nNode = {
        id: nodeId,
        name: request.name || request.type.split('.').pop() || 'New Node',
        type: request.type,
        typeVersion: 1,
        position,
        parameters: request.params || {},
        credentials: request.credentials || {},
      };
      workflow.nodes.push(newNode);
    });
    return { nodeId };
  }

  async updateNode(request: UpdateNodeRequest): Promise<UpdateNodeResponse> {
    await this.performWorkflowUpdate(request.workflowId, (workflow) => {
      const nodeIndex = workflow.nodes.findIndex((node) => node.id === request.nodeId);
      if (nodeIndex === -1) {
        throw new Error(`Node with id ${request.nodeId} not found in workflow ${request.workflowId}`);
      }
      const node = workflow.nodes[nodeIndex];
      if (request.params !== undefined) node.parameters = { ...node.parameters, ...request.params };
      if (request.credentials !== undefined) node.credentials = { ...node.credentials, ...request.credentials };
      if (request.name !== undefined) node.name = request.name;
      if (request.typeVersion !== undefined) node.typeVersion = request.typeVersion;
    });
    return { nodeId: request.nodeId };
  }

  async connectNodes(request: ConnectNodesRequest): Promise<ConnectNodesResponse> {
    await this.performWorkflowUpdate(request.workflowId, (workflow) => {
      const fromNode = workflow.nodes.find((node) => node.id === request.from.nodeId);
      const toNode = workflow.nodes.find((node) => node.id === request.to.nodeId);
      if (!fromNode) throw new Error(`Source node ${request.from.nodeId} not found in workflow ${request.workflowId}`);
      if (!toNode) throw new Error(`Target node ${request.to.nodeId} not found in workflow ${request.workflowId}`);

      const connections: any = workflow.connections as any;
      if (!connections[fromNode.name]) connections[fromNode.name] = {};
      const fromMain = connections[fromNode.name].main || [];
      connections[fromNode.name].main = fromMain;
      const outputIndex = request.from.outputIndex ?? 0;
      if (!fromMain[outputIndex]) fromMain[outputIndex] = [];
      const connection = { node: toNode.name, type: 'main', index: request.to.inputIndex ?? 0 };
      const exists = fromMain[outputIndex].some((conn: any) => conn.node === connection.node && conn.index === connection.index);
      if (!exists) fromMain[outputIndex].push(connection);
    });
    return { ok: true };
  }

  async deleteNode(request: DeleteNodeRequest): Promise<DeleteNodeResponse> {
    await this.performWorkflowUpdate(request.workflowId, (workflow) => {
      const nodeIndex = workflow.nodes.findIndex((node) => node.id === request.nodeId);
      if (nodeIndex === -1) {
        throw new Error(`Node with id ${request.nodeId} not found in workflow ${request.workflowId}`);
      }
      const nodeName = workflow.nodes[nodeIndex].name;
      workflow.nodes.splice(nodeIndex, 1);
      const connections: any = workflow.connections as any;
      delete connections[nodeName];
      Object.keys(connections).forEach((sourceNodeName) => {
        Object.keys(connections[sourceNodeName]).forEach((outputType) => {
          connections[sourceNodeName][outputType] = connections[sourceNodeName][outputType].map((outputArray: any[]) =>
            outputArray.filter((conn: any) => conn.node !== nodeName),
          );
        });
      });
    });
    return { ok: true };
  }

  async setNodePosition(request: SetNodePositionRequest): Promise<SetNodePositionResponse> {
    await this.performWorkflowUpdate(request.workflowId, (workflow) => {
      const nodeIndex = workflow.nodes.findIndex((node) => node.id === request.nodeId);
      if (nodeIndex === -1) {
        throw new Error(`Node with id ${request.nodeId} not found in workflow ${request.workflowId}`);
      }
      workflow.nodes[nodeIndex].position = [request.x, request.y];
    });
    return { ok: true };
  }

  async sourceControlPull(): Promise<N8nSourceControlPullResponse> {
    const response = await this.api.post<N8nApiResponse<N8nSourceControlPullResponse>>('/source-control/pull');
    return response.data.data;
  }

  async getCredentialSchema(credentialTypeName: string): Promise<N8nCredentialSchema> {
    const response = await this.api.get<N8nApiResponse<N8nCredentialSchema>>(`/credential-types/${credentialTypeName}`);
    return response.data.data;
  }

  async transferWorkflow(id: number, transferData: TransferRequest): Promise<TransferResponse> {
    const response = await this.api.put<N8nApiResponse<TransferResponse>>(`/workflows/${id}/transfer`, transferData);
    return response.data.data;
  }

  async transferCredential(id: number, transferData: TransferRequest): Promise<TransferResponse> {
    const response = await this.api.put<N8nApiResponse<TransferResponse>>(`/credentials/${id}/transfer`, transferData);
    return response.data.data;
  }

  async listWorkflowTags(workflowId: number): Promise<N8nTag[]> {
    const response = await this.api.get<N8nApiResponse<N8nTag[]>>(`/workflows/${workflowId}/tags`);
    return response.data.data;
  }

  async setWorkflowTags(workflowId: number, tagIds: (string | number)[]): Promise<N8nTag[]> {
    const response = await this.api.put<N8nApiResponse<N8nTag[]>>(`/workflows/${workflowId}/tags`, { tagIds });
    return response.data.data;
  }

  async listTags(limit?: number, cursor?: string): Promise<N8nTagsListResponse> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (cursor) params.append('cursor', cursor);
    const queryString = params.toString();
    const url = queryString ? `/tags?${queryString}` : '/tags';
    const response = await this.api.get<N8nTagsListResponse>(url);
    return response.data;
  }

  async getTag(id: number): Promise<N8nTag> {
    const response = await this.api.get<N8nApiResponse<N8nTag>>(`/tags/${id}`);
    return response.data.data;
  }

  async createTag(tag: Omit<N8nTag, 'id' | 'createdAt' | 'updatedAt'>): Promise<N8nTag> {
    const response = await this.api.post<N8nApiResponse<N8nTag>>('/tags', tag);
    return response.data.data;
  }

  async updateTag(id: number, tag: Partial<Omit<N8nTag, 'id' | 'createdAt' | 'updatedAt'>>): Promise<N8nTag> {
    const response = await this.api.put<N8nApiResponse<N8nTag>>(`/tags/${id}`, tag);
    return response.data.data;
  }

  async deleteTag(id: number): Promise<void> {
    await this.api.delete(`/tags/${id}`);
  }

  async listVariables(limit?: number, cursor?: string): Promise<N8nVariablesListResponse> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (cursor) params.append('cursor', cursor);
    const url = params.toString() ? `/variables?${params.toString()}` : '/variables';
    const response = await this.api.get<N8nVariablesListResponse>(url);
    return response.data;
  }

  async createVariable(variable: Omit<N8nVariable, 'id'>): Promise<N8nVariable> {
    const response = await this.api.post<N8nApiResponse<N8nVariable>>('/variables', variable);
    return response.data.data;
  }

  async updateVariable(id: string, variable: Partial<N8nVariable>): Promise<N8nVariable> {
    const response = await this.api.put<N8nApiResponse<N8nVariable>>(`/variables/${id}`, variable);
    return response.data.data;
  }

  async deleteVariable(id: string): Promise<{ ok: boolean }> {
    await this.api.delete(`/variables/${id}`);
    return { ok: true };
  }

  async listExecutions(options?: { limit?: number; cursor?: string; workflowId?: string }): Promise<N8nExecutionsListResponse> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.cursor) params.append('cursor', options.cursor);
    if (options?.workflowId) params.append('workflowId', options.workflowId);
    const url = `/executions${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.api.get<N8nExecutionsListResponse>(url);
    return response.data;
  }

  async getExecution(id: string): Promise<N8nExecution> {
    const response = await this.api.get<N8nApiResponse<N8nExecution>>(`/executions/${id}`);
    return response.data.data;
  }

  async deleteExecution(id: string): Promise<N8nExecutionDeleteResponse> {
    await this.api.delete(`/executions/${id}`);
    return { success: true };
  }

  async getWebhookUrls(workflowId: number, nodeId: string): Promise<N8nWebhookUrls> {
    const workflow = await this.getWorkflow(workflowId);
    const webhookNode = workflow.nodes.find((node) => node.id === nodeId);
    if (!webhookNode) throw new Error(`Node with ID '${nodeId}' not found in workflow ${workflowId}`);
    if (webhookNode.type !== 'n8n-nodes-base.webhook') {
      throw new Error(`Node '${nodeId}' is not a webhook node (type: ${webhookNode.type})`);
    }
    const path = webhookNode.parameters?.path || '';
    if (!path) throw new Error(`Webhook node '${nodeId}' does not have a path configured`);
    const testUrl = `${this.baseUrl}/webhook-test/${path}`;
    const productionUrl = `${this.baseUrl}/webhook/${path}`;
    return { testUrl, productionUrl };
  }

  async runOnce(workflowId: number, input?: any): Promise<N8nExecutionResponse> {
    try {
      const workflow = await this.getWorkflow(workflowId);
      const hasTriggerNodes = workflow.nodes.some(
        (node) => node.type === 'n8n-nodes-base.webhook' || node.type === 'n8n-nodes-base.cron' || node.type.includes('trigger'),
      );
      if (hasTriggerNodes) {
        const executionData = { workflowData: workflow, runData: input || {} };
        const response = await this.api.post<N8nApiResponse<any>>('/executions', executionData);
        return { executionId: response.data.data.id || response.data.data.executionId, status: response.data.data.status || 'running' };
      } else {
        const response = await this.api.post<N8nApiResponse<any>>(`/workflows/${workflowId}/execute`, { data: input || {} });
        return { executionId: response.data.data.id || response.data.data.executionId, status: response.data.data.status || 'running' };
      }
    } catch (error: any) {
      if (error instanceof Error && error.message.includes('404')) {
        throw new Error(`Workflow ${workflowId} not found or cannot be executed manually`);
      }
      throw error;
    }
  }
}