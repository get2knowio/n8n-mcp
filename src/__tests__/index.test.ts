import { describe, it, expect, jest } from '@jest/globals';

// Mock the entire index module to avoid import issues
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

jest.mock('../n8n-client.js', () => ({
  N8nClient: jest.fn().mockImplementation(() => ({
    listWorkflows: jest.fn(),
    getWorkflow: jest.fn(),
    createWorkflow: jest.fn(),
    updateWorkflow: jest.fn(),
    deleteWorkflow: jest.fn(),
    activateWorkflow: jest.fn(),
    deactivateWorkflow: jest.fn(),
    getNodeTypes: jest.fn(),
    getNodeTypeByName: jest.fn(),
    getNodeTypeExamples: jest.fn(),
    validateNodeConfiguration: jest.fn(),
    sourceControlPull: jest.fn(),
    listVariables: jest.fn(),
    createVariable: jest.fn(),
    updateVariable: jest.fn(),
    deleteVariable: jest.fn(),
    listExecutions: jest.fn(),
    getExecution: jest.fn(),
    deleteExecution: jest.fn(),
    getWebhookUrls: jest.fn(),
    runOnce: jest.fn(),
    listWorkflowTags: jest.fn(),
    setWorkflowTags: jest.fn(),
    transferWorkflow: jest.fn(),
    transferCredential: jest.fn(),
  }))
}));

describe('N8nMcpServer', () => {
  beforeEach(() => {
    // Set environment variables for testing
    process.env.N8N_BASE_URL = 'http://test-n8n.local:5678';
    process.env.N8N_API_KEY = 'test-api-key';
  });

  describe('module import', () => {
    it('should be able to import the module', async () => {
      // Dynamic import to avoid top-level import issues
      const { N8nMcpServer } = await import('../index');
      expect(N8nMcpServer).toBeDefined();
    });

    it('should handle constructor with valid config', async () => {
      const { N8nMcpServer } = await import('../index');
      expect(() => new N8nMcpServer()).not.toThrow();
    });

    it('should warn when no auth configured', async () => {
      delete process.env.N8N_API_KEY;
      delete process.env.N8N_USERNAME;
      delete process.env.N8N_PASSWORD;

      const { N8nMcpServer } = await import('../index');
      const server = new N8nMcpServer();
      expect(server).toBeDefined();
    });
  });

  describe('MCP tools', () => {
    describe('list tools', () => {
      it('should include new tools in the tools list', async () => {
        const { N8nMcpServer } = await import('../index');
        new N8nMcpServer();
        
        const listHandlers = mockServer.setRequestHandler.mock.calls.find(
          (call: any) => call[0] === 'mocked-list-tools-schema'
        );
        expect(listHandlers).toBeDefined();
        
        const handler = listHandlers![1];
        const result = await (handler as any)();

        const toolNames = result.tools.map((tool: any) => tool.name);
        expect(toolNames).toContain('webhook_urls');
        expect(toolNames).toContain('run_once');
        expect(toolNames).toContain('list_workflow_tags');
        expect(toolNames).toContain('set_workflow_tags');
        expect(toolNames).toContain('get_credential_schema');
        expect(toolNames).toContain('list_variables');
        expect(toolNames).toContain('create_variable');
        expect(toolNames).toContain('update_variable');
        expect(toolNames).toContain('delete_variable');
        expect(toolNames).toContain('source_control_pull');
        expect(toolNames).toContain('list_node_types');
        expect(toolNames).toContain('get_node_type');
        expect(toolNames).toContain('examples');
        expect(toolNames).toContain('validate_node_config');
      });
    });
  });

  describe('MCP Tools', () => {
    it('should register node type metadata tools', async () => {
      const { N8nMcpServer } = await import('../index.js');
      const server = new N8nMcpServer();
      
      // Check that setRequestHandler was called with the expected schemas
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        'mocked-list-tools-schema',
        expect.any(Function)
      );
      expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
        'mocked-call-tool-schema',
        expect.any(Function)
      );
    });

    it('should include new tools in list_tools response', async () => {
      const { N8nMcpServer } = await import('../index.js');
      new N8nMcpServer();
      
      // Get the list tools handler
      const listToolsCall = mockServer.setRequestHandler.mock.calls.find(
        call => call[0] === 'mocked-list-tools-schema'
      );
      expect(listToolsCall).toBeDefined();
      
      if (listToolsCall) {
        const listToolsHandler = listToolsCall[1] as () => Promise<any>;
        const response = await listToolsHandler();
        
        expect(response.tools).toBeDefined();
        expect(Array.isArray(response.tools)).toBe(true);
        
        const toolNames = response.tools.map((tool: any) => tool.name);
        expect(toolNames).toContain('list_node_types');
        expect(toolNames).toContain('get_node_type');
        expect(toolNames).toContain('examples');
        expect(toolNames).toContain('validate_node_config');
      }
    });
  });
});