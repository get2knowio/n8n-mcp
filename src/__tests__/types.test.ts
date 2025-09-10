import { describe, it, expect } from '@jest/globals';
import { N8nWorkflow, N8nNode, N8nConnections, N8nConfig, N8nTag, N8nVariable } from '../types';

describe('Types', () => {
  describe('N8nWorkflow', () => {
    it('should define a valid workflow structure', () => {
      const workflow: N8nWorkflow = {
        id: 1,
        name: 'Test Workflow',
        nodes: [],
        connections: {},
        active: false,
        tags: ['test']
      };

      expect(workflow).toBeDefined();
      expect(workflow.id).toBe(1);
      expect(workflow.name).toBe('Test Workflow');
      expect(workflow.nodes).toEqual([]);
      expect(workflow.connections).toEqual({});
      expect(workflow.active).toBe(false);
      expect(workflow.tags).toEqual(['test']);
    });

    it('should work without optional fields', () => {
      const workflow: N8nWorkflow = {
        name: 'Minimal Workflow',
        nodes: [],
        connections: {}
      };

      expect(workflow).toBeDefined();
      expect(workflow.name).toBe('Minimal Workflow');
      expect(workflow.id).toBeUndefined();
      expect(workflow.active).toBeUndefined();
    });
  });

  describe('N8nNode', () => {
    it('should define a valid node structure', () => {
      const node: N8nNode = {
        id: 'webhook-1',
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [250, 300],
        parameters: {
          httpMethod: 'GET',
          path: 'webhook'
        }
      };

      expect(node).toBeDefined();
      expect(node.id).toBe('webhook-1');
      expect(node.name).toBe('Webhook Trigger');
      expect(node.type).toBe('n8n-nodes-base.webhook');
      expect(node.typeVersion).toBe(1);
      expect(node.position).toEqual([250, 300]);
      expect(node.parameters).toEqual({
        httpMethod: 'GET',
        path: 'webhook'
      });
    });

    it('should work with minimal required fields', () => {
      const node: N8nNode = {
        id: 'minimal-node',
        name: 'Minimal Node',
        type: 'n8n-nodes-base.test',
        typeVersion: 1,
        position: [0, 0]
      };

      expect(node).toBeDefined();
      expect(node.parameters).toBeUndefined();
      expect(node.disabled).toBeUndefined();
    });
  });

  describe('N8nConnections', () => {
    it('should define valid connections structure', () => {
      const connections: N8nConnections = {
        'webhook-1': {
          'main': [
            {
              node: 'code-1',
              type: 'main',
              index: 0
            }
          ]
        }
      };

      expect(connections).toBeDefined();
      expect(connections['webhook-1']).toBeDefined();
      expect(connections['webhook-1']['main']).toHaveLength(1);
      expect(connections['webhook-1']['main'][0].node).toBe('code-1');
    });

    it('should work with empty connections', () => {
      const connections: N8nConnections = {};

      expect(connections).toBeDefined();
      expect(Object.keys(connections)).toHaveLength(0);
    });
  });

  describe('N8nConfig', () => {
    it('should define config with API key', () => {
      const config: N8nConfig = {
        baseUrl: 'http://localhost:5678',
        apiKey: 'test-api-key'
      };

      expect(config).toBeDefined();
      expect(config.baseUrl).toBe('http://localhost:5678');
      expect(config.apiKey).toBe('test-api-key');
      expect(config.username).toBeUndefined();
      expect(config.password).toBeUndefined();
    });

    it('should define config with basic auth', () => {
      const config: N8nConfig = {
        baseUrl: 'http://localhost:5678',
        username: 'testuser',
        password: 'testpass'
      };

      expect(config).toBeDefined();
      expect(config.baseUrl).toBe('http://localhost:5678');
      expect(config.username).toBe('testuser');
      expect(config.password).toBe('testpass');
      expect(config.apiKey).toBeUndefined();
    });

    it('should work with minimal config', () => {
      const config: N8nConfig = {
        baseUrl: 'http://localhost:5678'
      };

      expect(config).toBeDefined();
      expect(config.baseUrl).toBe('http://localhost:5678');
    });
  });

  describe('N8nVariable', () => {
    it('should define a valid variable structure', () => {
      const variable: N8nVariable = {
        id: 'var-123',
        key: 'test-key',
        value: 'test-value'
      };

      expect(variable).toBeDefined();
      expect(variable.id).toBe('var-123');
      expect(variable.key).toBe('test-key');
      expect(variable.value).toBe('test-value');
    });

    it('should work without optional id field', () => {
      const variable: N8nVariable = {
        key: 'minimal-key',
        value: 'minimal-value'
      };

      expect(variable).toBeDefined();
      expect(variable.key).toBe('minimal-key');
      expect(variable.value).toBe('minimal-value');
      expect(variable.id).toBeUndefined();
    });
  });

  describe('N8nTag', () => {
    it('should define a valid tag structure with all properties', () => {
      const tag: N8nTag = {
        id: 1,
        name: 'Production',
        color: '#ff0000',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      };

      expect(tag).toBeDefined();
      expect(tag.id).toBe(1);
      expect(tag.name).toBe('Production');
      expect(tag.color).toBe('#ff0000');
      expect(tag.createdAt).toBe('2023-01-01T00:00:00.000Z');
      expect(tag.updatedAt).toBe('2023-01-01T00:00:00.000Z');
    });

    it('should define a valid tag structure with minimal properties', () => {
      const tag: N8nTag = {
        name: 'Development'
      };

      expect(tag).toBeDefined();
      expect(tag.name).toBe('Development');
      expect(tag.id).toBeUndefined();
      expect(tag.color).toBeUndefined();
      expect(tag.createdAt).toBeUndefined();
      expect(tag.updatedAt).toBeUndefined();
    });
  });
});