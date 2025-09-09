import axios, { AxiosInstance } from 'axios';
import { N8nWorkflow, N8nConfig, N8nApiResponse, N8nWorkflowsListResponse, N8nVariable, N8nVariablesListResponse } from './types.js';

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
}