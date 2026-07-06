import { describe, it, expect } from '@jest/globals';
import { validateWorkflow, validateConnections, validateExpressions } from '../workflow-validator';
import { N8nNode, N8nConnections } from '../types';

function node(overrides: Partial<N8nNode> & { id: string; name: string; type: string }): N8nNode {
  return {
    typeVersion: 1,
    position: [0, 0],
    parameters: {},
    ...overrides,
  };
}

describe('validateWorkflow', () => {
  it('accepts a simple valid webhook -> noOp workflow', () => {
    const nodes = [
      node({ id: 'wh', name: 'Webhook', type: 'n8n-nodes-base.webhook', parameters: { httpMethod: 'GET', path: 'x' } }),
      node({ id: 'no', name: 'No Op', type: 'n8n-nodes-base.noOp' }),
    ];
    const connections: N8nConnections = {
      Webhook: { main: [[{ node: 'No Op', type: 'main', index: 0 }]] },
    };

    const result = validateWorkflow({ nodes, connections });
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('flags an empty workflow', () => {
    const result = validateWorkflow({ nodes: [], connections: {} });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'EMPTY_WORKFLOW')).toBe(true);
  });

  it('flags duplicate node names', () => {
    const nodes = [
      node({ id: 'a', name: 'Dup', type: 'n8n-nodes-base.noOp' }),
      node({ id: 'b', name: 'Dup', type: 'n8n-nodes-base.noOp' }),
    ];
    const result = validateWorkflow({ nodes, connections: {} });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'DUPLICATE_NODE_NAME')).toBe(true);
  });

  it('warns (not errors) when there is no trigger node', () => {
    const nodes = [node({ id: 'a', name: 'Op', type: 'n8n-nodes-base.noOp' })];
    const result = validateWorkflow({ nodes, connections: {} });
    const issue = result.issues.find((i) => i.code === 'MISSING_TRIGGER');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('warning');
  });

  it('flags an orphaned node with no connections', () => {
    const nodes = [
      node({ id: 'wh', name: 'Webhook', type: 'n8n-nodes-base.webhook', parameters: { httpMethod: 'GET', path: 'x' } }),
      node({ id: 'orphan', name: 'Orphan', type: 'n8n-nodes-base.noOp' }),
    ];
    const result = validateWorkflow({ nodes, connections: {} });
    expect(result.issues.some((i) => i.code === 'ORPHANED_NODE' && i.node === 'Orphan')).toBe(true);
  });
});

describe('validateConnections', () => {
  const nodes = [
    node({ id: 'a', name: 'A', type: 'n8n-nodes-base.noOp' }),
    node({ id: 'b', name: 'B', type: 'n8n-nodes-base.noOp' }),
  ];

  it('accepts correctly nested array-of-arrays connections', () => {
    const connections: N8nConnections = { A: { main: [[{ node: 'B', type: 'main', index: 0 }]] } };
    const issues = validateConnections({ nodes, connections });
    expect(issues).toHaveLength(0);
  });

  it('flags an unknown source node', () => {
    const connections: N8nConnections = { Ghost: { main: [[{ node: 'B', type: 'main', index: 0 }]] } } as any;
    const issues = validateConnections({ nodes, connections });
    expect(issues.some((i) => i.code === 'UNKNOWN_SOURCE_NODE')).toBe(true);
  });

  it('flags an unknown target node', () => {
    const connections: N8nConnections = { A: { main: [[{ node: 'Ghost', type: 'main', index: 0 }]] } };
    const issues = validateConnections({ nodes, connections });
    expect(issues.some((i) => i.code === 'UNKNOWN_TARGET_NODE')).toBe(true);
  });

  it('flags missing array-of-arrays nesting (edge object instead of array-of-arrays)', () => {
    const connections: any = { A: { main: [{ node: 'B', type: 'main', index: 0 }] } };
    const issues = validateConnections({ nodes, connections });
    expect(issues.some((i) => i.code === 'INVALID_CONNECTION_NESTING')).toBe(true);
  });

  it('flags a connection type key that is not an array at all', () => {
    const connections: any = { A: { main: { node: 'B' } } };
    const issues = validateConnections({ nodes, connections });
    expect(issues.some((i) => i.code === 'INVALID_CONNECTION_NESTING')).toBe(true);
  });
});

describe('validateExpressions', () => {
  const trigger = node({ id: 'wh', name: 'Webhook', type: 'n8n-nodes-base.webhook' });

  it('flags an expression missing the leading = prefix', () => {
    const nodes = [
      trigger,
      node({ id: 'set', name: 'Set', type: 'n8n-nodes-base.set', parameters: { value: '{{ $json.foo }}' } }),
    ];
    const issues = validateExpressions({ nodes, connections: {} });
    expect(issues.some((i) => i.code === 'MISSING_EXPRESSION_PREFIX')).toBe(true);
  });

  it('accepts a properly prefixed expression', () => {
    const nodes = [
      trigger,
      node({ id: 'set', name: 'Set', type: 'n8n-nodes-base.set', parameters: { value: '={{ $json.foo }}' } }),
    ];
    const issues = validateExpressions({ nodes, connections: {} });
    expect(issues.some((i) => i.code === 'MISSING_EXPRESSION_PREFIX')).toBe(false);
  });

  it('flags unbalanced braces', () => {
    const nodes = [
      trigger,
      node({ id: 'set', name: 'Set', type: 'n8n-nodes-base.set', parameters: { value: '={{ $json.foo }' } }),
    ];
    const issues = validateExpressions({ nodes, connections: {} });
    expect(issues.some((i) => i.code === 'UNBALANCED_EXPRESSION_BRACES')).toBe(true);
  });

  it('warns on a reference to a node that does not exist in the workflow', () => {
    const nodes = [
      trigger,
      node({ id: 'set', name: 'Set', type: 'n8n-nodes-base.set', parameters: { value: "={{ $node['Ghost'].json.foo }}" } }),
    ];
    const issues = validateExpressions({ nodes, connections: {} });
    const issue = issues.find((i) => i.code === 'UNKNOWN_NODE_REFERENCE');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('warning');
  });

  it('does not flag a reference to a node that exists in the workflow', () => {
    const nodes = [
      trigger,
      node({ id: 'set', name: 'Set', type: 'n8n-nodes-base.set', parameters: { value: "={{ $node['Webhook'].json.foo }}" } }),
    ];
    const issues = validateExpressions({ nodes, connections: {} });
    expect(issues.some((i) => i.code === 'UNKNOWN_NODE_REFERENCE')).toBe(false);
  });

  it('walks nested parameter objects/arrays for expression strings', () => {
    const nodes = [
      trigger,
      node({
        id: 'set',
        name: 'Set',
        type: 'n8n-nodes-base.set',
        parameters: { fields: { values: [{ name: 'x', value: '{{ $json.bad }}' }] } },
      }),
    ];
    const issues = validateExpressions({ nodes, connections: {} });
    const issue = issues.find((i) => i.code === 'MISSING_EXPRESSION_PREFIX');
    expect(issue).toBeDefined();
    expect(issue?.path).toBe('parameters.fields.values[0].value');
  });
});
