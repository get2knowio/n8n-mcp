import { describe, it, expect } from '@jest/globals';
import { getNodeTypes, getNodeType, getNodeExamples, getNodeTypeNames } from '../node-registry.js';

describe('Node Registry', () => {
  describe('getNodeTypes', () => {
    it('should return an array of node types', () => {
      const nodeTypes = getNodeTypes();
      expect(Array.isArray(nodeTypes)).toBe(true);
      expect(nodeTypes.length).toBeGreaterThan(0);
    });

    it('should return node types with required properties', () => {
      const nodeTypes = getNodeTypes();
      const httpNode = nodeTypes.find(n => n.name === 'n8n-nodes-base.httpRequest');
      
      expect(httpNode).toBeDefined();
      expect(httpNode?.name).toBe('n8n-nodes-base.httpRequest');
      expect(httpNode?.displayName).toBe('HTTP Request');
      expect(httpNode?.description).toContain('HTTP request');
      expect(Array.isArray(httpNode?.version)).toBe(true);
      expect(httpNode?.defaults).toBeDefined();
      expect(Array.isArray(httpNode?.inputs)).toBe(true);
      expect(Array.isArray(httpNode?.outputs)).toBe(true);
      expect(Array.isArray(httpNode?.properties)).toBe(true);
    });
  });

  describe('getNodeType', () => {
    it('should return a specific node type by name', () => {
      const httpNode = getNodeType('n8n-nodes-base.httpRequest');
      expect(httpNode).toBeDefined();
      expect(httpNode?.name).toBe('n8n-nodes-base.httpRequest');
      expect(httpNode?.displayName).toBe('HTTP Request');
    });

    it('should return undefined for unknown node type', () => {
      const unknownNode = getNodeType('unknown-node-type');
      expect(unknownNode).toBeUndefined();
    });
  });

  describe('getNodeExamples', () => {
    it('should return examples for HTTP Request node', () => {
      const examples = getNodeExamples('n8n-nodes-base.httpRequest');
      expect(Array.isArray(examples)).toBe(true);
      expect(examples.length).toBeGreaterThan(0);
      
      const getExample = examples.find(e => e.name === 'Simple GET Request');
      expect(getExample).toBeDefined();
      expect(getExample?.description).toContain('GET request');
      expect(getExample?.workflow).toBeDefined();
      expect(Array.isArray(getExample?.workflow.nodes)).toBe(true);
    });

    it('should return examples for Webhook node', () => {
      const examples = getNodeExamples('n8n-nodes-base.webhook');
      expect(Array.isArray(examples)).toBe(true);
      expect(examples.length).toBeGreaterThan(0);
      
      const simpleExample = examples.find(e => e.name === 'Simple Webhook');
      expect(simpleExample).toBeDefined();
      expect(simpleExample?.workflow.nodes).toHaveLength(1);
      expect(simpleExample?.workflow.nodes[0].type).toBe('n8n-nodes-base.webhook');
    });

    it('should return empty array for unknown node type', () => {
      const examples = getNodeExamples('unknown-node-type');
      expect(Array.isArray(examples)).toBe(true);
      expect(examples).toHaveLength(0);
    });
  });

  describe('getNodeTypeNames', () => {
    it('should return array of node type names', () => {
      const names = getNodeTypeNames();
      expect(Array.isArray(names)).toBe(true);
      expect(names).toContain('n8n-nodes-base.httpRequest');
      expect(names).toContain('n8n-nodes-base.webhook');
      expect(names).toContain('n8n-nodes-base.set');
      expect(names).toContain('n8n-nodes-base.noOp');
    });
  });

  describe('Node Type Completeness', () => {
    it('should have HTTP Request node with proper configuration', () => {
      const httpNode = getNodeType('n8n-nodes-base.httpRequest');
      expect(httpNode).toBeDefined();
      
      // Check required properties exist
      const methodProp = httpNode?.properties.find(p => p.name === 'method');
      expect(methodProp).toBeDefined();
      expect(methodProp?.required).toBe(true);
      expect(methodProp?.type).toBe('options');
      expect(methodProp?.options).toBeDefined();
      
      const urlProp = httpNode?.properties.find(p => p.name === 'url');
      expect(urlProp).toBeDefined();
      expect(urlProp?.required).toBe(true);
      expect(urlProp?.type).toBe('string');
    });

    it('should have Webhook node with proper configuration', () => {
      const webhookNode = getNodeType('n8n-nodes-base.webhook');
      expect(webhookNode).toBeDefined();
      
      // Check required properties exist
      const methodProp = webhookNode?.properties.find(p => p.name === 'httpMethod');
      expect(methodProp).toBeDefined();
      expect(methodProp?.required).toBe(true);
      expect(methodProp?.type).toBe('options');
      
      const pathProp = webhookNode?.properties.find(p => p.name === 'path');
      expect(pathProp).toBeDefined();
      expect(pathProp?.required).toBe(true);
      expect(pathProp?.type).toBe('string');
    });
  });
});