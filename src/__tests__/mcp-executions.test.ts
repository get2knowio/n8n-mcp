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
  listExecutions: jest.fn(),
  getExecution: jest.fn(),
  deleteExecution: jest.fn(),
  getWebhookUrls: jest.fn(),
  runOnce: jest.fn(),
  listVariables: jest.fn(),
  createVariable: jest.fn(),
  updateVariable: jest.fn(),
  deleteVariable: jest.fn(),
  listWorkflowTags: jest.fn(),
  setWorkflowTags: jest.fn(),
  transferWorkflow: jest.fn(),
  transferCredential: jest.fn(),
  sourceControlPull: jest.fn(),
  getCredentialSchema: jest.fn(),
  getNodeTypes: jest.fn(),
  getNodeTypeByName: jest.fn(),
  getNodeTypeExamples: jest.fn(),
  validateNodeConfiguration: jest.fn(),
  applyOperations: jest.fn(),
  createNode: jest.fn(),
  updateNode: jest.fn(),
  connectNodes: jest.fn(),
  deleteNode: jest.fn(),
  setNodePosition: jest.fn(),
  listTags: jest.fn(),
  getTag: jest.fn(),
  createTag: jest.fn(),
  updateTag: jest.fn(),
  deleteTag: jest.fn(),
} as any;

jest.mock('../n8n-client', () => ({
  N8nClient: jest.fn().mockImplementation(() => mockN8nClientInstance)
}));

describe('N8nMcpServer - Execution Tools', () => {
  let N8nMcpServer: any;
  let server: any;

  const mockExecution = {
    id: 'exec-123',
    finished: true,
    mode: 'manual',
    startedAt: '2024-01-01T00:00:00.000Z',
    stoppedAt: '2024-01-01T00:01:00.000Z',
    workflowId: '1',
    status: 'success' as const
  };

  beforeEach(async () => {
    // Set environment variables for testing
    process.env.N8N_BASE_URL = 'http://test-n8n.local:5678';
    process.env.N8N_API_KEY = 'test-api-key';

    // Clear all mocks
    jest.clearAllMocks();

    // Dynamic import to get fresh instance
    const indexModule = await import('../index');
    N8nMcpServer = indexModule.N8nMcpServer;
    server = new N8nMcpServer();
  });

  afterEach(() => {
    delete process.env.N8N_BASE_URL;
    delete process.env.N8N_API_KEY;
  });

  describe('list_executions tool', () => {
    it('should call list_executions and return formatted response', async () => {
      // Setup mock
      mockN8nClientInstance.listExecutions.mockResolvedValue({
        data: [mockExecution],
        nextCursor: 'cursor_123'
      });

      // Get the call tool handler
      const callToolCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === 'mocked-call-tool-schema'
      );
      expect(callToolCall).toBeDefined();
      
      const callToolHandler = callToolCall![1] as any;
      
      const request = {
        params: {
          name: 'list_executions',
          arguments: { limit: 10, cursor: 'test_cursor', workflowId: '1' }
        }
      };

      const result = await callToolHandler(request);

      expect(mockN8nClientInstance.listExecutions).toHaveBeenCalledWith({
        limit: 10,
        cursor: 'test_cursor',
        workflowId: '1'
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.data).toEqual([mockExecution]);
      expect(responseData.nextCursor).toBe('cursor_123');
    });

    it('should handle list_executions without arguments', async () => {
      mockN8nClientInstance.listExecutions.mockResolvedValue({
        data: [mockExecution]
      });

      const callToolCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === 'mocked-call-tool-schema'
      );
      const callToolHandler = callToolCall![1] as any;
      
      const request = {
        params: {
          name: 'list_executions',
          arguments: {}
        }
      };

      const result = await callToolHandler(request);

      expect(mockN8nClientInstance.listExecutions).toHaveBeenCalledWith({});
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.data).toEqual([mockExecution]);
    });

    it('should handle list_executions API errors', async () => {
      mockN8nClientInstance.listExecutions.mockRejectedValue(new Error('API Error'));

      const callToolCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === 'mocked-call-tool-schema'
      );
      const callToolHandler = callToolCall![1] as any;
      
      const request = {
        params: {
          name: 'list_executions',
          arguments: {}
        }
      };

      const result = await callToolHandler(request);

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('Error: API Error');
    });
  });

  describe('get_execution tool', () => {
    it('should call get_execution and return formatted response', async () => {
      mockN8nClientInstance.getExecution.mockResolvedValue(mockExecution);

      const callToolCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === 'mocked-call-tool-schema'
      );
      const callToolHandler = callToolCall![1] as any;
      
      const request = {
        params: {
          name: 'get_execution',
          arguments: { id: 'exec-123' }
        }
      };

      const result = await callToolHandler(request);

      expect(mockN8nClientInstance.getExecution).toHaveBeenCalledWith('exec-123');
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData).toEqual(mockExecution);
    });

    it('should handle get_execution not found error', async () => {
      mockN8nClientInstance.getExecution.mockRejectedValue(new Error('Execution not found'));

      const callToolCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === 'mocked-call-tool-schema'
      );
      const callToolHandler = callToolCall![1] as any;
      
      const request = {
        params: {
          name: 'get_execution',
          arguments: { id: 'nonexistent' }
        }
      };

      const result = await callToolHandler(request);

      expect(mockN8nClientInstance.getExecution).toHaveBeenCalledWith('nonexistent');
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('Error: Execution not found');
    });
  });

  describe('delete_execution tool', () => {
    it('should call delete_execution and return success message', async () => {
      mockN8nClientInstance.deleteExecution.mockResolvedValue({ success: true });

      const callToolCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === 'mocked-call-tool-schema'
      );
      const callToolHandler = callToolCall![1] as any;
      
      const request = {
        params: {
          name: 'delete_execution',
          arguments: { id: 'exec-123' }
        }
      };

      const result = await callToolHandler(request);

      expect(mockN8nClientInstance.deleteExecution).toHaveBeenCalledWith('exec-123');
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('Execution exec-123 deleted successfully');
    });

    it('should handle delete_execution errors', async () => {
      mockN8nClientInstance.deleteExecution.mockRejectedValue(new Error('Deletion failed'));

      const callToolCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === 'mocked-call-tool-schema'
      );
      const callToolHandler = callToolCall![1] as any;
      
      const request = {
        params: {
          name: 'delete_execution',
          arguments: { id: 'exec-123' }
        }
      };

      const result = await callToolHandler(request);

      expect(mockN8nClientInstance.deleteExecution).toHaveBeenCalledWith('exec-123');
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('Error: Deletion failed');
    });
  });

  describe('execution tools in tools list', () => {
    it('should include execution tools in the tools list', async () => {
      const listToolsCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === 'mocked-list-tools-schema'
      );
      expect(listToolsCall).toBeDefined();
      
      const listToolsHandler = listToolsCall![1] as any;
      const response = await listToolsHandler();
      
      expect(response.tools).toBeDefined();
      expect(Array.isArray(response.tools)).toBe(true);
      
      const toolNames = response.tools.map((tool: any) => tool.name);
      expect(toolNames).toContain('list_executions');
      expect(toolNames).toContain('get_execution');
      expect(toolNames).toContain('delete_execution');
    });

    it('should have proper schemas for execution tools', async () => {
      const listToolsCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === 'mocked-list-tools-schema'
      );
      const listToolsHandler = listToolsCall![1] as any;
      const response = await listToolsHandler();
      
      const listExecutionsTool = response.tools.find((tool: any) => tool.name === 'list_executions');
      expect(listExecutionsTool).toBeDefined();
      expect(listExecutionsTool.description).toBe('List n8n workflow executions');
      expect(listExecutionsTool.inputSchema.properties).toHaveProperty('limit');
      expect(listExecutionsTool.inputSchema.properties).toHaveProperty('cursor');
      expect(listExecutionsTool.inputSchema.properties).toHaveProperty('workflowId');

      const getExecutionTool = response.tools.find((tool: any) => tool.name === 'get_execution');
      expect(getExecutionTool).toBeDefined();
      expect(getExecutionTool.description).toBe('Get a specific n8n execution by ID');
      expect(getExecutionTool.inputSchema.properties).toHaveProperty('id');
      expect(getExecutionTool.inputSchema.required).toContain('id');

      const deleteExecutionTool = response.tools.find((tool: any) => tool.name === 'delete_execution');
      expect(deleteExecutionTool).toBeDefined();
      expect(deleteExecutionTool.description).toBe('Delete an n8n execution');
      expect(deleteExecutionTool.inputSchema.properties).toHaveProperty('id');
      expect(deleteExecutionTool.inputSchema.required).toContain('id');
    });
  });
});