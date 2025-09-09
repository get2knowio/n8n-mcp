import axios, { AxiosInstance } from 'axios';
import { N8nWorkflow, N8nConfig, N8nApiResponse, N8nWorkflowsListResponse, N8nNodeType, N8nNodeExample, ValidationResult } from './types.js';
import { getNodeTypes, getNodeType, getNodeExamples } from './node-registry.js';
import { validateFullNodeConfig } from './node-validator.js';

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
}