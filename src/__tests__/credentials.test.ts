import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { N8nClient } from '../n8n-client';
import { N8nConfig, N8nCredential, N8nWorkflow } from '../types';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('N8nClient - Credentials', () => {
  let client: N8nClient;
  let mockApi: any;

  const mockConfig: N8nConfig = {
    baseUrl: 'http://test-n8n.local:5678',
    apiKey: 'test-api-key',
  };

  const mockCredentials: N8nCredential[] = [
    {
      id: 1,
      name: 'test-credential',
      type: 'httpBasicAuth',
    },
    {
      id: 2,
      name: 'another-credential',
      type: 'httpHeaderAuth',
    },
    {
      id: 3,
      name: 'duplicate-name',
      type: 'httpBasicAuth',
    },
    {
      id: 4,
      name: 'duplicate-name',
      type: 'httpHeaderAuth',
    }
  ];

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

  describe('listCredentials', () => {
    it('should return list of credentials', async () => {
      const mockResponse = {
        data: {
          data: mockCredentials
        }
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await client.listCredentials();

      expect(mockApi.get).toHaveBeenCalledWith('/credentials');
      expect(result).toEqual(mockCredentials);
    });

    it('should handle API errors', async () => {
      const error = new Error('Credentials API Error');
      mockApi.get.mockRejectedValue(error);

      await expect(client.listCredentials()).rejects.toThrow('Credentials API Error');
    });
  });

  describe('resolveCredentialAlias', () => {
    beforeEach(() => {
      const mockResponse = {
        data: {
          data: mockCredentials
        }
      };
      mockApi.get.mockResolvedValue(mockResponse);
    });

    it('should resolve a unique credential alias to its ID', async () => {
      const result = await client.resolveCredentialAlias('test-credential');
      expect(result).toBe('1');
    });

    it('should resolve another unique credential alias to its ID', async () => {
      const result = await client.resolveCredentialAlias('another-credential');
      expect(result).toBe('2');
    });

    it('should throw error when no credential matches the alias', async () => {
      await expect(client.resolveCredentialAlias('nonexistent-credential'))
        .rejects.toThrow('No credential found with alias: nonexistent-credential');
    });

    it('should throw error when multiple credentials match the alias', async () => {
      await expect(client.resolveCredentialAlias('duplicate-name'))
        .rejects.toThrow('Multiple credentials found with alias: duplicate-name. Found 2 matches.');
    });
  });

  describe('resolveCredentialsInWorkflow', () => {
    beforeEach(() => {
      const mockResponse = {
        data: {
          data: mockCredentials
        }
      };
      mockApi.get.mockResolvedValue(mockResponse);
    });

    it('should resolve credential aliases in workflow nodes', async () => {
      const workflow: Omit<N8nWorkflow, 'id'> = {
        name: 'Test Workflow',
        nodes: [
          {
            id: 'node1',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [250, 300],
            credentials: {
              httpBasicAuth: 'test-credential',
              httpHeaderAuth: 'another-credential'
            }
          }
        ],
        connections: {}
      };

      await client.resolveCredentialsInWorkflow(workflow);

      expect(workflow.nodes[0].credentials).toEqual({
        httpBasicAuth: '1',
        httpHeaderAuth: '2'
      });
    });

    it('should leave numeric credential IDs unchanged', async () => {
      const workflow: Omit<N8nWorkflow, 'id'> = {
        name: 'Test Workflow',
        nodes: [
          {
            id: 'node1',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [250, 300],
            credentials: {
              httpBasicAuth: '123',
              httpHeaderAuth: 'test-credential'
            }
          }
        ],
        connections: {}
      };

      await client.resolveCredentialsInWorkflow(workflow);

      expect(workflow.nodes[0].credentials).toEqual({
        httpBasicAuth: '123', // unchanged
        httpHeaderAuth: '1'   // resolved
      });
    });

    it('should handle workflow without nodes', async () => {
      const workflow: Omit<N8nWorkflow, 'id'> = {
        name: 'Empty Workflow',
        nodes: [],
        connections: {}
      };

      await expect(client.resolveCredentialsInWorkflow(workflow)).resolves.not.toThrow();
    });

    it('should handle workflow with nodes without credentials', async () => {
      const workflow: Omit<N8nWorkflow, 'id'> = {
        name: 'Simple Workflow',
        nodes: [
          {
            id: 'node1',
            name: 'Manual Trigger',
            type: 'n8n-nodes-base.manualTrigger',
            typeVersion: 1,
            position: [250, 300]
          }
        ],
        connections: {}
      };

      await expect(client.resolveCredentialsInWorkflow(workflow)).resolves.not.toThrow();
    });

    it('should throw detailed error when credential alias resolution fails', async () => {
      const workflow: Omit<N8nWorkflow, 'id'> = {
        name: 'Test Workflow',
        nodes: [
          {
            id: 'node1',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [250, 300],
            credentials: {
              httpBasicAuth: 'nonexistent-credential'
            }
          }
        ],
        connections: {}
      };

      await expect(client.resolveCredentialsInWorkflow(workflow))
        .rejects.toThrow("Failed to resolve credential alias 'nonexistent-credential' for node 'HTTP Request': No credential found with alias: nonexistent-credential");
    });
  });

  describe('createWorkflow with credential resolution', () => {
    beforeEach(() => {
      const mockCredentialsResponse = {
        data: {
          data: mockCredentials
        }
      };
      mockApi.get.mockResolvedValue(mockCredentialsResponse);
    });

    it('should resolve credential aliases before creating workflow', async () => {
      const workflow: Omit<N8nWorkflow, 'id'> = {
        name: 'Test Workflow',
        nodes: [
          {
            id: 'node1',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [250, 300],
            credentials: {
              httpBasicAuth: 'test-credential'
            }
          }
        ],
        connections: {}
      };

      const mockCreateResponse = {
        data: {
          data: { ...workflow, id: 1 }
        }
      };
      mockApi.post.mockResolvedValue(mockCreateResponse);

      const result = await client.createWorkflow(workflow);

      // Verify that credentials were resolved before the API call
      expect(mockApi.post).toHaveBeenCalledWith('/workflows', expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({
            credentials: {
              httpBasicAuth: '1'
            }
          })
        ])
      }));
      expect(result.id).toBe(1);
    });
  });

  describe('updateWorkflow with credential resolution', () => {
    beforeEach(() => {
      const mockCredentialsResponse = {
        data: {
          data: mockCredentials
        }
      };
      mockApi.get.mockResolvedValue(mockCredentialsResponse);
    });

    it('should resolve credential aliases before updating workflow', async () => {
      const updateData = {
        nodes: [
          {
            id: 'node1',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [250, 300] as [number, number],
            credentials: {
              httpBasicAuth: 'test-credential'
            }
          }
        ]
      };

      const mockUpdateResponse = {
        data: {
          data: { ...updateData, id: 1 }
        }
      };
      mockApi.put.mockResolvedValue(mockUpdateResponse);

      const result = await client.updateWorkflow(1, updateData);

      // Verify that credentials were resolved before the API call
      expect(mockApi.put).toHaveBeenCalledWith('/workflows/1', expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({
            credentials: {
              httpBasicAuth: '1'
            }
          })
        ])
      }), { headers: {} });
      expect(result.id).toBe(1);
    });
  });
});