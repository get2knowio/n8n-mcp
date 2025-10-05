import { 
  N8nWorkflow, 
  N8nNode, 
  N8nConnections,
  PatchOperation,
  AddNodeOperation,
  DeleteNodeOperation,
  UpdateNodeOperation,
  SetParamOperation,
  UnsetParamOperation,
  ConnectOperation,
  DisconnectOperation,
  SetWorkflowPropertyOperation,
  AddTagOperation,
  RemoveTagOperation,
  OperationError,
  ApplyOpsResponse
} from './types.js';

export class WorkflowOperationsProcessor {
  
  /**
   * Apply a batch of operations to a workflow atomically
   */
  async applyOperations(workflow: N8nWorkflow, operations: PatchOperation[] | undefined | null): Promise<ApplyOpsResponse> {
    // Create a deep copy of the workflow to work with
    const workflowCopy = JSON.parse(JSON.stringify(workflow)) as N8nWorkflow;
    const errors: OperationError[] = [];

    try {
      // Normalize operations to an empty array if undefined/null
      const ops = Array.isArray(operations) ? operations : [];

      // Apply each operation
      for (let i = 0; i < ops.length; i++) {
        const operation = ops[i];
        try {
          this.applyOperation(workflowCopy, operation);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push({
            operationIndex: i,
            operation,
            error: errorMessage,
            details: error instanceof Error ? error.stack : undefined
          });
          
          // Atomic behavior: if any operation fails, return errors without applying changes
          return {
            success: false,
            errors
          };
        }
      }

      // All operations succeeded
      return {
        success: true,
        workflow: workflowCopy
      };
    } catch (error) {
      // Unexpected error during processing
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during batch processing';
      return {
        success: false,
        errors: [{
          operationIndex: -1,
          operation: (Array.isArray(operations) && operations.length > 0 ? operations[0] : ({ type: 'unknown' } as any)),
          error: errorMessage
        }]
      };
    }
  }

  /**
   * Apply a single operation to the workflow
   */
  private applyOperation(workflow: N8nWorkflow, operation: PatchOperation): void {
    switch (operation.type) {
      case 'addNode':
        this.applyAddNode(workflow, operation);
        break;
      case 'deleteNode':
        this.applyDeleteNode(workflow, operation);
        break;
      case 'updateNode':
        this.applyUpdateNode(workflow, operation);
        break;
      case 'setParam':
        this.applySetParam(workflow, operation);
        break;
      case 'unsetParam':
        this.applyUnsetParam(workflow, operation);
        break;
      case 'connect':
        this.applyConnect(workflow, operation);
        break;
      case 'disconnect':
        this.applyDisconnect(workflow, operation);
        break;
      case 'setWorkflowProperty':
        this.applySetWorkflowProperty(workflow, operation);
        break;
      case 'addTag':
        this.applyAddTag(workflow, operation);
        break;
      case 'removeTag':
        this.applyRemoveTag(workflow, operation);
        break;
      default:
        throw new Error(`Unknown operation type: ${(operation as any).type}`);
    }
  }

  private applyAddNode(workflow: N8nWorkflow, operation: AddNodeOperation): void {
    // Check if node ID already exists
    if (workflow.nodes.some(node => node.id === operation.node.id)) {
      throw new Error(`Node with ID "${operation.node.id}" already exists`);
    }

    // Add the node
    workflow.nodes.push(operation.node);
  }

  private applyDeleteNode(workflow: N8nWorkflow, operation: DeleteNodeOperation): void {
    const nodeIndex = workflow.nodes.findIndex(node => node.id === operation.nodeId);
    if (nodeIndex === -1) {
      throw new Error(`Node with ID "${operation.nodeId}" not found`);
    }

    // Get the node name before deleting it
    const nodeName = workflow.nodes[nodeIndex].name;

    // Remove the node
    workflow.nodes.splice(nodeIndex, 1);

    // Remove all connections involving this node
    this.removeNodeConnections(workflow, nodeName);
  }

  private applyUpdateNode(workflow: N8nWorkflow, operation: UpdateNodeOperation): void {
    const node = workflow.nodes.find(node => node.id === operation.nodeId);
    if (!node) {
      throw new Error(`Node with ID "${operation.nodeId}" not found`);
    }

    // Apply updates
    Object.assign(node, operation.updates);
  }

  private applySetParam(workflow: N8nWorkflow, operation: SetParamOperation): void {
    const node = workflow.nodes.find(node => node.id === operation.nodeId);
    if (!node) {
      throw new Error(`Node with ID "${operation.nodeId}" not found`);
    }

    // Initialize parameters if they don't exist
    if (!node.parameters) {
      node.parameters = {};
    }

    // Set the parameter using dot notation
    this.setNestedProperty(node.parameters, operation.paramPath, operation.value);
  }

  private applyUnsetParam(workflow: N8nWorkflow, operation: UnsetParamOperation): void {
    const node = workflow.nodes.find(node => node.id === operation.nodeId);
    if (!node) {
      throw new Error(`Node with ID "${operation.nodeId}" not found`);
    }

    if (!node.parameters) {
      return; // Nothing to unset
    }

    // Unset the parameter using dot notation
    this.unsetNestedProperty(node.parameters, operation.paramPath);
  }

  private applyConnect(workflow: N8nWorkflow, operation: ConnectOperation): void {
    // Validate that both nodes exist
    const fromNode = workflow.nodes.find(node => node.name === operation.from.nodeName);
    const toNode = workflow.nodes.find(node => node.name === operation.to.nodeName);

    if (!fromNode) {
      throw new Error(`Source node with name "${operation.from.nodeName}" not found`);
    }
    if (!toNode) {
      throw new Error(`Target node with name "${operation.to.nodeName}" not found`);
    }

    // Initialize connections if they don't exist
    if (!workflow.connections) {
      workflow.connections = {};
    }

    const fromNodeName = operation.from.nodeName;
    const outputType = operation.from.outputType;

    if (!workflow.connections[fromNodeName]) {
      workflow.connections[fromNodeName] = {};
    }

    if (!workflow.connections[fromNodeName][outputType]) {
      workflow.connections[fromNodeName][outputType] = [];
    }

    // Ensure the output index array exists
    while (workflow.connections[fromNodeName][outputType].length <= operation.from.outputIndex) {
      workflow.connections[fromNodeName][outputType].push([]);
    }

    // Check if connection already exists
    const existingConnection = workflow.connections[fromNodeName][outputType][operation.from.outputIndex]
      .find(conn => 
        conn.node === operation.to.nodeName && 
        conn.type === operation.to.inputType && 
        conn.index === operation.to.inputIndex
      );

    if (existingConnection) {
      throw new Error(`Connection already exists from ${operation.from.nodeName}[${operation.from.outputIndex}] to ${operation.to.nodeName}[${operation.to.inputIndex}]`);
    }

    // Add the connection
    workflow.connections[fromNodeName][outputType][operation.from.outputIndex].push({
      node: operation.to.nodeName,
      type: operation.to.inputType,
      index: operation.to.inputIndex
    });
  }

  private applyDisconnect(workflow: N8nWorkflow, operation: DisconnectOperation): void {
    if (!workflow.connections) {
      throw new Error('No connections exist in workflow');
    }

    const fromNodeName = operation.from.nodeName;
    const outputType = operation.from.outputType;

    if (!workflow.connections[fromNodeName] || 
        !workflow.connections[fromNodeName][outputType] || 
        !workflow.connections[fromNodeName][outputType][operation.from.outputIndex]) {
      throw new Error(`No connection found from ${operation.from.nodeName}[${operation.from.outputIndex}]`);
    }

    const connections = workflow.connections[fromNodeName][outputType][operation.from.outputIndex];
    const connectionIndex = connections.findIndex(conn => 
      conn.node === operation.to.nodeName && 
      conn.type === operation.to.inputType && 
      conn.index === operation.to.inputIndex
    );

    if (connectionIndex === -1) {
      throw new Error(`Connection not found from ${operation.from.nodeName}[${operation.from.outputIndex}] to ${operation.to.nodeName}[${operation.to.inputIndex}]`);
    }

    // Remove the connection
    connections.splice(connectionIndex, 1);

    // Clean up empty arrays
    if (connections.length === 0) {
      workflow.connections[fromNodeName][outputType].splice(operation.from.outputIndex, 1);
      
      // Clean up empty output type
      if (workflow.connections[fromNodeName][outputType].length === 0) {
        delete workflow.connections[fromNodeName][outputType];
        
        // Clean up empty node
        if (Object.keys(workflow.connections[fromNodeName]).length === 0) {
          delete workflow.connections[fromNodeName];
        }
      }
    }
  }

  private applySetWorkflowProperty(workflow: N8nWorkflow, operation: SetWorkflowPropertyOperation): void {
    // Validate that the property exists on the workflow type
    if (!(operation.property in workflow)) {
      throw new Error(`Property "${operation.property}" does not exist on workflow`);
    }

    // Set the property
    (workflow as any)[operation.property] = operation.value;
  }

  private applyAddTag(workflow: N8nWorkflow, operation: AddTagOperation): void {
    if (!workflow.tags) {
      workflow.tags = [];
    }

    if (workflow.tags.includes(operation.tag)) {
      throw new Error(`Tag "${operation.tag}" already exists`);
    }

    workflow.tags.push(operation.tag);
  }

  private applyRemoveTag(workflow: N8nWorkflow, operation: RemoveTagOperation): void {
    if (!workflow.tags) {
      throw new Error('No tags exist on workflow');
    }

    const tagIndex = workflow.tags.indexOf(operation.tag);
    if (tagIndex === -1) {
      throw new Error(`Tag "${operation.tag}" not found`);
    }

    workflow.tags.splice(tagIndex, 1);
  }

  /**
   * Remove all connections involving a specific node by name
   */
  private removeNodeConnections(workflow: N8nWorkflow, nodeName: string): void {
    if (!workflow.connections) {
      return;
    }

    // Remove outgoing connections (where this node is the source)
    delete workflow.connections[nodeName];

    // Remove incoming connections (where this node is the target)
    for (const fromNodeName of Object.keys(workflow.connections)) {
      for (const outputType of Object.keys(workflow.connections[fromNodeName])) {
        for (let outputIndex = 0; outputIndex < workflow.connections[fromNodeName][outputType].length; outputIndex++) {
          workflow.connections[fromNodeName][outputType][outputIndex] = 
            workflow.connections[fromNodeName][outputType][outputIndex].filter(
              conn => conn.node !== nodeName
            );
        }
        
        // Clean up empty arrays - need to filter from the end to avoid index issues
        workflow.connections[fromNodeName][outputType] = 
          workflow.connections[fromNodeName][outputType].filter(arr => arr.length > 0);
        
        if (workflow.connections[fromNodeName][outputType].length === 0) {
          delete workflow.connections[fromNodeName][outputType];
        }
      }
      
      // Clean up empty nodes
      if (Object.keys(workflow.connections[fromNodeName]).length === 0) {
        delete workflow.connections[fromNodeName];
      }
    }
  }

  /**
   * Set a nested property using dot notation
   */
  private setNestedProperty(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Unset a nested property using dot notation
   */
  private unsetNestedProperty(obj: any, path: string): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        return; // Path doesn't exist
      }
      current = current[key];
    }

    delete current[keys[keys.length - 1]];
  }
}