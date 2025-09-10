import { describe, it, expect } from '@jest/globals';
import { 
  CreateNodeRequest,
  UpdateNodeRequest,
  ConnectNodesRequest,
  DeleteNodeRequest,
  SetNodePositionRequest,
  N8nNode,
  N8nWorkflow
} from '../types';

describe('Node Operations Types', () => {
  it('should define CreateNodeRequest interface correctly', () => {
    const request: CreateNodeRequest = {
      workflowId: 1,
      type: 'n8n-nodes-base.webhook',
      name: 'Test Webhook',
      params: { httpMethod: 'GET' },
      position: [100, 200],
      credentials: { webhookAuth: 'auth-id' }
    };

    expect(request.workflowId).toBe(1);
    expect(request.type).toBe('n8n-nodes-base.webhook');
    expect(request.name).toBe('Test Webhook');
    expect(request.position).toEqual([100, 200]);
  });

  it('should define UpdateNodeRequest interface correctly', () => {
    const request: UpdateNodeRequest = {
      workflowId: 1,
      nodeId: 'node-123',
      name: 'Updated Node',
      params: { httpMethod: 'POST' },
      typeVersion: 2
    };

    expect(request.workflowId).toBe(1);
    expect(request.nodeId).toBe('node-123');
    expect(request.typeVersion).toBe(2);
  });

  it('should define ConnectNodesRequest interface correctly', () => {
    const request: ConnectNodesRequest = {
      workflowId: 1,
      from: { nodeId: 'node-1', outputIndex: 0 },
      to: { nodeId: 'node-2', inputIndex: 1 }
    };

    expect(request.workflowId).toBe(1);
    expect(request.from.nodeId).toBe('node-1');
    expect(request.from.outputIndex).toBe(0);
    expect(request.to.nodeId).toBe('node-2');
    expect(request.to.inputIndex).toBe(1);
  });

  it('should define DeleteNodeRequest interface correctly', () => {
    const request: DeleteNodeRequest = {
      workflowId: 1,
      nodeId: 'node-to-delete'
    };

    expect(request.workflowId).toBe(1);
    expect(request.nodeId).toBe('node-to-delete');
  });

  it('should define SetNodePositionRequest interface correctly', () => {
    const request: SetNodePositionRequest = {
      workflowId: 1,
      nodeId: 'node-123',
      x: 300,
      y: 400
    };

    expect(request.workflowId).toBe(1);
    expect(request.nodeId).toBe('node-123');
    expect(request.x).toBe(300);
    expect(request.y).toBe(400);
  });

  it('should validate node ID generation pattern', () => {
    // Test the expected pattern for generated node IDs
    const nodeIdPattern = /^node_\d+_[a-z0-9]+$/;
    const testId = 'node_1699123456789_abc123';
    
    expect(nodeIdPattern.test(testId)).toBe(true);
  });

  it('should handle workflow with new connection structure', () => {
    const workflow: N8nWorkflow = {
      id: 1,
      name: 'Test Workflow',
      nodes: [
        {
          id: 'webhook-1',
          name: 'Webhook',
          type: 'n8n-nodes-base.webhook',
          typeVersion: 1,
          position: [250, 300],
          parameters: {}
        },
        {
          id: 'set-1',
          name: 'Set',
          type: 'n8n-nodes-base.set',
          typeVersion: 3,
          position: [450, 300],
          parameters: {}
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

    expect(workflow.connections['Webhook']['main']).toHaveLength(1);
    expect(workflow.connections['Webhook']['main'][0]).toHaveLength(1);
    expect(workflow.connections['Webhook']['main'][0][0].node).toBe('Set');
    expect(workflow.connections['Webhook']['main'][0][0].type).toBe('main');
    expect(workflow.connections['Webhook']['main'][0][0].index).toBe(0);
  });
});