export interface N8nWorkflow {
  id?: number;
  name: string;
  nodes: N8nNode[];
  connections: N8nConnections;
  active?: boolean;
  settings?: Record<string, any>;
  staticData?: Record<string, any>;
  tags?: string[];
  pinData?: Record<string, any>;
  versionId?: string;
  meta?: Record<string, any>;
}

export interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters?: Record<string, any>;
  credentials?: Record<string, string>;
  disabled?: boolean;
  notes?: string;
  color?: string;
  continueOnFail?: boolean;
  alwaysOutputData?: boolean;
  executeOnce?: boolean;
  retryOnFail?: boolean;
  maxTries?: number;
  waitBetweenTries?: number;
  onError?: string;
}

export interface N8nConnections {
  [key: string]: {
    [key: string]: Array<Array<{
      node: string;
      type: string;
      index: number;
    }>>;
  };
}

export interface N8nApiResponse<T> {
  data: T;
}

export interface N8nWorkflowsListResponse {
  data: N8nWorkflow[];
}

export interface N8nConfig {
  baseUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
}

// Types for granular node operations
export interface CreateNodeRequest {
  workflowId: number;
  type: string;
  name?: string;
  params?: Record<string, any>;
  position?: [number, number];
  credentials?: Record<string, string>;
}

export interface CreateNodeResponse {
  nodeId: string;
}

export interface UpdateNodeRequest {
  workflowId: number;
  nodeId: string;
  params?: Record<string, any>;
  credentials?: Record<string, string>;
  name?: string;
  typeVersion?: number;
}

export interface UpdateNodeResponse {
  nodeId: string;
}

export interface ConnectNodesRequest {
  workflowId: number;
  from: {
    nodeId: string;
    outputIndex?: number;
  };
  to: {
    nodeId: string;
    inputIndex?: number;
  };
}

export interface ConnectNodesResponse {
  ok: true;
}

export interface DeleteNodeRequest {
  workflowId: number;
  nodeId: string;
}

export interface DeleteNodeResponse {
  ok: true;
}

export interface SetNodePositionRequest {
  workflowId: number;
  nodeId: string;
  x: number;
  y: number;
}

export interface SetNodePositionResponse {
  ok: true;
}