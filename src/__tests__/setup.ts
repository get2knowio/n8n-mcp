// Test setup file
import { jest } from '@jest/globals';

// Mock axios for all tests
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    defaults: {
      headers: {
        common: {},
      },
    },
    // Minimal interceptor stubs so code can call .interceptors.request/response.use
    interceptors: {
      request: { use: jest.fn((onFulfilled) => onFulfilled) },
      response: { use: jest.fn((onFulfilled, onRejected) => onFulfilled ?? onRejected) },
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  })),
}));

// Set test environment variables
process.env.N8N_BASE_URL = 'http://test-n8n.local:5678';
process.env.N8N_API_KEY = 'test-api-key';