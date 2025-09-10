import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { N8nClient } from '../n8n-client';
import { N8nConfig, N8nWorkflow, N8nTag, N8nVariable, N8nExecution, N8nWebhookUrls, N8nCredentialSchema, N8nSourceControlPullResponse } from '../types';

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

  const mockCredentialSchema: N8nCredentialSchema = {
    type: 'httpHeaderAuth',
    displayName: 'Header Auth',
    name: 'httpHeaderAuth',
    properties: {
      name: {
        type: 'string',
        description: 'Header name'
      },
      value: {
        type: 'string',
        description: 'Header value'
      }
    },
    required: ['name', 'value'],
    description: 'Authentication via HTTP header',
    category: 'generic'
  };

  const mockVariable: N8nVariable = {
    id: 'var-123',
    key: 'test-key',
    value: 'test-value'
  };

  const mockTags: N8nTag[] = [
    {
      id: 'tag1',
      name: 'Production',
      color: '#ff0000'
    },
    {
      id: 'tag2', 
      name: 'Testing',
      color: '#00ff00'
    }
  ];

  const mockExecution: N8nExecution = {
    id: 'exec_123',
    finished: true,
    mode: 'manual',
    startedAt: '2023-01-01T00:00:00.000Z',
    stoppedAt: '2023-01-01T00:01:00.000Z',
    workflowId: '1',
    status: 'success',
    data: {
      resultData: {
        runData: {},
        lastNodeExecuted: 'webhook'
      }
    }
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
      put: jest.fn(),
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
    it('should update an existing workflow using PUT', async () => {
      const updateData = { name: 'Updated Workflow' };
      const updatedWorkflow = { ...mockWorkflow, ...updateData };
      
      const mockResponse = {
        data: {
          data: updatedWorkflow
        }
      };
      mockApi.put.mockResolvedValue(mockResponse);

      const result = await client.updateWorkflow(1, updateData);

      expect(mockApi.put).toHaveBeenCalledWith('/workflows/1', updateData, { headers: {} });
      expect(result).toEqual(updatedWorkflow);
    });

    it('should update an existing workflow with If-Match header', async () => {
      const updateData = { name: 'Updated Workflow' };
      const updatedWorkflow = { ...mockWorkflow, ...updateData };
      const ifMatch = 'some-etag-value';
      
      const mockResponse = {
        data: {
          data: updatedWorkflow
        }
      };
      mockApi.put.mockResolvedValue(mockResponse);

      const result = await client.updateWorkflow(1, updateData, ifMatch);

      expect(mockApi.put).toHaveBeenCalledWith('/workflows/1', updateData, { 
        headers: { 'If-Match': ifMatch } 
      });
      expect(result).toEqual(updatedWorkflow);
    });

    it('should handle 412 precondition failed error gracefully', async () => {
      const updateData = { name: 'Updated Workflow' };
      const ifMatch = 'outdated-etag';
      
      const error = {
        response: {
          status: 412
        }
      };
      mockApi.put.mockRejectedValue(error);

      await expect(client.updateWorkflow(1, updateData, ifMatch))
        .rejects.toThrow('Precondition failed: The workflow has been modified by another user. Please fetch the latest version and try again.');
    });

    it('should handle other update errors', async () => {
      const updateData = { name: 'Updated Workflow' };
      const error = new Error('Update failed');
      mockApi.put.mockRejectedValue(error);

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

  describe('getCredentialSchema', () => {
    it('should return credential schema by type name', async () => {
      const mockResponse = {
        data: {
          data: mockCredentialSchema
        }
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await client.getCredentialSchema('httpHeaderAuth');

      expect(mockApi.get).toHaveBeenCalledWith('/credential-types/httpHeaderAuth');
      expect(result).toEqual(mockCredentialSchema);
    });

    it('should handle credential type not found', async () => {
      const error = new Error('Credential type not found');
      mockApi.get.mockRejectedValue(error);

      await expect(client.getCredentialSchema('invalidType')).rejects.toThrow('Credential type not found');
    });

    it('should handle authentication errors', async () => {
      const error = new Error('Unauthorized');
      mockApi.get.mockRejectedValue(error);

      await expect(client.getCredentialSchema('httpHeaderAuth')).rejects.toThrow('Unauthorized');
    });
  });

  describe('transferWorkflow', () => {
    it('should transfer a workflow with projectId', async () => {
      const transferData = { projectId: 'project-123' };
      const transferResponse = { id: 1, projectId: 'project-123' };
      const mockResponse = {
        data: {
          data: transferResponse
        }
      };
      mockApi.put.mockResolvedValue(mockResponse);

      const result = await client.transferWorkflow(1, transferData);

      expect(mockApi.put).toHaveBeenCalledWith('/workflows/1/transfer', transferData);
      expect(result).toEqual(transferResponse);
    });

    it('should transfer a workflow with newOwnerId', async () => {
      const transferData = { newOwnerId: 'user-456' };
      const transferResponse = { id: 1, newOwnerId: 'user-456' };
      const mockResponse = {
        data: {
          data: transferResponse
        }
      };
      mockApi.put.mockResolvedValue(mockResponse);

      const result = await client.transferWorkflow(1, transferData);

      expect(mockApi.put).toHaveBeenCalledWith('/workflows/1/transfer', transferData);
      expect(result).toEqual(transferResponse);
    });

    it('should transfer a workflow with both projectId and newOwnerId', async () => {
      const transferData = { projectId: 'project-123', newOwnerId: 'user-456' };
      const transferResponse = { id: 1, projectId: 'project-123', newOwnerId: 'user-456' };
      const mockResponse = {
        data: {
          data: transferResponse
        }
      };
      mockApi.put.mockResolvedValue(mockResponse);

      const result = await client.transferWorkflow(1, transferData);

      expect(mockApi.put).toHaveBeenCalledWith('/workflows/1/transfer', transferData);
      expect(result).toEqual(transferResponse);
    });

    it('should handle transfer errors', async () => {
      const transferData = { projectId: 'project-123' };
      const error = new Error('Transfer failed');
      mockApi.put.mockRejectedValue(error);

      await expect(client.transferWorkflow(1, transferData)).rejects.toThrow('Transfer failed');
    });

    it('should handle permission errors with clear message', async () => {
      const transferData = { projectId: 'project-123' };
      const error = new Error('Permission denied');
      mockApi.put.mockRejectedValue(error);

      await expect(client.transferWorkflow(1, transferData)).rejects.toThrow('Permission denied');
    });
  });

  describe('transferCredential', () => {
    it('should transfer a credential with projectId', async () => {
      const transferData = { projectId: 'project-123' };
      const transferResponse = { id: 1, projectId: 'project-123' };
      const mockResponse = {
        data: {
          data: transferResponse
        }
      };
      mockApi.put.mockResolvedValue(mockResponse);

      const result = await client.transferCredential(1, transferData);

      expect(mockApi.put).toHaveBeenCalledWith('/credentials/1/transfer', transferData);
      expect(result).toEqual(transferResponse);
    });

    it('should transfer a credential with newOwnerId', async () => {
      const transferData = { newOwnerId: 'user-456' };
      const transferResponse = { id: 1, newOwnerId: 'user-456' };
      const mockResponse = {
        data: {
          data: transferResponse
        }
      };
      mockApi.put.mockResolvedValue(mockResponse);

      const result = await client.transferCredential(1, transferData);

      expect(mockApi.put).toHaveBeenCalledWith('/credentials/1/transfer', transferData);
      expect(result).toEqual(transferResponse);
    });

    it('should transfer a credential with both projectId and newOwnerId', async () => {
      const transferData = { projectId: 'project-123', newOwnerId: 'user-456' };
      const transferResponse = { id: 1, projectId: 'project-123', newOwnerId: 'user-456' };
      const mockResponse = {
        data: {
          data: transferResponse
        }
      };
      mockApi.put.mockResolvedValue(mockResponse);

      const result = await client.transferCredential(1, transferData);

      expect(mockApi.put).toHaveBeenCalledWith('/credentials/1/transfer', transferData);
      expect(result).toEqual(transferResponse);
    });

    it('should handle transfer errors', async () => {
      const transferData = { projectId: 'project-123' };
      const error = new Error('Transfer failed');
      mockApi.put.mockRejectedValue(error);

      await expect(client.transferCredential(1, transferData)).rejects.toThrow('Transfer failed');
    });

    it('should handle permission errors with clear message', async () => {
      const transferData = { projectId: 'project-123' };
      const error = new Error('Permission denied');
      mockApi.put.mockRejectedValue(error);

      await expect(client.transferCredential(1, transferData)).rejects.toThrow('Permission denied');
    });
  });

  describe('listVariables', () => {
    it('should return list of variables', async () => {
      const mockResponse = {
        data: {
          data: [mockVariable],
          nextCursor: undefined
        }
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await client.listVariables();

      expect(mockApi.get).toHaveBeenCalledWith('/variables');
      expect(result).toEqual({
        data: [mockVariable],
        nextCursor: undefined
      });
    });

    it('should handle pagination', async () => {
      const mockResponse = {
        data: {
          data: [mockVariable],
          nextCursor: 'next-cursor-123'
        }
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await client.listVariables();

      expect(result.nextCursor).toBe('next-cursor-123');
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      mockApi.get.mockRejectedValue(error);

      await expect(client.listVariables()).rejects.toThrow('API Error');
    });
  });

  describe('listExecutions', () => {
    it('should return list of executions without options', async () => {
      const mockResponse = {
        data: {
          data: [mockExecution]
        }
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await client.listExecutions();

      expect(mockApi.get).toHaveBeenCalledWith('/executions');
      expect(result).toEqual({ data: [mockExecution] });
    });

    it('should return list of executions with options', async () => {
      const mockResponse = {
        data: {
          data: [mockExecution],
          nextCursor: 'next_cursor_123'
        }
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await client.listExecutions({ 
        limit: 10, 
        cursor: 'cursor_123',
        workflowId: '1'
      });

      expect(mockApi.get).toHaveBeenCalledWith('/executions?limit=10&cursor=cursor_123&workflowId=1');
      expect(result).toEqual({ data: [mockExecution], nextCursor: 'next_cursor_123' });
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      mockApi.get.mockRejectedValue(error);

      await expect(client.listExecutions()).rejects.toThrow('API Error');
    });
  });

  describe('createVariable', () => {
    it('should create a new variable', async () => {
      const newVariable = { key: 'new-key', value: 'new-value' };
      const mockResponse = {
        data: {
          data: { ...newVariable, id: 'var-456' }
        }
      };
      mockApi.post.mockResolvedValue(mockResponse);

      const result = await client.createVariable(newVariable);

      expect(mockApi.post).toHaveBeenCalledWith('/variables', newVariable);
      expect(result).toEqual({ ...newVariable, id: 'var-456' });
    });

    it('should handle duplicate key errors', async () => {
      const newVariable = { key: 'existing-key', value: 'new-value' };
      const error = new Error('Variable with key already exists');
      mockApi.post.mockRejectedValue(error);

      await expect(client.createVariable(newVariable)).rejects.toThrow('Variable with key already exists');
    });
  });

  describe('updateVariable', () => {
    it('should update an existing variable', async () => {
      const updateData = { value: 'updated-value' };
      const updatedVariable = { ...mockVariable, ...updateData };
      
      const mockResponse = {
        data: {
          data: updatedVariable
        }
      };
      mockApi.put.mockResolvedValue(mockResponse);

      const result = await client.updateVariable('var-123', updateData);

      expect(mockApi.put).toHaveBeenCalledWith('/variables/var-123', updateData);
      expect(result).toEqual(updatedVariable);
    });

    it('should handle update errors', async () => {
      const updateData = { value: 'updated-value' };
      const error = new Error('Variable not found');
      mockApi.put.mockRejectedValue(error);

      await expect(client.updateVariable('var-999', updateData)).rejects.toThrow('Variable not found');
    });
  });

  describe('deleteVariable', () => {
    it('should delete a variable', async () => {
      mockApi.delete.mockResolvedValue({});

      const result = await client.deleteVariable('var-123');

      expect(mockApi.delete).toHaveBeenCalledWith('/variables/var-123');
      expect(result).toEqual({ ok: true });
    });

    it('should handle deletion errors', async () => {
      const error = new Error('Variable not found');
      mockApi.delete.mockRejectedValue(error);

      await expect(client.deleteVariable('var-999')).rejects.toThrow('Variable not found');
    });
  });

  describe('getExecution', () => {
    it('should return specific execution by ID', async () => {
      const mockResponse = {
        data: {
          data: mockExecution
        }
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await client.getExecution('exec_123');

      expect(mockApi.get).toHaveBeenCalledWith('/executions/exec_123');
      expect(result).toEqual(mockExecution);
    });

    it('should handle execution not found', async () => {
      const error = new Error('Execution not found');
      mockApi.get.mockRejectedValue(error);

      await expect(client.getExecution('nonexistent')).rejects.toThrow('Execution not found');
    });
  });

  describe('deleteExecution', () => {
    it('should delete an execution', async () => {
      mockApi.delete.mockResolvedValue({});

      const result = await client.deleteExecution('exec_123');

      expect(mockApi.delete).toHaveBeenCalledWith('/executions/exec_123');
      expect(result).toEqual({ success: true });
    });

    it('should handle deletion errors', async () => {
      const error = new Error('Deletion failed');
      mockApi.delete.mockRejectedValue(error);

      await expect(client.deleteExecution('exec_123')).rejects.toThrow('Deletion failed');
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

  describe('Tags API', () => {
    const mockTag: N8nTag = {
      id: 1,
      name: 'Production',
      color: '#ff0000',
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
    };

    describe('listTags', () => {
      it('should list tags without pagination', async () => {
        const mockResponse = {
          data: [mockTag],
        };

        mockApi.get.mockResolvedValue({ data: mockResponse });

        const result = await client.listTags();

        expect(mockApi.get).toHaveBeenCalledWith('/tags');
        expect(result).toEqual(mockResponse);
      });

      it('should list tags with pagination parameters', async () => {
        const mockResponse = {
          data: [mockTag],
          nextCursor: 'next_page',
        };

        mockApi.get.mockResolvedValue({ data: mockResponse });

        const result = await client.listTags(10, 'current_cursor');

        expect(mockApi.get).toHaveBeenCalledWith('/tags?limit=10&cursor=current_cursor');
        expect(result).toEqual(mockResponse);
      });
    });

    describe('getTag', () => {
      it('should get a tag by ID', async () => {
        const mockResponse = {
          data: { data: mockTag },
        };

        mockApi.get.mockResolvedValue(mockResponse);

        const result = await client.getTag(1);

        expect(mockApi.get).toHaveBeenCalledWith('/tags/1');
        expect(result).toEqual(mockTag);
      });
    });

    describe('createTag', () => {
      it('should create a new tag', async () => {
        const newTag = { name: 'Development', color: '#00ff00' };
        const mockResponse = {
          data: { data: { ...mockTag, ...newTag, id: 2 } },
        };

        mockApi.post.mockResolvedValue(mockResponse);

        const result = await client.createTag(newTag);

        expect(mockApi.post).toHaveBeenCalledWith('/tags', newTag);
        expect(result).toEqual({ ...mockTag, ...newTag, id: 2 });
      });
    });

    describe('updateTag', () => {
      it('should update a tag', async () => {
        const updateData = { name: 'Updated Production', color: '#ff00ff' };
        const mockResponse = {
          data: { data: { ...mockTag, ...updateData } },
        };

        mockApi.put.mockResolvedValue(mockResponse);

        const result = await client.updateTag(1, updateData);

        expect(mockApi.put).toHaveBeenCalledWith('/tags/1', updateData);
        expect(result).toEqual({ ...mockTag, ...updateData });
      });
    });

    describe('deleteTag', () => {
      it('should delete a tag', async () => {
        mockApi.delete.mockResolvedValue({});

        await client.deleteTag(1);

        expect(mockApi.delete).toHaveBeenCalledWith('/tags/1');
      });
    });
  });

  describe('Workflow Tags', () => {
    describe('listWorkflowTags', () => {
      it('should return list of workflow tags', async () => {
        const mockResponse = {
          data: {
            data: mockTags
          }
        };
        mockApi.get.mockResolvedValue(mockResponse);

        const result = await client.listWorkflowTags(1);

        expect(mockApi.get).toHaveBeenCalledWith('/workflows/1/tags');
        expect(result).toEqual(mockTags);
      });
    });

    describe('setWorkflowTags', () => {
      it('should set workflow tags', async () => {
        const tagIds = ['tag1', 'tag2'];
        const mockResponse = {
          data: {
            data: mockTags
          }
        };
        mockApi.put.mockResolvedValue(mockResponse);

        const result = await client.setWorkflowTags(1, tagIds);

        expect(mockApi.put).toHaveBeenCalledWith('/workflows/1/tags', { tagIds });
        expect(result).toEqual(mockTags);
      });
    });
  });

    // Source Control Pull tests
    describe('sourceControlPull', () => {
      it('should pull changes from source control', async () => {
        const mockPullResponse: N8nSourceControlPullResponse = {
          ok: true,
          commit: 'abc123def456'
        };
        const mockResponse = {
          data: {
            data: mockPullResponse
          }
        };
        mockApi.post.mockResolvedValue(mockResponse);

        const result = await client.sourceControlPull();

        expect(mockApi.post).toHaveBeenCalledWith('/source-control/pull');
        expect(result).toEqual(mockPullResponse);
      });

      it('should handle source control pull without commit hash', async () => {
        const mockPullResponse: N8nSourceControlPullResponse = {
          ok: true
        };
        const mockResponse = {
          data: {
            data: mockPullResponse
          }
        };
        mockApi.post.mockResolvedValue(mockResponse);

        const result = await client.sourceControlPull();

        expect(mockApi.post).toHaveBeenCalledWith('/source-control/pull');
        expect(result).toEqual(mockPullResponse);
        expect(result.ok).toBe(true);
        expect(result.commit).toBeUndefined();
      });

      it('should handle source control pull errors', async () => {
        const error = new Error('Source control pull failed');
        mockApi.post.mockRejectedValue(error);

        await expect(client.sourceControlPull()).rejects.toThrow('Source control pull failed');
      });
    });
});