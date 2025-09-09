import axios, { AxiosInstance } from 'axios';
import { N8nWorkflow, N8nConfig, N8nApiResponse, N8nWorkflowsListResponse, PatchOperation, ApplyOpsResponse } from './types.js';
import { WorkflowOperationsProcessor } from './operations.js';

export class N8nClient {
  private api: AxiosInstance;
  private operationsProcessor: WorkflowOperationsProcessor;

  constructor(config: N8nConfig) {
    this.api = axios.create({
      baseURL: `${config.baseUrl}/api/v1`,
      headers: {
        'Content-Type': 'application/json',
      },
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
}