import axios, { AxiosInstance } from 'axios';
import { N8nWorkflow, N8nConfig, N8nApiResponse, N8nWorkflowsListResponse, N8nTag, N8nTagsListResponse, N8nVariable, N8nVariablesListResponse, N8nExecution, N8nExecutionsListResponse, N8nExecutionDeleteResponse, N8nWebhookUrls, N8nExecutionResponse } from './types.js';

export class N8nClient {
  private api: AxiosInstance;
  private baseUrl: string;

  constructor(config: N8nConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.api = axios.create({
      baseURL: `${this.baseUrl}/api/v1`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Setup authentication
    if (config.apiKey) {
      this.api.defaults.headers.common['X-N8N-API-KEY'] = config.apiKey;
    } else if (config.username && config.password) {
      const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
      this.api.defaults.headers.common['Authorization'] = `Basic ${auth}`;
    }
  }

  async listWorkflows(): Promise<N8nWorkflow[]> {
    const response = await this.api.get<N8nWorkflowsListResponse>('/workflows');
    return response.data.data;
  }

  async getWorkflow(id: number): Promise<N8nWorkflow> {
    const response = await this.api.get<N8nApiResponse<N8nWorkflow>>(`/workflows/${id}`);
    return response.data.data;
  }

  async createWorkflow(workflow: Omit<N8nWorkflow, 'id'>): Promise<N8nWorkflow> {
    const response = await this.api.post<N8nApiResponse<N8nWorkflow>>('/workflows', workflow);
    return response.data.data;
  }

  async updateWorkflow(id: number, workflow: Partial<N8nWorkflow>, ifMatch?: string): Promise<N8nWorkflow> {
    const headers: Record<string, string> = {};
    if (ifMatch) {
      headers['If-Match'] = ifMatch;
    }

    try {
      const response = await this.api.put<N8nApiResponse<N8nWorkflow>>(`/workflows/${id}`, workflow, {
        headers,
      });
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 412) {
        throw new Error('Precondition failed: The workflow has been modified by another user. Please fetch the latest version and try again.');
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

  // Tags API methods
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

  // Variables API methods
  async listVariables(): Promise<N8nVariablesListResponse> {
    const response = await this.api.get<N8nVariablesListResponse>('/variables');
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

  // Executions API methods
  async listExecutions(options?: { limit?: number; cursor?: string; workflowId?: string }): Promise<N8nExecutionsListResponse> {
    const params = new URLSearchParams();
    
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options?.cursor) {
      params.append('cursor', options.cursor);
    }
    if (options?.workflowId) {
      params.append('workflowId', options.workflowId);
    }

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

  // Webhook URLs method
  async getWebhookUrls(workflowId: number, nodeId: string): Promise<N8nWebhookUrls> {
    // Get the workflow to find the webhook node
    const workflow = await this.getWorkflow(workflowId);
    const webhookNode = workflow.nodes.find(node => node.id === nodeId);
    
    if (!webhookNode) {
      throw new Error(`Node with ID '${nodeId}' not found in workflow ${workflowId}`);
    }
    
    if (webhookNode.type !== 'n8n-nodes-base.webhook') {
      throw new Error(`Node '${nodeId}' is not a webhook node (type: ${webhookNode.type})`);
    }
    
    const path = webhookNode.parameters?.path || '';
    if (!path) {
      throw new Error(`Webhook node '${nodeId}' does not have a path configured`);
    }
    
    // Construct URLs based on n8n's webhook URL pattern
    const testUrl = `${this.baseUrl}/webhook-test/${path}`;
    const productionUrl = `${this.baseUrl}/webhook/${path}`;
    
    return {
      testUrl,
      productionUrl
    };
  }

  // Manual execution method
  async runOnce(workflowId: number, input?: any): Promise<N8nExecutionResponse> {
    try {
      // Get the workflow to check if it's a trigger workflow
      const workflow = await this.getWorkflow(workflowId);
      
      // Check if workflow has trigger nodes (starts automatically)
      const hasTriggerNodes = workflow.nodes.some(node => 
        node.type === 'n8n-nodes-base.webhook' ||
        node.type === 'n8n-nodes-base.cron' ||
        node.type.includes('trigger')
      );
      
      // For trigger workflows, we need to use a different approach
      if (hasTriggerNodes) {
        // Use the executions endpoint to manually trigger
        const executionData = {
          workflowData: workflow,
          runData: input || {}
        };
        
        const response = await this.api.post<N8nApiResponse<any>>('/executions', executionData);
        
        return {
          executionId: response.data.data.id || response.data.data.executionId,
          status: response.data.data.status || 'running'
        };
      } else {
        // For manual workflows, trigger directly
        const response = await this.api.post<N8nApiResponse<any>>(`/workflows/${workflowId}/execute`, {
          data: input || {}
        });
        
        return {
          executionId: response.data.data.id || response.data.data.executionId,
          status: response.data.data.status || 'running'
        };
      }
    } catch (error) {
      // If the workflow can't be executed (e.g., no trigger nodes for manual workflow),
      // provide a helpful error message
      if (error instanceof Error && error.message.includes('404')) {
        throw new Error(`Workflow ${workflowId} not found or cannot be executed manually`);
      }
      throw error;
    }
  }
}