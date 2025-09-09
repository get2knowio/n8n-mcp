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