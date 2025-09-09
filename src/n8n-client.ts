import axios, { AxiosInstance } from 'axios';
import { N8nWorkflow, N8nConfig, N8nApiResponse, N8nWorkflowsListResponse, N8nExecution, N8nExecutionsListResponse, N8nExecutionDeleteResponse } from './types.js';

export class N8nClient {
  private api: AxiosInstance;

  constructor(config: N8nConfig) {
    this.api = axios.create({
      baseURL: `${config.baseUrl}/api/v1`,
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

  async updateWorkflow(id: number, workflow: Partial<N8nWorkflow>): Promise<N8nWorkflow> {
    const response = await this.api.patch<N8nApiResponse<N8nWorkflow>>(`/workflows/${id}`, workflow);
    return response.data.data;
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
}