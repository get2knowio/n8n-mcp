import { N8nNode, N8nConnections, WorkflowValidationIssue, WorkflowValidationResult } from './types.js';
import { getNodeType } from './node-registry.js';
import { validateNodeConfig } from './node-validator.js';

export interface WorkflowLike {
  name?: string;
  nodes: N8nNode[];
  connections: N8nConnections;
}

const TRIGGER_TYPE_PATTERN = /trigger$/i;
const TRIGGER_TYPE_ALLOWLIST = new Set([
  'n8n-nodes-base.webhook',
  'n8n-nodes-base.cron',
  'n8n-nodes-base.scheduleTrigger',
]);

function isTriggerNode(node: N8nNode): boolean {
  return TRIGGER_TYPE_ALLOWLIST.has(node.type) || TRIGGER_TYPE_PATTERN.test(node.type);
}

function issue(
  severity: WorkflowValidationIssue['severity'],
  code: string,
  message: string,
  extra?: Partial<WorkflowValidationIssue>,
): WorkflowValidationIssue {
  return { severity, code, message, ...extra };
}

/**
 * Validates the connections graph: dangling node references and the
 * array-of-arrays nesting n8n expects (`main[outputIndex][] = {node,type,index}`).
 * This is the single most common structural mistake when hand-authoring workflow JSON.
 */
export function validateConnections(workflow: WorkflowLike): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  const nodeNames = new Set(workflow.nodes.map((n) => n.name));
  const connections = workflow.connections || {};

  for (const [sourceName, outputsByType] of Object.entries(connections)) {
    if (!nodeNames.has(sourceName)) {
      issues.push(
        issue('error', 'UNKNOWN_SOURCE_NODE', `Connections reference unknown source node '${sourceName}'`, {
          node: sourceName,
        }),
      );
      continue;
    }
    if (outputsByType == null || typeof outputsByType !== 'object') continue;

    for (const [connectionType, outputs] of Object.entries(outputsByType)) {
      if (!Array.isArray(outputs)) {
        issues.push(
          issue(
            'error',
            'INVALID_CONNECTION_NESTING',
            `Connection '${sourceName}.${connectionType}' must be an array of output ports (one per output index), got ${typeof outputs}`,
            { node: sourceName, path: `${sourceName}.${connectionType}` },
          ),
        );
        continue;
      }
      outputs.forEach((port, outputIndex) => {
        if (port == null) return; // sparse output arrays are valid (unused output)
        if (!Array.isArray(port)) {
          issues.push(
            issue(
              'error',
              'INVALID_CONNECTION_NESTING',
              `Connection '${sourceName}.${connectionType}[${outputIndex}]' must itself be an array of connections (array-of-arrays), got ${typeof port}`,
              { node: sourceName, path: `${sourceName}.${connectionType}[${outputIndex}]` },
            ),
          );
          return;
        }
        port.forEach((edge: any, edgeIndex: number) => {
          if (!edge || typeof edge !== 'object') {
            issues.push(
              issue(
                'error',
                'INVALID_CONNECTION_EDGE',
                `Connection '${sourceName}.${connectionType}[${outputIndex}][${edgeIndex}]' is not a valid edge object`,
                { node: sourceName, path: `${sourceName}.${connectionType}[${outputIndex}][${edgeIndex}]` },
              ),
            );
            return;
          }
          if (!nodeNames.has(edge.node)) {
            issues.push(
              issue(
                'error',
                'UNKNOWN_TARGET_NODE',
                `Connection from '${sourceName}' targets unknown node '${edge.node}'`,
                { node: sourceName, path: `${sourceName}.${connectionType}[${outputIndex}][${edgeIndex}]` },
              ),
            );
          }
          if (edge.type && edge.type !== connectionType) {
            issues.push(
              issue(
                'warning',
                'CONNECTION_TYPE_MISMATCH',
                `Connection edge type '${edge.type}' does not match its container key '${connectionType}' for '${sourceName}' -> '${edge.node}'`,
                { node: sourceName, path: `${sourceName}.${connectionType}[${outputIndex}][${edgeIndex}]` },
              ),
            );
          }
        });
      });
    }
  }

  return issues;
}

const EXPRESSION_BRACE_RE = /\{\{|\}\}/g;
// Matches $node["Name"], $node.Name, $('Name'), $items('Name'), $("Name")
const NODE_REFERENCE_RE = /\$(?:node\[["']([^"']+)["']\]|node\.([A-Za-z0-9_]+)|\(["']([^"']+)["']\)|items\(["']([^"']+)["']\))/g;

function walkParameterStrings(value: any, path: string, visit: (value: string, path: string) => void): void {
  if (typeof value === 'string') {
    visit(value, path);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => walkParameterStrings(v, `${path}[${i}]`, visit));
  } else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      walkParameterStrings(v, path ? `${path}.${key}` : key, visit);
    }
  }
}

/**
 * Best-effort validation of n8n expressions embedded in node parameters:
 * missing the leading '=' that n8n requires to treat a string as an expression,
 * unbalanced {{ }}, and references to node names that don't exist in the workflow.
 */
export function validateExpressions(workflow: WorkflowLike): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  const nodeNames = new Set(workflow.nodes.map((n) => n.name));

  for (const node of workflow.nodes) {
    if (!node.parameters) continue;
    walkParameterStrings(node.parameters, 'parameters', (value, path) => {
      if (!value.includes('{{')) return;

      if (!value.startsWith('=')) {
        issues.push(
          issue(
            'error',
            'MISSING_EXPRESSION_PREFIX',
            `Node '${node.name}' parameter '${path}' contains '{{ }}' but is missing the leading '=' required for n8n to evaluate it as an expression`,
            { node: node.name, path },
          ),
        );
      }

      const braceTokens = value.match(EXPRESSION_BRACE_RE) || [];
      const opens = braceTokens.filter((t) => t === '{{').length;
      const closes = braceTokens.filter((t) => t === '}}').length;
      if (opens !== closes) {
        issues.push(
          issue(
            'error',
            'UNBALANCED_EXPRESSION_BRACES',
            `Node '${node.name}' parameter '${path}' has unbalanced '{{'/'}}' braces`,
            { node: node.name, path },
          ),
        );
      }

      let match: RegExpExecArray | null;
      NODE_REFERENCE_RE.lastIndex = 0;
      while ((match = NODE_REFERENCE_RE.exec(value)) !== null) {
        const referenced = match[1] || match[2] || match[3] || match[4];
        if (referenced && !nodeNames.has(referenced)) {
          issues.push(
            issue(
              'warning',
              'UNKNOWN_NODE_REFERENCE',
              `Node '${node.name}' parameter '${path}' references node '${referenced}' which does not exist in this workflow`,
              { node: node.name, path },
            ),
          );
        }
      }
    });
  }

  return issues;
}

/**
 * Structural checks that don't fit connections/expressions: empty graph,
 * duplicate node names, missing trigger, and nodes with no edges at all.
 */
function validateStructure(workflow: WorkflowLike): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  const { nodes, connections } = workflow;

  if (!nodes || nodes.length === 0) {
    issues.push(issue('error', 'EMPTY_WORKFLOW', 'Workflow has no nodes'));
    return issues;
  }

  const seenNames = new Map<string, number>();
  for (const node of nodes) {
    seenNames.set(node.name, (seenNames.get(node.name) || 0) + 1);
  }
  for (const [name, count] of seenNames) {
    if (count > 1) {
      issues.push(issue('error', 'DUPLICATE_NODE_NAME', `Node name '${name}' is used by ${count} nodes; names must be unique`, { node: name }));
    }
  }

  if (!nodes.some(isTriggerNode)) {
    issues.push(issue('warning', 'MISSING_TRIGGER', 'Workflow has no trigger node (webhook/cron/schedule/*Trigger); it can only be run manually'));
  }

  const connected = new Set<string>();
  for (const [sourceName, outputsByType] of Object.entries(connections || {})) {
    if (outputsByType == null || typeof outputsByType !== 'object') continue;
    let hasOutgoingEdge = false;
    for (const outputs of Object.values(outputsByType)) {
      if (!Array.isArray(outputs)) continue;
      for (const port of outputs) {
        if (!Array.isArray(port)) continue;
        for (const edge of port) {
          if (edge && typeof edge === 'object' && edge.node) {
            connected.add(edge.node);
            hasOutgoingEdge = true;
          }
        }
      }
    }
    if (hasOutgoingEdge) connected.add(sourceName);
  }

  const isSingleNodeWorkflow = nodes.length === 1;
  if (!isSingleNodeWorkflow) {
    for (const node of nodes) {
      if (!connected.has(node.name)) {
        issues.push(issue('warning', 'ORPHANED_NODE', `Node '${node.name}' has no incoming or outgoing connections`, { node: node.name }));
      }
    }
  }

  return issues;
}

/**
 * Aggregate whole-workflow validation: structure + connections + expressions,
 * plus per-node config validation where the (currently small) node catalog covers the type.
 * Unknown node types are skipped, not flagged — the catalog is intentionally incomplete.
 */
export function validateWorkflow(workflow: WorkflowLike): WorkflowValidationResult {
  const issues: WorkflowValidationIssue[] = [
    ...validateStructure(workflow),
    ...validateConnections(workflow),
    ...validateExpressions(workflow),
  ];

  for (const node of workflow.nodes || []) {
    if (!getNodeType(node.type)) continue; // degrade gracefully on unknown types
    const result = validateNodeConfig(node.type, node.parameters || {});
    for (const err of result.errors) {
      issues.push(
        issue('error', err.code, `Node '${node.name}': ${err.message}`, { node: node.name, path: `parameters.${err.property}` }),
      );
    }
  }

  const valid = !issues.some((i) => i.severity === 'error');
  return { valid, issues };
}
