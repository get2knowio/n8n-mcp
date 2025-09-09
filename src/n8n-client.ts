import axios, { AxiosInstance } from 'axios';
import { N8nWorkflow, N8nConfig, N8nApiResponse, N8nWorkflowsListResponse, N8nCredential, N8nCredentialsListResponse } from './types.js';

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
    // Resolve credential aliases before creating the workflow
    await this.resolveCredentialsInWorkflow(workflow);
    
    const response = await this.api.post<N8nApiResponse<N8nWorkflow>>('/workflows', workflow);
    return response.data.data;
  }

  async updateWorkflow(id: number, workflow: Partial<N8nWorkflow>): Promise<N8nWorkflow> {
    // Resolve credential aliases before updating the workflow
    await this.resolveCredentialsInWorkflow(workflow);
    
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
    
    return matches[0].id;
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
}