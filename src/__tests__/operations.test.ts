import { describe, it, expect } from '@jest/globals';
import { WorkflowOperationsProcessor } from '../operations';
import { 
  N8nWorkflow, 
  N8nNode, 
  PatchOperation,
  AddNodeOperation,
  DeleteNodeOperation,
  UpdateNodeOperation,
  SetParamOperation,
  UnsetParamOperation,
  ConnectOperation,
  DisconnectOperation,
  SetWorkflowPropertyOperation,
  AddTagOperation,
  RemoveTagOperation
} from '../types';

describe('WorkflowOperationsProcessor', () => {
  let processor: WorkflowOperationsProcessor;
  let sampleWorkflow: N8nWorkflow;

  beforeEach(() => {
    processor = new WorkflowOperationsProcessor();
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
        },
        {
          id: 'set-1',
          name: 'Set',
          type: 'n8n-nodes-base.set',
          typeVersion: 1,
          position: [300, 100],
          parameters: {
            values: {
              string: [
                { name: 'message', value: 'hello' }
              ]
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
      active: false,
      tags: ['test']
    };
  });

  describe('addNode operation', () => {
    it('should add a new node successfully', async () => {
      const operation: AddNodeOperation = {
        type: 'addNode',
        node: {
          id: 'http-1',
          name: 'HTTP Request',
          type: 'n8n-nodes-base.httpRequest',
          typeVersion: 1,
          position: [500, 100],
          parameters: {
            url: 'https://api.example.com',
            method: 'GET'
          }
        }
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(true);
      expect(result.workflow?.nodes).toHaveLength(3);
      expect(result.workflow?.nodes[2]).toEqual(operation.node);
    });

    it('should fail when node ID already exists', async () => {
      const operation: AddNodeOperation = {
        type: 'addNode',
        node: {
          id: 'webhook-1', // This ID already exists
          name: 'Another Webhook',
          type: 'n8n-nodes-base.webhook',
          typeVersion: 1,
          position: [200, 200]
        }
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].error).toContain('already exists');
    });
  });

  describe('deleteNode operation', () => {
    it('should delete a node and its connections successfully', async () => {
      const operation: DeleteNodeOperation = {
        type: 'deleteNode',
        nodeId: 'set-1'
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(true);
      expect(result.workflow?.nodes).toHaveLength(1);
      expect(result.workflow?.nodes[0].id).toBe('webhook-1');
      // Connections should be cleaned up too
      expect(result.workflow?.connections['Webhook']).toBeUndefined();
    });

    it('should fail when node does not exist', async () => {
      const operation: DeleteNodeOperation = {
        type: 'deleteNode',
        nodeId: 'non-existent'
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].error).toContain('not found');
    });
  });

  describe('updateNode operation', () => {
    it('should update node properties successfully', async () => {
      const operation: UpdateNodeOperation = {
        type: 'updateNode',
        nodeId: 'webhook-1',
        updates: {
          name: 'Updated Webhook',
          position: [150, 150],
          parameters: {
            httpMethod: 'POST',
            path: 'updated'
          }
        }
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(true);
      const updatedNode = result.workflow?.nodes.find(n => n.id === 'webhook-1');
      expect(updatedNode?.name).toBe('Updated Webhook');
      expect(updatedNode?.position).toEqual([150, 150]);
      expect(updatedNode?.parameters?.httpMethod).toBe('POST');
    });

    it('should fail when node does not exist', async () => {
      const operation: UpdateNodeOperation = {
        type: 'updateNode',
        nodeId: 'non-existent',
        updates: { name: 'New Name' }
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].error).toContain('not found');
    });
  });

  describe('setParam operation', () => {
    it('should set a simple parameter successfully', async () => {
      const operation: SetParamOperation = {
        type: 'setParam',
        nodeId: 'webhook-1',
        paramPath: 'httpMethod',
        value: 'POST'
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(true);
      const node = result.workflow?.nodes.find(n => n.id === 'webhook-1');
      expect(node?.parameters?.httpMethod).toBe('POST');
    });

    it('should set a nested parameter successfully', async () => {
      const operation: SetParamOperation = {
        type: 'setParam',
        nodeId: 'set-1',
        paramPath: 'values.string.0.value',
        value: 'updated hello'
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(true);
      const node = result.workflow?.nodes.find(n => n.id === 'set-1');
      expect(node?.parameters?.values?.string?.[0]?.value).toBe('updated hello');
    });

    it('should create nested structure if it does not exist', async () => {
      const operation: SetParamOperation = {
        type: 'setParam',
        nodeId: 'webhook-1',
        paramPath: 'headers.authorization',
        value: 'Bearer token123'
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(true);
      const node = result.workflow?.nodes.find(n => n.id === 'webhook-1');
      expect(node?.parameters?.headers?.authorization).toBe('Bearer token123');
    });

    it('should fail when node does not exist', async () => {
      const operation: SetParamOperation = {
        type: 'setParam',
        nodeId: 'non-existent',
        paramPath: 'someParam',
        value: 'value'
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].error).toContain('not found');
    });
  });

  describe('unsetParam operation', () => {
    it('should unset a parameter successfully', async () => {
      const operation: UnsetParamOperation = {
        type: 'unsetParam',
        nodeId: 'webhook-1',
        paramPath: 'httpMethod'
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(true);
      const node = result.workflow?.nodes.find(n => n.id === 'webhook-1');
      expect(node?.parameters?.httpMethod).toBeUndefined();
    });

    it('should handle non-existent parameters gracefully', async () => {
      const operation: UnsetParamOperation = {
        type: 'unsetParam',
        nodeId: 'webhook-1',
        paramPath: 'nonExistentParam'
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(true); // Should not fail for non-existent params
    });
  });

  describe('connect operation', () => {
    it('should create a new connection successfully', async () => {
      // First add a new node to connect to
      const addOperation: AddNodeOperation = {
        type: 'addNode',
        node: {
          id: 'http-1',
          name: 'HTTP Request',
          type: 'n8n-nodes-base.httpRequest',
          typeVersion: 1,
          position: [500, 100]
        }
      };

      const connectOperation: ConnectOperation = {
        type: 'connect',
        from: {
          nodeName: 'Set',
          outputIndex: 0,
          outputType: 'main'
        },
        to: {
          nodeName: 'HTTP Request',
          inputIndex: 0,
          inputType: 'main'
        }
      };

      const result = await processor.applyOperations(sampleWorkflow, [addOperation, connectOperation]);

      expect(result.success).toBe(true);
      expect(result.workflow?.connections['Set']).toBeDefined();
      expect(result.workflow?.connections['Set']['main'][0][0]).toEqual({
        node: 'HTTP Request',
        type: 'main',
        index: 0
      });
    });

    it('should fail when source node does not exist', async () => {
      const operation: ConnectOperation = {
        type: 'connect',
        from: {
          nodeName: 'Non-existent',
          outputIndex: 0,
          outputType: 'main'
        },
        to: {
          nodeName: 'Set',
          inputIndex: 0,
          inputType: 'main'
        }
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(false);
      expect(result.errors![0].error).toContain('Source node with name "Non-existent" not found');
    });

    it('should fail when target node does not exist', async () => {
      const operation: ConnectOperation = {
        type: 'connect',
        from: {
          nodeName: 'Webhook',
          outputIndex: 0,
          outputType: 'main'
        },
        to: {
          nodeName: 'Non-existent',
          inputIndex: 0,
          inputType: 'main'
        }
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(false);
      expect(result.errors![0].error).toContain('Target node with name "Non-existent" not found');
    });

    it('should fail when connection already exists', async () => {
      const operation: ConnectOperation = {
        type: 'connect',
        from: {
          nodeName: 'Webhook',
          outputIndex: 0,
          outputType: 'main'
        },
        to: {
          nodeName: 'Set',
          inputIndex: 0,
          inputType: 'main'
        }
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(false);
      expect(result.errors![0].error).toContain('Connection already exists');
    });
  });

  describe('disconnect operation', () => {
    it('should remove an existing connection successfully', async () => {
      const operation: DisconnectOperation = {
        type: 'disconnect',
        from: {
          nodeName: 'Webhook',
          outputIndex: 0,
          outputType: 'main'
        },
        to: {
          nodeName: 'Set',
          inputIndex: 0,
          inputType: 'main'
        }
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(true);
      expect(result.workflow?.connections['Webhook']).toBeUndefined();
    });

    it('should fail when connection does not exist', async () => {
      const operation: DisconnectOperation = {
        type: 'disconnect',
        from: {
          nodeName: 'Webhook',
          outputIndex: 0,
          outputType: 'main'
        },
        to: {
          nodeName: 'Non-existent',
          inputIndex: 0,
          inputType: 'main'
        }
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(false);
      expect(result.errors![0].error).toContain('Connection not found');
    });
  });

  describe('setWorkflowProperty operation', () => {
    it('should set workflow name successfully', async () => {
      const operation: SetWorkflowPropertyOperation = {
        type: 'setWorkflowProperty',
        property: 'name',
        value: 'Updated Workflow Name'
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(true);
      expect(result.workflow?.name).toBe('Updated Workflow Name');
    });

    it('should set workflow active status successfully', async () => {
      const operation: SetWorkflowPropertyOperation = {
        type: 'setWorkflowProperty',
        property: 'active',
        value: true
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(true);
      expect(result.workflow?.active).toBe(true);
    });
  });

  describe('addTag operation', () => {
    it('should add a new tag successfully', async () => {
      const operation: AddTagOperation = {
        type: 'addTag',
        tag: 'production'
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(true);
      expect(result.workflow?.tags).toContain('production');
      expect(result.workflow?.tags).toHaveLength(2);
    });

    it('should fail when tag already exists', async () => {
      const operation: AddTagOperation = {
        type: 'addTag',
        tag: 'test' // This tag already exists
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(false);
      expect(result.errors![0].error).toContain('already exists');
    });

    it('should initialize tags array if it does not exist', async () => {
      delete sampleWorkflow.tags;
      
      const operation: AddTagOperation = {
        type: 'addTag',
        tag: 'new-tag'
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(true);
      expect(result.workflow?.tags).toEqual(['new-tag']);
    });
  });

  describe('removeTag operation', () => {
    it('should remove an existing tag successfully', async () => {
      const operation: RemoveTagOperation = {
        type: 'removeTag',
        tag: 'test'
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(true);
      expect(result.workflow?.tags).not.toContain('test');
      expect(result.workflow?.tags).toHaveLength(0);
    });

    it('should fail when tag does not exist', async () => {
      const operation: RemoveTagOperation = {
        type: 'removeTag',
        tag: 'non-existent'
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(false);
      expect(result.errors![0].error).toContain('not found');
    });

    it('should fail when no tags exist', async () => {
      delete sampleWorkflow.tags;
      
      const operation: RemoveTagOperation = {
        type: 'removeTag',
        tag: 'any-tag'
      };

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(false);
      expect(result.errors![0].error).toContain('No tags exist');
    });
  });

  describe('batch operations', () => {
    it('should apply multiple operations successfully', async () => {
      const operations: PatchOperation[] = [
        {
          type: 'addNode',
          node: {
            id: 'http-1',
            name: 'HTTP Request',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 1,
            position: [500, 100],
            parameters: { url: 'https://api.example.com' }
          }
        },
        {
          type: 'connect',
          from: {
            nodeName: 'Set',
            outputIndex: 0,
            outputType: 'main'
          },
          to: {
            nodeName: 'HTTP Request',
            inputIndex: 0,
            inputType: 'main'
          }
        },
        {
          type: 'setWorkflowProperty',
          property: 'active',
          value: true
        }
      ];

      const result = await processor.applyOperations(sampleWorkflow, operations);

      expect(result.success).toBe(true);
      expect(result.workflow?.nodes).toHaveLength(3);
      expect(result.workflow?.connections['Set']).toBeDefined();
      expect(result.workflow?.active).toBe(true);
    });

    it('should fail atomically when one operation fails', async () => {
      const operations: PatchOperation[] = [
        {
          type: 'setWorkflowProperty',
          property: 'active',
          value: true
        },
        {
          type: 'addNode',
          node: {
            id: 'webhook-1', // This ID already exists - should fail
            name: 'Another Node',
            type: 'n8n-nodes-base.test',
            typeVersion: 1,
            position: [600, 100]
          }
        },
        {
          type: 'addTag',
          tag: 'should-not-be-added'
        }
      ];

      const result = await processor.applyOperations(sampleWorkflow, operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].operationIndex).toBe(1);
      
      // Original workflow should be unchanged (atomic behavior)
      expect(sampleWorkflow.active).toBe(false);
      expect(sampleWorkflow.tags).not.toContain('should-not-be-added');
    });

    it('should provide detailed error information', async () => {
      const operations: PatchOperation[] = [
        {
          type: 'deleteNode',
          nodeId: 'non-existent-node'
        }
      ];

      const result = await processor.applyOperations(sampleWorkflow, operations);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toEqual({
        operationIndex: 0,
        operation: operations[0],
        error: 'Node with ID "non-existent-node" not found',
        details: expect.any(String)
      });
    });
  });

  describe('unknown operation type', () => {
    it('should fail with unknown operation type', async () => {
      const operation = {
        type: 'unknownOperation',
        someParam: 'value'
      } as any;

      const result = await processor.applyOperations(sampleWorkflow, [operation]);

      expect(result.success).toBe(false);
      expect(result.errors![0].error).toContain('Unknown operation type');
    });
  });
});