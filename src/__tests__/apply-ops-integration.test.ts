import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { N8nClient } from '../n8n-client';
import { N8nConfig, N8nWorkflow, PatchOperation } from '../types';

// Mock axios
jest.mock('axios');

describe('N8nClient applyOperations', () => {
  let client: N8nClient;
  let mockAxios: any;
  let sampleWorkflow: N8nWorkflow;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create a proper mock axios instance
    const mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      defaults: {
        headers: {
          common: {}
        }
      }
    };

    // Mock axios create to return our mock instance
    mockAxios = mockAxiosInstance;

    // Setup axios mock
    const axios = require('axios');
    axios.create = jest.fn().mockReturnValue(mockAxiosInstance);

    const config: N8nConfig = {
      baseUrl: 'http://localhost:5678',
      apiKey: 'test-key'
    };

    client = new N8nClient(config);

    sampleWorkflow = {
      id: 1,
      name: 'Test Workflow',
      nodes: [
        {
          id: 'webhook-1',
          name: 'Webhook',
          type: 'n8n-nodes-base.webhook',
          typeVersion: 1,
          position: [100, 100],
          parameters: {
            httpMethod: 'GET',
            path: 'test'
          }
        }
      ],
      connections: {},
      active: false,
      tags: ['test']
    };
  });

  describe('applyOperations', () => {
    it('should apply operations successfully and update workflow', async () => {
      const operations: PatchOperation[] = [
        {
          type: 'addNode',
          node: {
            id: 'set-1',
            name: 'Set',
            type: 'n8n-nodes-base.set',
            typeVersion: 1,
            position: [300, 100],
            parameters: {
              values: {
                string: [{ name: 'message', value: 'hello' }]
              }
            }
          }
        },
        {
          type: 'setWorkflowProperty',
          property: 'active',
          value: true
        }
      ];

      // Mock getWorkflow to return current workflow
      mockAxios.get.mockResolvedValueOnce({
        data: {
          data: sampleWorkflow
        }
      });

      // Mock updateWorkflow to return updated workflow
      const expectedUpdatedWorkflow = {
        ...sampleWorkflow,
        active: true,
        nodes: [
          ...sampleWorkflow.nodes,
          (operations[0] as any).node
        ]
      };

      mockAxios.patch.mockResolvedValueOnce({
        data: {
          data: expectedUpdatedWorkflow
        }
      });

      const result = await client.applyOperations(1, operations);

      expect(result.success).toBe(true);
      expect(result.workflow).toBeDefined();
      expect(result.workflow?.nodes).toHaveLength(2);
      expect(result.workflow?.active).toBe(true);

      // Verify API calls
      expect(mockAxios.get).toHaveBeenCalledWith('/workflows/1');
      expect(mockAxios.patch).toHaveBeenCalledWith('/workflows/1', expect.objectContaining({
        active: true,
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: 'webhook-1' }),
          expect.objectContaining({ id: 'set-1' })
        ])
      }));
    });

    it('should return error when operation fails', async () => {
      const operations: PatchOperation[] = [
        {
          type: 'addNode',
          node: {
            id: 'webhook-1', // Duplicate ID - should fail
            name: 'Another Webhook',
            type: 'n8n-nodes-base.webhook',
            typeVersion: 1,
            position: [200, 200]
          }
        }
      ];

      // Mock getWorkflow to return current workflow
      mockAxios.get.mockResolvedValueOnce({
        data: {
          data: sampleWorkflow
        }
      });

      const result = await client.applyOperations(1, operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].error).toContain('already exists');
      expect(result.errors![0].operationIndex).toBe(0);

      // Verify that update was not called because operation failed
      expect(mockAxios.patch).not.toHaveBeenCalled();
    });

    it('should handle version drift error from n8n API', async () => {
      const operations: PatchOperation[] = [
        {
          type: 'setWorkflowProperty',
          property: 'name',
          value: 'Updated Name'
        }
      ];

      // Mock getWorkflow to return current workflow
      mockAxios.get.mockResolvedValueOnce({
        data: {
          data: sampleWorkflow
        }
      });

      // Mock updateWorkflow to fail with version conflict
      const versionError = new Error('409 Conflict: Version drift detected');
      mockAxios.patch.mockRejectedValueOnce(versionError);

      const result = await client.applyOperations(1, operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].error).toContain('Version drift detected');
    });

    it('should handle workflow not found error', async () => {
      const operations: PatchOperation[] = [
        {
          type: 'setWorkflowProperty',
          property: 'name',
          value: 'Updated Name'
        }
      ];

      // Mock getWorkflow to fail
      const notFoundError = new Error('Workflow not found');
      mockAxios.get.mockRejectedValueOnce(notFoundError);

      const result = await client.applyOperations(999, operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].error).toContain('Failed to retrieve workflow');
    });

    it('should handle empty operations array', async () => {
      const operations: PatchOperation[] = [];

      // Mock getWorkflow to return current workflow
      mockAxios.get.mockResolvedValueOnce({
        data: {
          data: sampleWorkflow
        }
      });

      // Mock updateWorkflow to return unchanged workflow
      mockAxios.patch.mockResolvedValueOnce({
        data: {
          data: sampleWorkflow
        }
      });

      const result = await client.applyOperations(1, operations);

      expect(result.success).toBe(true);
      expect(result.workflow).toEqual(sampleWorkflow);
    });
  });
});