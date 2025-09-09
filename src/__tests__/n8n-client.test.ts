import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { N8nClient } from '../n8n-client';
import { N8nConfig, N8nWorkflow, N8nTag } from '../types';

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

  const mockTag: N8nTag = {
    id: 1,
    name: 'Test Tag',
    color: '#ff0000',
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z'
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
      put: jest.fn(),
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

  describe('listTags', () => {
    it('should return list of tags', async () => {
      const mockResponse = {
        data: {
          data: [mockTag],
          nextCursor: undefined
        }
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await client.listTags();

      expect(mockApi.get).toHaveBeenCalledWith('/tags');
      expect(result).toEqual({
        data: [mockTag],
        nextCursor: undefined
      });
    });

    it('should handle pagination parameters', async () => {
      const mockResponse = {
        data: {
          data: [mockTag],
          nextCursor: 'next-cursor'
        }
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await client.listTags(10, 'cursor-123');

      expect(mockApi.get).toHaveBeenCalledWith('/tags?limit=10&cursor=cursor-123');
      expect(result).toEqual({
        data: [mockTag],
        nextCursor: 'next-cursor'
      });
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      mockApi.get.mockRejectedValue(error);

      await expect(client.listTags()).rejects.toThrow('API Error');
    });
  });

  describe('getTag', () => {
    it('should return specific tag by ID', async () => {
      const mockResponse = {
        data: {
          data: mockTag
        }
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await client.getTag(1);

      expect(mockApi.get).toHaveBeenCalledWith('/tags/1');
      expect(result).toEqual(mockTag);
    });

    it('should handle tag not found', async () => {
      const error = new Error('Tag not found');
      mockApi.get.mockRejectedValue(error);

      await expect(client.getTag(999)).rejects.toThrow('Tag not found');
    });
  });

  describe('createTag', () => {
    it('should create a new tag', async () => {
      const newTag = { name: 'New Tag', color: '#00ff00' };
      const mockResponse = {
        data: {
          data: { ...mockTag, ...newTag }
        }
      };
      mockApi.post.mockResolvedValue(mockResponse);

      const result = await client.createTag(newTag);

      expect(mockApi.post).toHaveBeenCalledWith('/tags', newTag);
      expect(result).toEqual({ ...mockTag, ...newTag });
    });

    it('should create tag without color', async () => {
      const newTag = { name: 'No Color Tag' };
      const mockResponse = {
        data: {
          data: { ...mockTag, ...newTag, color: undefined }
        }
      };
      mockApi.post.mockResolvedValue(mockResponse);

      const result = await client.createTag(newTag);

      expect(mockApi.post).toHaveBeenCalledWith('/tags', newTag);
      expect(result).toEqual({ ...mockTag, ...newTag, color: undefined });
    });

    it('should handle creation errors', async () => {
      const newTag = { name: 'Duplicate Tag' };
      const error = new Error('Tag name already exists');
      mockApi.post.mockRejectedValue(error);

      await expect(client.createTag(newTag)).rejects.toThrow('Tag name already exists');
    });
  });

  describe('updateTag', () => {
    it('should update an existing tag', async () => {
      const updateData = { name: 'Updated Tag' };
      const updatedTag = { ...mockTag, ...updateData };
      
      const mockResponse = {
        data: {
          data: updatedTag
        }
      };
      mockApi.put.mockResolvedValue(mockResponse);

      const result = await client.updateTag(1, updateData);

      expect(mockApi.put).toHaveBeenCalledWith('/tags/1', updateData);
      expect(result).toEqual(updatedTag);
    });

    it('should update tag color only', async () => {
      const updateData = { color: '#0000ff' };
      const updatedTag = { ...mockTag, ...updateData };
      
      const mockResponse = {
        data: {
          data: updatedTag
        }
      };
      mockApi.put.mockResolvedValue(mockResponse);

      const result = await client.updateTag(1, updateData);

      expect(mockApi.put).toHaveBeenCalledWith('/tags/1', updateData);
      expect(result).toEqual(updatedTag);
    });

    it('should handle update errors', async () => {
      const updateData = { name: 'Updated Tag' };
      const error = new Error('Update failed');
      mockApi.put.mockRejectedValue(error);

      await expect(client.updateTag(1, updateData)).rejects.toThrow('Update failed');
    });
  });

  describe('deleteTag', () => {
    it('should delete a tag', async () => {
      mockApi.delete.mockResolvedValue({});

      await client.deleteTag(1);

      expect(mockApi.delete).toHaveBeenCalledWith('/tags/1');
    });

    it('should handle deletion errors', async () => {
      const error = new Error('Deletion failed');
      mockApi.delete.mockRejectedValue(error);

      await expect(client.deleteTag(1)).rejects.toThrow('Deletion failed');
    });
  });
});