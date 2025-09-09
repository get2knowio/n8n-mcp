import axios, { AxiosInstance } from 'axios';
import { 
  N8nWorkflow, 
  N8nConfig, 
  N8nApiResponse, 
  N8nWorkflowsListResponse,
  N8nNode,
  CreateNodeRequest,
  CreateNodeResponse,
  UpdateNodeRequest,
  UpdateNodeResponse,
  ConnectNodesRequest,
  ConnectNodesResponse,
  DeleteNodeRequest,
  DeleteNodeResponse,
  SetNodePositionRequest,
  SetNodePositionResponse
} from './types.js';

export class N8nClient {
  private api: AxiosInstance;

  constructor(config: N8nConfig) {
    this.api = axios.create({
      baseURL: `${config.baseUrl}/api/v1`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Setup authentication
    if (config.apiKey) {
      this.api.defaults.headers.common['X-N8N-API-KEY'] = config.apiKey;
    } else if (config.username && config.password) {
      const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
      this.api.defaults.headers.common['Authorization'] = `Basic ${auth}`;
    }
  }

  async listWorkflows(): Promise<N8nWorkflow[]> {
    const response = await this.api.get<N8nWorkflowsListResponse>('/workflows');
    return response.data.data;
  }

  async getWorkflow(id: number): Promise<N8nWorkflow> {
    const response = await this.api.get<N8nApiResponse<N8nWorkflow>>(`/workflows/${id}`);
    return response.data.data;
  }

  async createWorkflow(workflow: Omit<N8nWorkflow, 'id'>): Promise<N8nWorkflow> {
    const response = await this.api.post<N8nApiResponse<N8nWorkflow>>('/workflows', workflow);
    return response.data.data;
  }

  async updateWorkflow(id: number, workflow: Partial<N8nWorkflow>): Promise<N8nWorkflow> {
    const response = await this.api.patch<N8nApiResponse<N8nWorkflow>>(`/workflows/${id}`, workflow);
    return response.data.data;
  }

  async deleteWorkflow(id: number): Promise<void> {
    await this.api.delete(`/workflows/${id}`);
  }

  async activateWorkflow(id: number): Promise<N8nWorkflow> {
    const response = await this.api.post<N8nApiResponse<N8nWorkflow>>(`/workflows/${id}/activate`);
    return response.data.data;
  }

  async deactivateWorkflow(id: number): Promise<N8nWorkflow> {
    const response = await this.api.post<N8nApiResponse<N8nWorkflow>>(`/workflows/${id}/deactivate`);
    return response.data.data;
  }

  // Granular node operations
  private generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private getDefaultPosition(existingNodes: N8nNode[]): [number, number] {
    if (existingNodes.length === 0) {
      return [250, 300];
    }
    
    // Find the rightmost position and add some offset
    const rightmostX = Math.max(...existingNodes.map(node => node.position[0]));
    return [rightmostX + 200, 300];
  }

  async createNode(request: CreateNodeRequest): Promise<CreateNodeResponse> {
    const workflow = await this.getWorkflow(request.workflowId);
    
    const nodeId = this.generateNodeId();
    const position = request.position || this.getDefaultPosition(workflow.nodes);
    
    const newNode: N8nNode = {
      id: nodeId,
      name: request.name || request.type.split('.').pop() || 'New Node',
      type: request.type,
      typeVersion: 1, // Default to version 1
      position,
      parameters: request.params || {},
      credentials: request.credentials || {},
    };

    workflow.nodes.push(newNode);
    
    await this.updateWorkflow(request.workflowId, workflow);
    
    return { nodeId };
  }

  async updateNode(request: UpdateNodeRequest): Promise<UpdateNodeResponse> {
    const workflow = await this.getWorkflow(request.workflowId);
    
    const nodeIndex = workflow.nodes.findIndex(node => node.id === request.nodeId);
    if (nodeIndex === -1) {
      throw new Error(`Node with id ${request.nodeId} not found in workflow ${request.workflowId}`);
    }

    const node = workflow.nodes[nodeIndex];
    
    // Update the node properties
    if (request.params !== undefined) {
      node.parameters = { ...node.parameters, ...request.params };
    }
    if (request.credentials !== undefined) {
      node.credentials = { ...node.credentials, ...request.credentials };
    }
    if (request.name !== undefined) {
      node.name = request.name;
    }
    if (request.typeVersion !== undefined) {
      node.typeVersion = request.typeVersion;
    }

    await this.updateWorkflow(request.workflowId, workflow);
    
    return { nodeId: request.nodeId };
  }

  async connectNodes(request: ConnectNodesRequest): Promise<ConnectNodesResponse> {
    const workflow = await this.getWorkflow(request.workflowId);
    
    // Verify both nodes exist
    const fromNode = workflow.nodes.find(node => node.id === request.from.nodeId);
    const toNode = workflow.nodes.find(node => node.id === request.to.nodeId);
    
    if (!fromNode) {
      throw new Error(`Source node ${request.from.nodeId} not found in workflow ${request.workflowId}`);
    }
    if (!toNode) {
      throw new Error(`Target node ${request.to.nodeId} not found in workflow ${request.workflowId}`);
    }

    // Initialize connections for the from node if it doesn't exist
    if (!workflow.connections[fromNode.name]) {
      workflow.connections[fromNode.name] = {};
    }
    
    // Use 'main' as the default connection type
    if (!workflow.connections[fromNode.name].main) {
      workflow.connections[fromNode.name].main = [];
    }

    // Ensure the output index exists
    const outputIndex = request.from.outputIndex || 0;
    if (!workflow.connections[fromNode.name].main[outputIndex]) {
      workflow.connections[fromNode.name].main[outputIndex] = [];
    }

    // Add the connection
    const connection = {
      node: toNode.name,
      type: 'main',
      index: request.to.inputIndex || 0,
    };

    // Check if connection already exists
    const existingConnection = workflow.connections[fromNode.name].main[outputIndex]
      .find(conn => conn.node === connection.node && conn.index === connection.index);
    
    if (!existingConnection) {
      workflow.connections[fromNode.name].main[outputIndex].push(connection);
    }

    await this.updateWorkflow(request.workflowId, workflow);
    
    return { ok: true };
  }

  async deleteNode(request: DeleteNodeRequest): Promise<DeleteNodeResponse> {
    const workflow = await this.getWorkflow(request.workflowId);
    
    const nodeIndex = workflow.nodes.findIndex(node => node.id === request.nodeId);
    if (nodeIndex === -1) {
      throw new Error(`Node with id ${request.nodeId} not found in workflow ${request.workflowId}`);
    }

    const nodeName = workflow.nodes[nodeIndex].name;
    
    // Remove the node
    workflow.nodes.splice(nodeIndex, 1);
    
    // Remove all connections to and from this node
    // Remove outgoing connections
    delete workflow.connections[nodeName];
    
    // Remove incoming connections
    Object.keys(workflow.connections).forEach(sourceNodeName => {
      Object.keys(workflow.connections[sourceNodeName]).forEach(outputType => {
        workflow.connections[sourceNodeName][outputType] = 
          workflow.connections[sourceNodeName][outputType].map(outputArray => 
            outputArray.filter(conn => conn.node !== nodeName)
          );
      });
    });

    await this.updateWorkflow(request.workflowId, workflow);
    
    return { ok: true };
  }

  async setNodePosition(request: SetNodePositionRequest): Promise<SetNodePositionResponse> {
    const workflow = await this.getWorkflow(request.workflowId);
    
    const nodeIndex = workflow.nodes.findIndex(node => node.id === request.nodeId);
    if (nodeIndex === -1) {
      throw new Error(`Node with id ${request.nodeId} not found in workflow ${request.workflowId}`);
    }

    workflow.nodes[nodeIndex].position = [request.x, request.y];
    
    await this.updateWorkflow(request.workflowId, workflow);
    
    return { ok: true };
  }
}