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
  nextCursor?: string;
}

export interface N8nCredential {
  id?: number;
  name: string;
  type: string;
  data?: Record<string, any>;
  projectId?: string;
  ownerId?: string;
}

export interface TransferRequest {
  projectId?: string;
  newOwnerId?: string;
}

export interface TransferResponse {
  id: number;
  projectId?: string;
  newOwnerId?: string;
}

export interface N8nTag {
  id?: number | string;
  name: string;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface N8nTagsListResponse {
  data: N8nTag[];
  nextCursor?: string;
}

export interface N8nVariable {
  id?: string;
  key: string;
  value: string;
}

export interface N8nVariablesListResponse {
  data: N8nVariable[];
  nextCursor?: string;
}

export interface N8nConfig {
  baseUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
}

// Node type metadata interfaces
export interface N8nNodeType {
  name: string;
  displayName: string;
  description: string;
  version: number | number[];
  defaults: {
    name: string;
    color?: string;
  };
  inputs: string[];
  outputs: string[];
  properties: N8nNodeProperty[];
  credentials?: N8nCredentialType[];
  category?: string;
  supportedAuthenticationTypes?: string[];
}

export interface N8nNodeProperty {
  displayName: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'options' | 'multiOptions' | 'collection' | 'fixedCollection' | 'credentials' | 'hidden' | 'notice';
  required?: boolean;
  default?: any;
  description?: string;
  options?: Array<{
    name: string;
    value: string | number | boolean;
    description?: string;
  }>;
  placeholder?: string;
  displayOptions?: {
    show?: Record<string, any[]>;
    hide?: Record<string, any[]>;
  };
  typeOptions?: {
    minValue?: number;
    maxValue?: number;
    multipleValues?: boolean;
    multipleValueButtonText?: string;
  };
  routing?: any;
  extractValue?: any;
}

export interface N8nCredentialType {
  name: string;
  required?: boolean;
}

export interface N8nNodeExample {
  name: string;
  description: string;
  workflow: {
    nodes: N8nNode[];
    connections: N8nConnections;
  };
}

export interface ValidationError {
  property: string;
  message: string;
  code: 'MISSING_REQUIRED' | 'INVALID_ENUM' | 'INVALID_TYPE' | 'INVALID_RANGE' | 'MISSING_CREDENTIAL';
  expected?: any;
  actual?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
// Types for granular node operations (graph mutations)
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

export interface N8nExecution {
  id: string;
  finished: boolean;
  mode: string;
  retryOf?: string;
  retrySuccessId?: string;
  startedAt: string;
  stoppedAt?: string;
  workflowId: string;
  waitTill?: string;
  status: 'new' | 'running' | 'success' | 'failed' | 'canceled' | 'crashed' | 'waiting';
  data?: {
    resultData?: {
      runData?: Record<string, any>;
      lastNodeExecuted?: string;
      error?: {
        name?: string;
        message?: string;
        description?: string;
        stack?: string;
      };
    };
    executionData?: {
      contextData?: Record<string, any>;
      nodeExecutionStack?: any[];
      metadata?: Record<string, any>;
      waitingExecution?: Record<string, any>;
      waitingExecutionSource?: Record<string, any>;
    };
  };
}

export interface N8nExecutionsListResponse {
  data: N8nExecution[];
  nextCursor?: string;
}

export interface N8nExecutionDeleteResponse {
  success: boolean;
}

export interface N8nWebhookUrls {
  testUrl: string;
  productionUrl: string;
}

export interface N8nExecutionResponse {
  executionId: string;
  status: string;
}

export interface N8nCredentialSchema {
  type: string;
  displayName: string;
  name: string;
  properties: Record<string, any>;
  required?: string[];
  description?: string;
  icon?: string;
  iconUrl?: string;
  category?: string;
}

export interface N8nSourceControlPullResponse {
  ok: boolean;
  commit?: string;
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