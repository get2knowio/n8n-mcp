import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { N8nClient } from '../n8n-client';
import { N8nConfig, N8nWorkflow } from '../types';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('N8nClient', () => {
  let client: N8nClient;
  let mockApi: any;

  const mockConfig: N8nConfig = {
    baseUrl: 'http://test-n8n.local:5678',
    apiKey: 'test-api-key',
  };

  const mockWorkflow: N8nWorkflow = {
    id: 1,
    name: 'Test Workflow',
    nodes: [
      {
        id: 'webhook',
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [250, 300],
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

  beforeEach(() => {
    mockApi = {
      defaults: {
        headers: {
          common: {},
        },
      },
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    };

    mockedAxios.create.mockReturnValue(mockApi);
    client = new N8nClient(mockConfig);
  });

  describe('constructor', () => {
    it('should create axios instance with correct base URL', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://test-n8n.local:5678/api/v1',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should set API key header when apiKey is provided', () => {
      expect(mockApi.defaults.headers.common['X-N8N-API-KEY']).toBe('test-api-key');
    });

    it('should set basic auth header when username and password are provided', () => {
      const basicAuthConfig: N8nConfig = {
        baseUrl: 'http://test-n8n.local:5678',
        username: 'testuser',
        password: 'testpass',
      };

      new N8nClient(basicAuthConfig);
      const expectedAuth = Buffer.from('testuser:testpass').toString('base64');
      expect(mockApi.defaults.headers.common['Authorization']).toBe(`Basic ${expectedAuth}`);
    });
  });

  describe('listWorkflows', () => {
    it('should return list of workflows', async () => {
      const mockResponse = {
        data: {
          data: [mockWorkflow]
        }
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await client.listWorkflows();

      expect(mockApi.get).toHaveBeenCalledWith('/workflows');
      expect(result).toEqual([mockWorkflow]);
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      mockApi.get.mockRejectedValue(error);

      await expect(client.listWorkflows()).rejects.toThrow('API Error');
    });
  });

  describe('getWorkflow', () => {
    it('should return specific workflow by ID', async () => {
      const mockResponse = {
        data: {
          data: mockWorkflow
        }
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await client.getWorkflow(1);

      expect(mockApi.get).toHaveBeenCalledWith('/workflows/1');
      expect(result).toEqual(mockWorkflow);
    });

    it('should handle workflow not found', async () => {
      const error = new Error('Workflow not found');
      mockApi.get.mockRejectedValue(error);

      await expect(client.getWorkflow(999)).rejects.toThrow('Workflow not found');
    });
  });

  describe('createWorkflow', () => {
    it('should create a new workflow', async () => {
      const newWorkflow = { ...mockWorkflow };
      delete newWorkflow.id;
      
      const mockResponse = {
        data: {
          data: mockWorkflow
        }
      };
      mockApi.post.mockResolvedValue(mockResponse);

      const result = await client.createWorkflow(newWorkflow);

      expect(mockApi.post).toHaveBeenCalledWith('/workflows', newWorkflow);
      expect(result).toEqual(mockWorkflow);
    });

    it('should handle creation errors', async () => {
      const newWorkflow = { ...mockWorkflow };
      delete newWorkflow.id;
      
      const error = new Error('Creation failed');
      mockApi.post.mockRejectedValue(error);

      await expect(client.createWorkflow(newWorkflow)).rejects.toThrow('Creation failed');
    });
  });

  describe('updateWorkflow', () => {
    it('should update an existing workflow', async () => {
      const updateData = { name: 'Updated Workflow' };
      const updatedWorkflow = { ...mockWorkflow, ...updateData };
      
      const mockResponse = {
        data: {
          data: updatedWorkflow
        }
      };
      mockApi.patch.mockResolvedValue(mockResponse);

      const result = await client.updateWorkflow(1, updateData);

      expect(mockApi.patch).toHaveBeenCalledWith('/workflows/1', updateData);
      expect(result).toEqual(updatedWorkflow);
    });

    it('should handle update errors', async () => {
      const updateData = { name: 'Updated Workflow' };
      const error = new Error('Update failed');
      mockApi.patch.mockRejectedValue(error);

      await expect(client.updateWorkflow(1, updateData)).rejects.toThrow('Update failed');
    });
  });

  describe('deleteWorkflow', () => {
    it('should delete a workflow', async () => {
      mockApi.delete.mockResolvedValue({});

      await client.deleteWorkflow(1);

      expect(mockApi.delete).toHaveBeenCalledWith('/workflows/1');
    });

    it('should handle deletion errors', async () => {
      const error = new Error('Deletion failed');
      mockApi.delete.mockRejectedValue(error);

      await expect(client.deleteWorkflow(1)).rejects.toThrow('Deletion failed');
    });
  });

  describe('activateWorkflow', () => {
    it('should activate a workflow', async () => {
      const activeWorkflow = { ...mockWorkflow, active: true };
      const mockResponse = {
        data: {
          data: activeWorkflow
        }
      };
      mockApi.post.mockResolvedValue(mockResponse);

      const result = await client.activateWorkflow(1);

      expect(mockApi.post).toHaveBeenCalledWith('/workflows/1/activate');
      expect(result).toEqual(activeWorkflow);
    });

    it('should handle activation errors', async () => {
      const error = new Error('Activation failed');
      mockApi.post.mockRejectedValue(error);

      await expect(client.activateWorkflow(1)).rejects.toThrow('Activation failed');
    });
  });

  describe('deactivateWorkflow', () => {
    it('should deactivate a workflow', async () => {
      const inactiveWorkflow = { ...mockWorkflow, active: false };
      const mockResponse = {
        data: {
          data: inactiveWorkflow
        }
      };
      mockApi.post.mockResolvedValue(mockResponse);

      const result = await client.deactivateWorkflow(1);

      expect(mockApi.post).toHaveBeenCalledWith('/workflows/1/deactivate');
      expect(result).toEqual(inactiveWorkflow);
    });

    it('should handle deactivation errors', async () => {
      const error = new Error('Deactivation failed');
      mockApi.post.mockRejectedValue(error);

      await expect(client.deactivateWorkflow(1)).rejects.toThrow('Deactivation failed');
    });
  });

  describe('getWebhookUrls', () => {
    const mockWorkflowWithWebhook: N8nWorkflow = {
      id: 1,
      name: 'Test Workflow with Webhook',
      nodes: [
        {
          id: 'webhook-node',
          name: 'Webhook',
          type: 'n8n-nodes-base.webhook',
          typeVersion: 1,
          position: [250, 300],
          parameters: {
            httpMethod: 'GET',
            path: 'test-webhook'
          }
        }
      ],
      connections: {},
      active: false
    };

    it('should return webhook URLs for a valid webhook node', async () => {
      const mockResponse = {
        data: {
          data: mockWorkflowWithWebhook
        }
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await client.getWebhookUrls(1, 'webhook-node');

      expect(result).toEqual({
        testUrl: 'http://test-n8n.local:5678/webhook-test/test-webhook',
        productionUrl: 'http://test-n8n.local:5678/webhook/test-webhook'
      });
    });

    it('should throw error when node is not found', async () => {
      const mockResponse = {
        data: {
          data: mockWorkflowWithWebhook
        }
      };
      mockApi.get.mockResolvedValue(mockResponse);

      await expect(client.getWebhookUrls(1, 'non-existent-node')).rejects.toThrow(
        "Node with ID 'non-existent-node' not found in workflow 1"
      );
    });

    it('should throw error when node is not a webhook node', async () => {
      const workflowWithNonWebhook = {
        ...mockWorkflowWithWebhook,
        nodes: [
          {
            id: 'http-node',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [250, 300],
            parameters: {}
          }
        ]
      };
      
      const mockResponse = {
        data: {
          data: workflowWithNonWebhook
        }
      };
      mockApi.get.mockResolvedValue(mockResponse);

      await expect(client.getWebhookUrls(1, 'http-node')).rejects.toThrow(
        "Node 'http-node' is not a webhook node (type: n8n-nodes-base.httpRequest)"
      );
    });

    it('should throw error when webhook node has no path', async () => {
      const workflowWithoutPath = {
        ...mockWorkflowWithWebhook,
        nodes: [
          {
            id: 'webhook-node',
            name: 'Webhook',
            type: 'n8n-nodes-base.webhook',
            typeVersion: 1,
            position: [250, 300],
            parameters: {}
          }
        ]
      };
      
      const mockResponse = {
        data: {
          data: workflowWithoutPath
        }
      };
      mockApi.get.mockResolvedValue(mockResponse);

      await expect(client.getWebhookUrls(1, 'webhook-node')).rejects.toThrow(
        "Webhook node 'webhook-node' does not have a path configured"
      );
    });
  });

  describe('runOnce', () => {
    const mockExecutionResponse = {
      data: {
        data: {
          id: 'exec-123',
          status: 'running'
        }
      }
    };

    it('should execute a manual workflow', async () => {
      // Mock workflow without trigger nodes
      const manualWorkflow = {
        ...mockWorkflow,
        nodes: [
          {
            id: 'start',
            name: 'Start',
            type: 'n8n-nodes-base.start',
            typeVersion: 1,
            position: [250, 300],
            parameters: {}
          }
        ]
      };

      mockApi.get.mockResolvedValue({ data: { data: manualWorkflow } });
      mockApi.post.mockResolvedValue(mockExecutionResponse);

      const result = await client.runOnce(1, { test: 'data' });

      expect(mockApi.post).toHaveBeenCalledWith('/workflows/1/execute', {
        data: { test: 'data' }
      });
      expect(result).toEqual({
        executionId: 'exec-123',
        status: 'running'
      });
    });

    it('should execute a trigger workflow', async () => {
      // Mock workflow with trigger nodes
      const triggerWorkflow = {
        ...mockWorkflow,
        nodes: [
          {
            id: 'webhook',
            name: 'Webhook',
            type: 'n8n-nodes-base.webhook',
            typeVersion: 1,
            position: [250, 300],
            parameters: {}
          }
        ]
      };

      mockApi.get.mockResolvedValue({ data: { data: triggerWorkflow } });
      mockApi.post.mockResolvedValue(mockExecutionResponse);

      const result = await client.runOnce(1);

      expect(mockApi.post).toHaveBeenCalledWith('/executions', {
        workflowData: triggerWorkflow,
        runData: {}
      });
      expect(result).toEqual({
        executionId: 'exec-123',
        status: 'running'
      });
    });

    it('should handle execution errors', async () => {
      mockApi.get.mockResolvedValue({ data: { data: mockWorkflow } });
      const error = new Error('Execution failed');
      mockApi.post.mockRejectedValue(error);

      await expect(client.runOnce(1)).rejects.toThrow('Execution failed');
    });

    it('should handle workflow not found errors', async () => {
      const error = new Error('404 - Workflow not found');
      mockApi.get.mockRejectedValue(error);

      await expect(client.runOnce(999)).rejects.toThrow(
        'Workflow 999 not found or cannot be executed manually'
      );
    });
  });
});