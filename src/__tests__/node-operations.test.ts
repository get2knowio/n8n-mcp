import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { N8nClient } from '../n8n-client';
import { N8nWorkflow, N8nNode } from '../types';

// Mock axios
const mockGet = jest.fn();
const mockPatch = jest.fn();

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: mockGet,
    patch: mockPatch,
    defaults: { headers: { common: {} } }
  }))
}));

describe('N8nClient Node Operations', () => {
  let client: N8nClient;

  const mockWorkflow: N8nWorkflow = {
    id: 1,
    name: 'Test Workflow',
    nodes: [
      {
        id: 'webhook-1',
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [250, 300],
        parameters: {
          httpMethod: 'GET',
          path: 'test'
        }
      },
      {
        id: 'set-1',
        name: 'Set',
        type: 'n8n-nodes-base.set',
        typeVersion: 3,
        position: [450, 300],
        parameters: {
          values: {
            string: [{ name: 'test', value: 'value' }]
          }
        }
      }
    ],
    connections: {
      'Webhook': {
        'main': [
          [
            {
              node: 'Set',
              type: 'main',
              index: 0
            }
          ]
        ]
      }
    },
    active: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    client = new N8nClient({
      baseUrl: 'http://test.local:5678',
      apiKey: 'test-key'
    });
  });

  describe('createNode', () => {
    it('should create a new node with generated ID and default position', async () => {
      const updatedWorkflow = { ...mockWorkflow };
      
      mockGet.mockResolvedValueOnce({ data: { data: mockWorkflow } });
      mockPatch.mockResolvedValueOnce({ data: { data: updatedWorkflow } });

      const result = await client.createNode({
        workflowId: 1,
        type: 'n8n-nodes-base.code',
        name: 'Code Node',
        params: { jsCode: 'return [{ test: "value" }];' }
      });

      expect(result.nodeId).toBeDefined();
      expect(typeof result.nodeId).toBe('string');
      expect(result.nodeId).toMatch(/^node_\d+_[a-z0-9]+$/);

      // Verify the updateWorkflow was called with the new node
      expect(mockPatch).toHaveBeenCalledWith('/workflows/1', expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({
            id: result.nodeId,
            name: 'Code Node',
            type: 'n8n-nodes-base.code',
            typeVersion: 1,
            position: [650, 300], // Should be positioned to the right of existing nodes
            parameters: { jsCode: 'return [{ test: "value" }];' }
          })
        ])
      }));
    });

    it('should create a node with custom position', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: mockWorkflow } });
      mockPatch.mockResolvedValueOnce({ data: { data: mockWorkflow } });

      const result = await client.createNode({
        workflowId: 1,
        type: 'n8n-nodes-base.webhook',
        position: [100, 200]
      });

      expect(mockPatch).toHaveBeenCalledWith('/workflows/1', expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({
            position: [100, 200]
          })
        ])
      }));
    });

    it('should create a node with default name based on type', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: mockWorkflow } });
      mockPatch.mockResolvedValueOnce({ data: { data: mockWorkflow } });

      await client.createNode({
        workflowId: 1,
        type: 'n8n-nodes-base.webhook'
      });

      expect(mockPatch).toHaveBeenCalledWith('/workflows/1', expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({
            name: 'webhook'
          })
        ])
      }));
    });
  });

  describe('updateNode', () => {
    it('should update an existing node', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: mockWorkflow } });
      mockPatch.mockResolvedValueOnce({ data: { data: mockWorkflow } });

      const result = await client.updateNode({
        workflowId: 1,
        nodeId: 'webhook-1',
        name: 'Updated Webhook',
        params: { httpMethod: 'POST', path: 'updated' },
        typeVersion: 2
      });

      expect(result.nodeId).toBe('webhook-1');
      
      expect(mockPatch).toHaveBeenCalledWith('/workflows/1', expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({
            id: 'webhook-1',
            name: 'Updated Webhook',
            typeVersion: 2,
            parameters: expect.objectContaining({
              httpMethod: 'POST',
              path: 'updated'
            })
          })
        ])
      }));
    });

    it('should throw error if node not found', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: mockWorkflow } });

      await expect(client.updateNode({
        workflowId: 1,
        nodeId: 'non-existent',
        name: 'Test'
      })).rejects.toThrow('Node with id non-existent not found in workflow 1');
    });
  });

  describe('connectNodes', () => {
    it('should connect two nodes', async () => {
      const workflowWithoutConnections = {
        ...mockWorkflow,
        connections: {}
      };

      mockGet.mockResolvedValueOnce({ data: { data: workflowWithoutConnections } });
      mockPatch.mockResolvedValueOnce({ data: { data: mockWorkflow } });

      const result = await client.connectNodes({
        workflowId: 1,
        from: { nodeId: 'webhook-1' },
        to: { nodeId: 'set-1' }
      });

      expect(result.ok).toBe(true);
      
      expect(mockPatch).toHaveBeenCalledWith('/workflows/1', expect.objectContaining({
        connections: {
          'Webhook': {
            'main': [
              [
                {
                  node: 'Set',
                  type: 'main',
                  index: 0
                }
              ]
            ]
          }
        }
      }));
    });

    it('should connect nodes with custom indices', async () => {
      const workflowWithoutConnections = {
        ...mockWorkflow,
        connections: {}
      };

      mockGet.mockResolvedValueOnce({ data: { data: workflowWithoutConnections } });
      mockPatch.mockResolvedValueOnce({ data: { data: mockWorkflow } });

      await client.connectNodes({
        workflowId: 1,
        from: { nodeId: 'webhook-1', outputIndex: 1 },
        to: { nodeId: 'set-1', inputIndex: 2 }
      });

      expect(mockPatch).toHaveBeenCalledWith('/workflows/1', expect.objectContaining({
        connections: {
          'Webhook': {
            'main': [
              undefined, // index 0 is empty
              [
                {
                  node: 'Set',
                  type: 'main',
                  index: 2
                }
              ]
            ]
          }
        }
      }));
    });

    it('should not duplicate existing connections', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: mockWorkflow } });
      mockPatch.mockResolvedValueOnce({ data: { data: mockWorkflow } });

      const result = await client.connectNodes({
        workflowId: 1,
        from: { nodeId: 'webhook-1' },
        to: { nodeId: 'set-1' }
      });

      expect(result.ok).toBe(true);
      
      // Should not add duplicate connection
      const call = mockPatch.mock.calls[0][1] as any;
      expect(call.connections['Webhook']['main'][0]).toHaveLength(1);
    });

    it('should throw error if source node not found', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: mockWorkflow } });

      await expect(client.connectNodes({
        workflowId: 1,
        from: { nodeId: 'non-existent' },
        to: { nodeId: 'set-1' }
      })).rejects.toThrow('Source node non-existent not found in workflow 1');
    });

    it('should throw error if target node not found', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: mockWorkflow } });

      await expect(client.connectNodes({
        workflowId: 1,
        from: { nodeId: 'webhook-1' },
        to: { nodeId: 'non-existent' }
      })).rejects.toThrow('Target node non-existent not found in workflow 1');
    });
  });

  describe('deleteNode', () => {
    it('should delete a node and its connections', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: mockWorkflow } });
      mockPatch.mockResolvedValueOnce({ data: { data: mockWorkflow } });

      const result = await client.deleteNode({
        workflowId: 1,
        nodeId: 'set-1'
      });

      expect(result.ok).toBe(true);
      
      expect(mockPatch).toHaveBeenCalledWith('/workflows/1', expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: 'webhook-1' })
        ])
      }));

      // Verify Set node is removed from nodes
      const updatedWorkflow = mockPatch.mock.calls[0][1] as any;
      expect(updatedWorkflow.nodes.find((n: N8nNode) => n.id === 'set-1')).toBeUndefined();
      
      // Verify connections to Set node are removed
      expect(updatedWorkflow.connections['Webhook']['main'][0]).toEqual([]);
    });

    it('should throw error if node not found', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: mockWorkflow } });

      await expect(client.deleteNode({
        workflowId: 1,
        nodeId: 'non-existent'
      })).rejects.toThrow('Node with id non-existent not found in workflow 1');
    });
  });

  describe('setNodePosition', () => {
    it('should update node position', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: mockWorkflow } });
      mockPatch.mockResolvedValueOnce({ data: { data: mockWorkflow } });

      const result = await client.setNodePosition({
        workflowId: 1,
        nodeId: 'webhook-1',
        x: 500,
        y: 400
      });

      expect(result.ok).toBe(true);
      
      expect(mockPatch).toHaveBeenCalledWith('/workflows/1', expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({
            id: 'webhook-1',
            position: [500, 400]
          })
        ])
      }));
    });

    it('should throw error if node not found', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: mockWorkflow } });

      await expect(client.setNodePosition({
        workflowId: 1,
        nodeId: 'non-existent',
        x: 100,
        y: 100
      })).rejects.toThrow('Node with id non-existent not found in workflow 1');
    });
  });
});