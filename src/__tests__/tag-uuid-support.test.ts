import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { N8nClient } from '../n8n-client';
import { N8nConfig, N8nTag } from '../types';

// Mock axios
jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('N8nClient UUID Support', () => {
  let client: N8nClient;
  let mockApi: any;
  let mockRequest: jest.Mock;

  const mockConfig: N8nConfig = {
    baseUrl: 'http://test-n8n.local:5678',
    apiKey: 'test-api-key',
  };

  const mockTag: N8nTag = {
    id: 'tag-uuid-123',
    name: 'Production',
    color: '#ff0000',
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
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    };

    mockRequest = jest.fn(() => Promise.resolve({ status: 200, data: {} }));
    mockedAxios.create = jest.fn(() => mockApi as any) as any;
    (mockedAxios as any).request = mockRequest;

    client = new N8nClient(mockConfig);
  });

  describe('Tag operations with UUID support', () => {
    it('should accept string UUID for tag ID in updateTag', async () => {
      const updateData = { color: '#00ff00' };
      const mockResponse = {
        data: { data: { ...mockTag, ...updateData } },
      };

      // Ensure REST endpoint fails
      mockRequest.mockImplementation(() => Promise.reject({
        response: { status: 404 }
      }));

      mockApi.put.mockResolvedValue(mockResponse);

      const result = await client.updateTag('tag-uuid-123', updateData);

      expect(mockApi.put).toHaveBeenCalledWith('/tags/tag-uuid-123', updateData);
      expect(result.id).toBe('tag-uuid-123');
    });

    it('should accept numeric ID for tag in updateTag', async () => {
      const updateData = { color: '#00ff00' };
      const numericTag = { ...mockTag, id: 123 };
      const mockResponse = {
        data: { data: { ...numericTag, ...updateData } },
      };

      mockRequest.mockImplementation(() => Promise.reject({
        response: { status: 404 }
      }));

      mockApi.put.mockResolvedValue(mockResponse);

      const result = await client.updateTag(123, updateData);

      expect(mockApi.put).toHaveBeenCalledWith('/tags/123', updateData);
      expect(result.id).toBe(123);
    });

    it('should accept string UUID for workflow ID in setWorkflowTags', async () => {
      const tagIds = ['tag-uuid-1', 'tag-uuid-2'];
      const mockResponse = {
        data: { data: [mockTag] },
      };

      // Mock listTags to return empty
      mockApi.get.mockResolvedValue({ data: { data: [] } });

      // Mock REST endpoints to fail
      mockRequest.mockImplementation(() => Promise.reject({
        response: { status: 405 }
      }));

      // Mock API v1 to succeed
      mockApi.put.mockResolvedValue(mockResponse);

      const result = await client.setWorkflowTags('workflow-uuid-456', tagIds);

      expect(mockApi.put).toHaveBeenCalledWith(
        '/workflows/workflow-uuid-456/tags',
        { tagIds }
      );
      expect(result).toEqual([mockTag]);
    });

    it('should accept numeric workflow ID in setWorkflowTags', async () => {
      const tagIds = [1, 2];
      const mockResponse = {
        data: { data: [mockTag] },
      };

      mockApi.get.mockResolvedValue({ data: { data: [] } });
      mockRequest.mockImplementation(() => Promise.reject({
        response: { status: 405 }
      }));
      mockApi.put.mockResolvedValue(mockResponse);

      const result = await client.setWorkflowTags(123, tagIds);

      expect(mockApi.put).toHaveBeenCalledWith('/workflows/123/tags', { tagIds });
      expect(result).toEqual([mockTag]);
    });

    it('should accept mixed string and number tag IDs', async () => {
      const tagIds: (string | number)[] = ['tag-uuid-1', 2, 'tag-uuid-3'];
      const mockResponse = {
        data: { data: [mockTag] },
      };

      mockApi.get.mockResolvedValue({ data: { data: [] } });
      mockRequest.mockImplementation(() => Promise.reject({
        response: { status: 405 }
      }));
      mockApi.put.mockResolvedValue(mockResponse);

      const result = await client.setWorkflowTags('workflow-uuid', tagIds);

      expect(mockApi.put).toHaveBeenCalledWith(
        '/workflows/workflow-uuid/tags',
        { tagIds }
      );
    });
  });

  describe('Tag fallback to /rest endpoint', () => {
    it('should use /rest endpoint when available for updateTag', async () => {
      const updateData = { color: '#00ff00' };
      const updatedTag = { ...mockTag, ...updateData };

      mockRequest.mockImplementation(() => Promise.resolve({
        status: 200,
        data: updatedTag,
      }));

      const result = await client.updateTag('tag-uuid-123', updateData);

      expect(mockRequest).toHaveBeenCalledWith({
        method: 'PATCH',
        url: 'http://test-n8n.local:5678/rest/tags/tag-uuid-123',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': 'test-api-key',
        }),
        data: updateData,
      });
      expect(result).toEqual(updatedTag);
    });

    it('should provide helpful error for updateTag color failures', async () => {
      const updateData = { color: '#00ff00' };

      // Mock /rest to fail
      mockRequest.mockImplementation(() => Promise.reject({
        response: { status: 405, data: { message: 'Method not allowed' } },
      }));

      // Mock /api/v1 to also fail
      mockApi.put.mockRejectedValue({
        response: { status: 400, data: { message: 'Color not supported' } },
      });

      try {
        await client.updateTag('tag-uuid-123', updateData);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Unable to update tag color');
        expect(error.message).toContain('PATCH');
        expect(error.message).toContain('PUT');
      }
    });
  });

  describe('Workflow tags with /rest fallback', () => {
    it('should try /rest with tag names when available', async () => {
      const tagIds = ['tag-uuid-1', 'tag-uuid-2'];

      // Mock listTags to return tags with names
      mockApi.get.mockResolvedValueOnce({
        data: {
          data: [
            { id: 'tag-uuid-1', name: 'prod' },
            { id: 'tag-uuid-2', name: 'api' },
          ],
        },
      });

      // Mock PATCH /rest with names to succeed
      mockRequest.mockImplementationOnce(() => Promise.resolve({
        status: 200,
        data: { tags: ['prod', 'api'] },
      }));

      // Mock listWorkflowTags
      mockApi.get.mockResolvedValueOnce({
        data: { data: [mockTag] },
      });

      const result = await client.setWorkflowTags('workflow-uuid', tagIds);

      expect(mockRequest).toHaveBeenCalledWith({
        method: 'PATCH',
        url: 'http://test-n8n.local:5678/rest/workflows/workflow-uuid',
        headers: expect.any(Object),
        data: { tags: ['prod', 'api'] },
      });
      expect(result).toEqual([mockTag]);
    });

    it('should provide detailed error when all endpoints fail', async () => {
      const tagIds = ['tag-uuid-1'];

      // Mock listTags
      mockApi.get.mockResolvedValueOnce({
        data: { data: [{ id: 'tag-uuid-1', name: 'prod' }] },
      });

      // Mock all /rest endpoints to fail
      mockRequest.mockImplementation(() => Promise.reject({
        response: { status: 405, data: { message: 'Not allowed' } },
      }));

      // Mock /api/v1 to also fail
      mockApi.put.mockRejectedValue({
        response: { status: 400, data: { message: 'Bad request' } },
      });

      try {
        await client.setWorkflowTags('workflow-uuid', tagIds);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Unable to set workflow tags');
        expect(error.message).toContain('405');
        expect(error.message).toContain('400');
      }
    });
  });

  describe('List tags with /rest fallback', () => {
    it('should fall back to /rest/tags when /api/v1 returns 404', async () => {
      // Mock /api/v1 to fail with 404
      mockApi.get.mockRejectedValue({
        response: { status: 404 },
      });

      // Mock /rest to succeed
      mockRequest.mockImplementation(() => Promise.resolve({
        status: 200,
        data: { data: [mockTag] },
      }));

      const result = await client.listTags();

      expect(mockRequest).toHaveBeenCalledWith({
        method: 'GET',
        url: 'http://test-n8n.local:5678/rest/tags',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        data: undefined,
      });
      expect(result).toEqual({ data: [mockTag] });
    });

    it('should normalize array response from /rest endpoint', async () => {
      mockApi.get.mockRejectedValue({
        response: { status: 404 },
      });

      // Mock /rest to return array directly
      mockRequest.mockImplementation(() => Promise.resolve({
        status: 200,
        data: [mockTag],
      }));

      const result = await client.listTags();

      expect(result).toEqual({ data: [mockTag], nextCursor: undefined });
    });
  });
});
