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
    [key: string]: Array<{
      node: string;
      type: string;
      index: number;
    }>;
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

export interface N8nWebhookUrls {
  testUrl: string;
  productionUrl: string;
}

export interface N8nExecution {
  id: string;
  status: string;
  workflowId: string;
  createdAt: string;
  startedAt?: string;
  stoppedAt?: string;
  data?: any;
}

export interface N8nExecutionResponse {
  executionId: string;
  status: string;
}