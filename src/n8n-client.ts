import axios, { AxiosInstance } from 'axios';
import { N8nWorkflow, N8nConfig, N8nApiResponse, N8nWorkflowsListResponse, N8nTag, N8nTagsListResponse } from './types.js';

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
}