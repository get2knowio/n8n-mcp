import { describe, it, expect, jest } from '@jest/globals';

// Mock the MCP SDK components
const mockServer = {
  setRequestHandler: jest.fn(),
  connect: jest.fn(),
};

jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => mockServer)
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn()
}));

jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  CallToolRequestSchema: 'mocked-call-tool-schema',
  ListToolsRequestSchema: 'mocked-list-tools-schema',
}));

const mockN8nClientInstance = {
  listWorkflows: jest.fn(),
  getWorkflow: jest.fn(),
  createWorkflow: jest.fn(),
  updateWorkflow: jest.fn(),
  deleteWorkflow: jest.fn(),
  activateWorkflow: jest.fn(),
  deactivateWorkflow: jest.fn(),
  listCredentials: jest.fn(),
  resolveCredentialAlias: jest.fn(),
} as any;

jest.mock('../n8n-client', () => ({
  N8nClient: jest.fn().mockImplementation(() => mockN8nClientInstance)
}));

describe('N8nMcpServer - Credential Tools', () => {
  let N8nMcpServer: any;
  let server: any;

  beforeEach(async () => {
    // Set environment variables for testing
    process.env.N8N_BASE_URL = 'http://test-n8n.local:5678';
    process.env.N8N_API_KEY = 'test-api-key';

    // Clear all mocks
    jest.clearAllMocks();

    // Dynamic import to get fresh instance
    const module = await import('../index');
    N8nMcpServer = module.N8nMcpServer;
    server = new N8nMcpServer();
  });

  describe('list_credentials tool', () => {
    it('should be included in the tools list', async () => {
      // Get the list tools handler
      const listToolsCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === 'mocked-list-tools-schema'
      );
      expect(listToolsCall).toBeDefined();

      const handler = listToolsCall![1] as any;
      const result = await handler();

      const credentialTools = result.tools.filter((tool: any) => 
        tool.name === 'list_credentials' || tool.name === 'resolve_credential_alias'
      );

      expect(credentialTools).toHaveLength(2);
      
      const listCredentialsTool = credentialTools.find((tool: any) => tool.name === 'list_credentials');
      expect(listCredentialsTool).toEqual({
        name: 'list_credentials',
        description: 'List all n8n credentials',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      });

      const resolveAliasTool = credentialTools.find((tool: any) => tool.name === 'resolve_credential_alias');
      expect(resolveAliasTool).toEqual({
        name: 'resolve_credential_alias',
        description: 'Resolve a credential alias to its ID',
        inputSchema: {
          type: 'object',
          properties: {
            alias: {
              type: 'string',
              description: 'The credential alias/name to resolve',
            },
          },
          required: ['alias'],
        },
      });
    });

    it('should handle list_credentials tool call', async () => {
      const mockCredentials = [
        { id: '1', name: 'test-credential', type: 'httpBasicAuth' },
        { id: '2', name: 'another-credential', type: 'httpHeaderAuth' }
      ];
      mockN8nClientInstance.listCredentials.mockResolvedValue(mockCredentials);

      // Get the call tool handler
      const callToolCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === 'mocked-call-tool-schema'
      );
      expect(callToolCall).toBeDefined();

      const handler = callToolCall![1] as any;
      const result = await handler({
        params: {
          name: 'list_credentials',
          arguments: {}
        }
      });

      expect(mockN8nClientInstance.listCredentials).toHaveBeenCalled();
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockCredentials, null, 2),
          },
        ],
      });
    });

    it('should handle resolve_credential_alias tool call', async () => {
      const testAlias = 'test-credential';
      const resolvedId = '123';
      mockN8nClientInstance.resolveCredentialAlias.mockResolvedValue(resolvedId);

      // Get the call tool handler
      const callToolCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === 'mocked-call-tool-schema'
      );
      expect(callToolCall).toBeDefined();

      const handler = callToolCall![1] as any;
      const result = await handler({
        params: {
          name: 'resolve_credential_alias',
          arguments: { alias: testAlias }
        }
      });

      expect(mockN8nClientInstance.resolveCredentialAlias).toHaveBeenCalledWith(testAlias);
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: `Credential alias '${testAlias}' resolved to ID: ${resolvedId}`,
          },
        ],
      });
    });

    it('should handle errors in list_credentials tool', async () => {
      const errorMessage = 'Credentials API failed';
      mockN8nClientInstance.listCredentials.mockRejectedValue(new Error(errorMessage));

      // Get the call tool handler
      const callToolCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === 'mocked-call-tool-schema'
      );
      expect(callToolCall).toBeDefined();

      const handler = callToolCall![1] as any;
      const result = await handler({
        params: {
          name: 'list_credentials',
          arguments: {}
        }
      });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: `Error: ${errorMessage}`,
          },
        ],
      });
    });

    it('should handle errors in resolve_credential_alias tool', async () => {
      const testAlias = 'nonexistent-credential';
      const errorMessage = `No credential found with alias: ${testAlias}`;
      mockN8nClientInstance.resolveCredentialAlias.mockRejectedValue(new Error(errorMessage));

      // Get the call tool handler
      const callToolCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === 'mocked-call-tool-schema'
      );
      expect(callToolCall).toBeDefined();

      const handler = callToolCall![1] as any;
      const result = await handler({
        params: {
          name: 'resolve_credential_alias',
          arguments: { alias: testAlias }
        }
      });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: `Error: ${errorMessage}`,
          },
        ],
      });
    });
  });
});