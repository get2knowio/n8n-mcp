import { describe, it, expect } from '@jest/globals';
import { validateNodeConfig, validateCredentials, validateFullNodeConfig } from '../node-validator.js';

describe('Node Validator', () => {
  describe('validateNodeConfig', () => {
    it('should validate valid HTTP Request configuration', () => {
      const result = validateNodeConfig('n8n-nodes-base.httpRequest', {
        method: 'GET',
        url: 'https://api.example.com/data',
        authentication: 'none',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch missing required parameters for HTTP Request', () => {
      const result = validateNodeConfig('n8n-nodes-base.httpRequest', {
        authentication: 'none',
        // missing required 'method' and 'url'
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      const methodError = result.errors.find(e => e.property === 'method');
      expect(methodError).toBeDefined();
      expect(methodError?.code).toBe('MISSING_REQUIRED');
      expect(methodError?.message).toContain('Required property');
      
      const urlError = result.errors.find(e => e.property === 'url');
      expect(urlError).toBeDefined();
      expect(urlError?.code).toBe('MISSING_REQUIRED');
    });

    it('should catch invalid enum values for HTTP Request method', () => {
      const result = validateNodeConfig('n8n-nodes-base.httpRequest', {
        method: 'INVALID_METHOD',
        url: 'https://api.example.com',
        authentication: 'none',
      });

      expect(result.valid).toBe(false);
      const methodError = result.errors.find(e => e.property === 'method');
      expect(methodError).toBeDefined();
      expect(methodError?.code).toBe('INVALID_ENUM');
      expect(methodError?.message).toContain('must be one of');
    });

    it('should validate valid Webhook configuration', () => {
      const result = validateNodeConfig('n8n-nodes-base.webhook', {
        httpMethod: 'POST',
        path: 'my-webhook',
        authentication: 'none',
        responseMode: 'onReceived',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch missing required parameters for Webhook', () => {
      const result = validateNodeConfig('n8n-nodes-base.webhook', {
        authentication: 'none',
        // missing required 'httpMethod' and 'path'
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      const methodError = result.errors.find(e => e.property === 'httpMethod');
      expect(methodError).toBeDefined();
      expect(methodError?.code).toBe('MISSING_REQUIRED');
      
      const pathError = result.errors.find(e => e.property === 'path');
      expect(pathError).toBeDefined();
      expect(pathError?.code).toBe('MISSING_REQUIRED');
    });

    it('should return error for unknown node type', () => {
      const result = validateNodeConfig('unknown-node-type', {});
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].property).toBe('type');
      expect(result.errors[0].code).toBe('INVALID_TYPE');
      expect(result.errors[0].message).toContain('Unknown node type');
    });

    it('should handle conditional properties with displayOptions', () => {
      // Test sendBody property that only shows for POST/PUT/PATCH methods
      const resultWithPost = validateNodeConfig('n8n-nodes-base.httpRequest', {
        method: 'POST',
        url: 'https://api.example.com',
        sendBody: true,
        contentType: 'json',
      });

      expect(resultWithPost.valid).toBe(true);
      
      // contentType should be ignored for GET requests due to displayOptions
      const resultWithGet = validateNodeConfig('n8n-nodes-base.httpRequest', {
        method: 'GET',
        url: 'https://api.example.com',
        sendBody: false,
        // contentType should be ignored since sendBody is false
      });

      expect(resultWithGet.valid).toBe(true);
    });

    it('should validate type constraints', () => {
      // Test string type validation
      const stringResult = validateNodeConfig('n8n-nodes-base.httpRequest', {
        method: 'GET',
        url: 123, // should be string
        authentication: 'none',
      });

      expect(stringResult.valid).toBe(false);
      const urlError = stringResult.errors.find(e => e.property === 'url');
      expect(urlError?.code).toBe('INVALID_TYPE');
      expect(urlError?.expected).toBe('string');
    });
  });

  describe('validateCredentials', () => {
    it('should pass when no credentials are required', () => {
      const errors = validateCredentials('n8n-nodes-base.noOp', {});
      expect(errors).toHaveLength(0);
    });

    it('should pass when required credentials are provided', () => {
      // Note: our test node types don't mark credentials as required
      // This is a basic test structure
      const errors = validateCredentials('n8n-nodes-base.httpRequest', {
        httpBasicAuth: 'my-basic-auth',
      });
      expect(errors).toHaveLength(0);
    });

    it('should handle unknown node type gracefully', () => {
      const errors = validateCredentials('unknown-node-type', {});
      expect(errors).toHaveLength(0);
    });
  });

  describe('validateFullNodeConfig', () => {
    it('should validate both parameters and credentials', () => {
      const result = validateFullNodeConfig(
        'n8n-nodes-base.httpRequest',
        {
          method: 'GET',
          url: 'https://api.example.com',
          authentication: 'basicAuth',
        },
        {
          httpBasicAuth: 'my-auth-credential',
        }
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch both parameter and credential errors', () => {
      const result = validateFullNodeConfig(
        'n8n-nodes-base.httpRequest',
        {
          method: 'INVALID_METHOD',
          // missing required url
        },
        {} // missing credentials if required
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Should have parameter validation errors
      const paramErrors = result.errors.filter(e => e.code === 'INVALID_ENUM' || e.code === 'MISSING_REQUIRED');
      expect(paramErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty parameters object', () => {
      const result = validateNodeConfig('n8n-nodes-base.httpRequest', {});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle null and undefined values', () => {
      const result = validateNodeConfig('n8n-nodes-base.httpRequest', {
        method: null,
        url: undefined,
        authentication: 'none',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle boolean type validation', () => {
      const result = validateNodeConfig('n8n-nodes-base.httpRequest', {
        method: 'POST',
        url: 'https://api.example.com',
        sendBody: 'true', // should be boolean
      });

      expect(result.valid).toBe(false);
      const boolError = result.errors.find(e => e.property === 'sendBody');
      expect(boolError?.code).toBe('INVALID_TYPE');
      expect(boolError?.expected).toBe('boolean');
    });
  });
});