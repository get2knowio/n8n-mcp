import axios, { AxiosInstance } from 'axios';
import { logger, getLogLevel, redact } from './logger.js';
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
  ValidationResult,
  EndpointAttempt,
  FallbackOperationResult
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

    // Axios interceptors for debug tracing (guard against mocked axios without interceptors)
    try {
      const interceptors: any = (this.api as any).interceptors;
      if (getLogLevel() === 'debug' && interceptors?.request?.use && interceptors?.response?.use) {
        interceptors.request.use((req: any) => {
          req.__start = Date.now();
          logger.debug('HTTP request', {
            method: req.method,
            url: req.baseURL ? `${req.baseURL}${req.url}` : req.url,
            headers: redact(req.headers as any),
            params: redact(req.params as any),
          });
          return req;
        });

        interceptors.response.use(
          (res: any) => {
            const start = res.config?.__start || Date.now();
            const durationMs = Date.now() - start;
            logger.debug('HTTP response', {
              status: res.status,
              url: res.config?.baseURL ? `${res.config.baseURL}${res.config.url}` : res.config?.url,
              durationMs,
            });
            return res;
          },
          (err: any) => {
            try {
              const cfg = err?.config || {};
              const start = (cfg as any).__start || Date.now();
              const durationMs = Date.now() - start;
              logger.error('HTTP error', {
                url: cfg.baseURL ? `${cfg.baseURL}${cfg.url}` : cfg.url,
                method: cfg.method,
                status: err?.response?.status,
                data: redact(err?.response?.data),
                durationMs,
                message: err?.message,
              });
            } catch {}
            return Promise.reject(err);
          },
        );
      }
    } catch {
      // ignore interceptor setup errors in non-debug or mocked environments
    }
  }

  /**
   * Make a request to a REST endpoint (outside /api/v1)
   * Used for fallback to /rest/* endpoints
   */
  private async requestRest<T = any>(method: string, path: string, data?: any): Promise<{ ok: boolean; status: number; data?: T; error?: any }> {
    try {
      const url = `${this.baseUrl}${path}`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      
      // Copy auth headers from the main API instance
      if (this.api.defaults.headers.common['X-N8N-API-KEY']) {
        headers['X-N8N-API-KEY'] = this.api.defaults.headers.common['X-N8N-API-KEY'] as string;
      }
      if (this.api.defaults.headers.common['Authorization']) {
        headers['Authorization'] = this.api.defaults.headers.common['Authorization'] as string;
      }

      const response = await axios.request<T>({
        method,
        url,
        headers,
        data,
      });
      
      return { ok: true, status: response.status, data: response.data };
    } catch (error: any) {
      return {
        ok: false,
        status: error.response?.status || 0,
        error: error.response?.data || error.message,
      };
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

  async getWorkflow(id: string | number): Promise<N8nWorkflow> {
    const response = await this.api.get<N8nApiResponse<N8nWorkflow> | N8nWorkflow>(`/workflows/${id}`);
    const payload: any = response.data as any;
    return (payload && typeof payload === 'object' && 'data' in payload) ? payload.data : payload;
  }

  async getWorkflowWithETag(id: string | number): Promise<{ workflow: N8nWorkflow; etag: string | null }> {
    const response = await this.api.get<N8nApiResponse<N8nWorkflow> | N8nWorkflow>(`/workflows/${id}`);
    const headers: any = response.headers || {};
    const etag = headers.etag || headers.ETag || headers['etag'] || headers['ETag'] || null;
    const payload: any = response.data as any;
    const workflow: N8nWorkflow = (payload && typeof payload === 'object' && 'data' in payload) ? payload.data : payload;
    return { workflow, etag };
  }

  async createWorkflow(workflow: Omit<N8nWorkflow, 'id'>): Promise<N8nWorkflow> {
    // Resolve credential aliases before creating the workflow
    await this.resolveCredentialsInWorkflow(workflow);
    // Ensure required fields expected by n8n API
    if ((workflow as any).settings == null) {
      (workflow as any).settings = {};
    }
    // Some n8n deployments may not accept non-numeric tag values on create.
    // If tags are provided as strings (names), omit them here; users can set numeric tag IDs via setWorkflowTags.
    if (Array.isArray((workflow as any).tags) && (workflow as any).tags.some((t: any) => typeof t !== 'number')) {
      delete (workflow as any).tags;
    }
    // 'active' is managed via dedicated activate/deactivate endpoints; omit on create
    if ('active' in (workflow as any)) {
      delete (workflow as any).active;
    }
    const response = await this.api.post<N8nApiResponse<N8nWorkflow> | N8nWorkflow>('/workflows', workflow);
    const payload: any = response.data as any;
    return (payload && typeof payload === 'object' && 'data' in payload) ? payload.data : payload;
  }

  async updateWorkflow(id: string | number, workflow: Partial<N8nWorkflow>, ifMatch?: string): Promise<N8nWorkflow> {
    // Resolve credential aliases before updating the workflow
    await this.resolveCredentialsInWorkflow(workflow);
    
    const headers: Record<string, string> = {};
    // Allow 'active' to be updated via standard update to support tests and API compatibility
    if (ifMatch) headers['If-Match'] = ifMatch;
    try {
      const response = await this.api.put<N8nApiResponse<N8nWorkflow> | N8nWorkflow>(`/workflows/${id}`, workflow, { headers });
      const payload: any = response.data as any;
      return (payload && typeof payload === 'object' && 'data' in payload) ? payload.data : payload;
    } catch (error: any) {
      if (error.response?.status === 412) {
        throw new Error(
          'Precondition failed: The workflow has been modified by another user. Please fetch the latest version and try again.',
        );
      }
      throw error;
    }
  }

  async deleteWorkflow(id: string | number): Promise<void> {
    await this.api.delete(`/workflows/${id}`);
  }

  async activateWorkflow(id: string | number): Promise<N8nWorkflow> {
    const response = await this.api.post<N8nApiResponse<N8nWorkflow> | N8nWorkflow>(`/workflows/${id}/activate`);
    const payload: any = response.data as any;
    return (payload && typeof payload === 'object' && 'data' in payload) ? payload.data : payload;
  }

  async deactivateWorkflow(id: string | number): Promise<N8nWorkflow> {
    const response = await this.api.post<N8nApiResponse<N8nWorkflow> | N8nWorkflow>(`/workflows/${id}/deactivate`);
    const payload: any = response.data as any;
    return (payload && typeof payload === 'object' && 'data' in payload) ? payload.data : payload;
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
  async applyOperations(workflowId: string | number, operations: PatchOperation[]): Promise<ApplyOpsResponse> {
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
    workflowId: string | number,
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

  async transferWorkflow(id: string | number, transferData: TransferRequest): Promise<TransferResponse> {
    const response = await this.api.put<N8nApiResponse<TransferResponse>>(`/workflows/${id}/transfer`, transferData);
    return response.data.data;
  }

  async transferCredential(id: string | number, transferData: TransferRequest): Promise<TransferResponse> {
    const response = await this.api.put<N8nApiResponse<TransferResponse>>(`/credentials/${id}/transfer`, transferData);
    return response.data.data;
  }

  async listWorkflowTags(workflowId: string | number): Promise<N8nTag[]> {
    const response = await this.api.get<N8nApiResponse<N8nTag[]>>(`/workflows/${workflowId}/tags`);
    return response.data.data;
  }

  async setWorkflowTags(workflowId: string | number, tagIds: (string | number)[]): Promise<N8nTag[]> {
    const attempts: EndpointAttempt[] = [];
    
    // Get tag names for fallback strategies
    let tagNames: string[] = [];
    try {
      const allTags = await this.listTags();
      tagNames = tagIds
        .map(id => allTags.data.find(t => t.id == id)?.name)
        .filter((name): name is string => !!name);
    } catch (e) {
      // If we can't get tag names, we'll skip name-based strategies
    }
    
    // Strategy 1: PATCH /rest/workflows/{id} with tag names
    // Only run if ALL tagIds resolved to names to avoid dropping tags
    if (tagNames.length > 0 && tagNames.length === tagIds.length) {
      const patchRestNames = await this.requestRest('PATCH', `/rest/workflows/${workflowId}`, { tags: tagNames });
      attempts.push({
        endpoint: `/rest/workflows/${workflowId}`,
        method: 'PATCH (names)',
        status: patchRestNames.status,
        message: String(patchRestNames.error?.message ?? patchRestNames.error ?? '')
      });
      
      if (patchRestNames.ok) {
        // Fetch and return the updated tags
        try {
          return await this.listWorkflowTags(workflowId);
        } catch (e) {
          // If list fails, return empty array but log success
          logger.debug('Tags set successfully but unable to list them', { workflowId });
          return [];
        }
      }
    }
    
    // Strategy 2: PATCH /rest/workflows/{id} with tag IDs as objects
    const tagIdObjects = tagIds.map(id => ({ id }));
    const patchRestIds = await this.requestRest('PATCH', `/rest/workflows/${workflowId}`, { tags: tagIdObjects });
    attempts.push({
      endpoint: `/rest/workflows/${workflowId}`,
      method: 'PATCH (id objects)',
      status: patchRestIds.status,
      message: String(patchRestIds.error?.message ?? patchRestIds.error ?? '')
    });
    
    if (patchRestIds.ok) {
      try {
        return await this.listWorkflowTags(workflowId);
      } catch (e) {
        logger.debug('Tags set successfully but unable to list them', { workflowId });
        return [];
      }
    }
    
    // Strategy 3: PUT /api/v1/workflows/{id}/tags with tagIds (current default)
    try {
      const response = await this.api.put<N8nApiResponse<N8nTag[]>>(`/workflows/${workflowId}/tags`, { tagIds });
      attempts.push({
        endpoint: `/api/v1/workflows/${workflowId}/tags`,
        method: 'PUT',
        status: response.status,
      });
      return response.data.data;
    } catch (error: any) {
      attempts.push({
        endpoint: `/api/v1/workflows/${workflowId}/tags`,
        method: 'PUT',
        status: error.response?.status || 0,
        message: error.response?.data?.message || error.message
      });
      
      // All strategies failed, throw with details
      const errorMsg = `Unable to set workflow tags. Attempted endpoints: ${attempts.map(a => `${a.method} ${a.endpoint} (${a.status})`).join(', ')}`;
      const err = new Error(errorMsg);
      (err as any).attempts = attempts;
      throw err;
    }
  }

  async listTags(limit?: number, cursor?: string): Promise<N8nTagsListResponse> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (cursor) params.append('cursor', cursor);
    const queryString = params.toString();
    const url = queryString ? `/tags?${queryString}` : '/tags';
    
    try {
      const response = await this.api.get<N8nTagsListResponse>(url);
      return response.data;
    } catch (error: any) {
      // Fallback to /rest/tags if /api/v1/tags fails
      if (error.response?.status === 404 || error.response?.status === 401) {
        const restPath = queryString ? `/rest/tags?${queryString}` : '/rest/tags';
        const restResponse = await this.requestRest<N8nTagsListResponse>('GET', restPath);
        
        if (restResponse.ok && restResponse.data) {
          // Normalize response - /rest might return array directly or { data: [] }
          const data = restResponse.data;
          if (Array.isArray(data)) {
            return { data, nextCursor: undefined };
          }
          return data;
        }
      }
      throw error;
    }
  }

  async getTag(id: string | number): Promise<N8nTag> {
    const response = await this.api.get<N8nApiResponse<N8nTag>>(`/tags/${id}`);
    return response.data.data;
  }

  async createTag(tag: Omit<N8nTag, 'id' | 'createdAt' | 'updatedAt'>): Promise<N8nTag> {
    const response = await this.api.post<N8nApiResponse<N8nTag>>('/tags', tag);
    return response.data.data;
  }

  async updateTag(id: string | number, tag: Partial<Omit<N8nTag, 'id' | 'createdAt' | 'updatedAt'>>): Promise<N8nTag> {
    const attempts: EndpointAttempt[] = [];
    
    // Strategy 1: Try PATCH on /rest/tags/{id}
    const patchRest = await this.requestRest('PATCH', `/rest/tags/${id}`, tag);
    attempts.push({
      endpoint: `/rest/tags/${id}`,
      method: 'PATCH',
      status: patchRest.status,
      message: String(patchRest.error?.message ?? patchRest.error ?? '')
    });
    
    if (patchRest.ok && patchRest.data) {
      // Unwrap response if needed
      const result = (patchRest.data as any)?.data || patchRest.data;
      return result as N8nTag;
    }
    
    // Strategy 2: Try PUT on /api/v1/tags/{id}
    // PUT typically requires a full payload, so if the incoming tag is partial, fetch and merge
    try {
      let fullPayload = tag;
      
      // Check if we need to fetch the existing tag for a merge
      // If name is missing, we need to fetch the existing tag
      if (!tag.name) {
        try {
          const existingTag = await this.getTag(id);
          // Merge existing tag with provided updates
          fullPayload = {
            name: existingTag.name,
            ...tag
          };
        } catch (fetchError) {
          // If we can't fetch, try the PUT anyway with what we have
          logger.debug('Could not fetch existing tag for merge', { id, error: fetchError });
        }
      }
      
      const response = await this.api.put<N8nApiResponse<N8nTag>>(`/tags/${id}`, fullPayload);
      attempts.push({
        endpoint: `/api/v1/tags/${id}`,
        method: 'PUT',
        status: response.status,
        message: undefined
      });
      return response.data.data;
    } catch (error: any) {
      attempts.push({
        endpoint: `/api/v1/tags/${id}`,
        method: 'PUT',
        status: error.response?.status || 0,
        message: String(error.response?.data?.message ?? error.message ?? error ?? '')
      });
      
      // If updating color specifically and all endpoints failed, provide helpful message
      if (tag.color && !tag.name) {
        const errorMsg = `Unable to update tag color. Attempted endpoints: ${attempts.map(a => `${a.method} ${a.endpoint} (${a.status})`).join(', ')}. Tag color may need to be set via the n8n UI for this instance.`;
        const err = new Error(errorMsg);
        (err as any).attempts = attempts;
        throw err;
      }
      
      throw error;
    }
  }

  async deleteTag(id: string | number): Promise<void> {
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

  async getWebhookUrls(workflowId: string | number, nodeId: string): Promise<N8nWebhookUrls> {
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

  async runOnce(workflowId: string | number, input?: any): Promise<N8nExecutionResponse> {
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
