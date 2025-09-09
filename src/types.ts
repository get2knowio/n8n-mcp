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
  [nodeName: string]: {
    [outputType: string]: Array<Array<{
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

// Patch DSL Operation Types

export interface ConnectionEndpoint {
  nodeName: string;
  outputIndex: number;
  outputType: string;
}

export interface ConnectionTarget {
  nodeName: string;
  inputIndex: number;
  inputType: string;
}

export interface AddNodeOperation {
  type: 'addNode';
  node: Omit<N8nNode, 'id'> & { id: string };
}

export interface DeleteNodeOperation {
  type: 'deleteNode';
  nodeId: string;
}

export interface UpdateNodeOperation {
  type: 'updateNode';
  nodeId: string;
  updates: Partial<Omit<N8nNode, 'id'>>;
}

export interface SetParamOperation {
  type: 'setParam';
  nodeId: string;
  paramPath: string;
  value: any;
}

export interface UnsetParamOperation {
  type: 'unsetParam';
  nodeId: string;
  paramPath: string;
}

export interface ConnectOperation {
  type: 'connect';
  from: ConnectionEndpoint;
  to: ConnectionTarget;
}

export interface DisconnectOperation {
  type: 'disconnect';
  from: ConnectionEndpoint;
  to: ConnectionTarget;
}

export interface SetWorkflowPropertyOperation {
  type: 'setWorkflowProperty';
  property: string;
  value: any;
}

export interface AddTagOperation {
  type: 'addTag';
  tag: string;
}

export interface RemoveTagOperation {
  type: 'removeTag';
  tag: string;
}

export type PatchOperation = 
  | AddNodeOperation
  | DeleteNodeOperation
  | UpdateNodeOperation
  | SetParamOperation
  | UnsetParamOperation
  | ConnectOperation
  | DisconnectOperation
  | SetWorkflowPropertyOperation
  | AddTagOperation
  | RemoveTagOperation;

export interface ApplyOpsRequest {
  workflowId: number;
  ops: PatchOperation[];
}

export interface OperationError {
  operationIndex: number;
  operation: PatchOperation;
  error: string;
  details?: any;
}

export interface ApplyOpsResponse {
  success: boolean;
  workflow?: N8nWorkflow;
  errors?: OperationError[];
}