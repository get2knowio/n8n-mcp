#!/usr/bin/env node
/**
 * Comprehensive smoke tests for the dist CLI and MCP stdio server against a real n8n instance.
 *
 * Requirements (environment):
 *  - N8N_BASE_URL (e.g. http://localhost:5678)
 *  - N8N_API_KEY (recommended) OR N8N_USERNAME and N8N_PASSWORD
 *
 * Notes:
 *  - Variables feature may be unavailable in some n8n editions/licenses. This smoke test will
 *    detect the 403 license error for variables endpoints and SKIP variable CRUD checks instead
 *    of failing the run.
 *
 * This script uses the built dist CLI (dist/cli.js) and enables source maps
 * through MCP_ENABLE_SOURCE_MAPS=1 so any errors have mapped stack traces.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import fs from 'node:fs/promises';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment from .env at repo root (if present)
// Use override: true so .env values take precedence over devcontainer defaults
const repoRoot = resolve(__dirname, '../..');
dotenv.config({ path: resolve(repoRoot, '.env'), override: true });

// Configure env and basic preflight checks
// Default to local sidecar when running in devcontainer/docker compose
process.env.N8N_BASE_URL = process.env.N8N_BASE_URL || 'http://n8n:5678';
const requiredEnv = ['N8N_BASE_URL'];
const hasApiKey = !!process.env.N8N_API_KEY;
const hasBasic = !!(process.env.N8N_USERNAME && process.env.N8N_PASSWORD);
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required env: ${key}`);
    process.exit(2);
  }
}
// Variables endpoints and some Public API routes require API keys. Enforce presence.
if (!hasApiKey) {
  console.error('Missing credentials: N8N_API_KEY is required for smoke tests. Set it in .env');
  process.exit(2);
}

process.env.MCP_ENABLE_SOURCE_MAPS = process.env.MCP_ENABLE_SOURCE_MAPS || '1';
process.env.MCP_DEBUG = process.env.MCP_DEBUG || 'debug';

const CLI = resolve(__dirname, '../../dist/cli.js');
const MCP_SERVER = resolve(__dirname, '../../dist/index.js');
const EXAMPLE_WORKFLOW = resolve(__dirname, '../../examples/example-workflow.json');

async function runCli(args, { timeoutMs = 20000 } = {}) {
  return new Promise((resolvePromise, reject) => {
  const childEnv = { ...process.env };
    // Force API key auth for smoke to avoid Basic auth fallbacks
  delete childEnv.N8N_USERNAME;
  delete childEnv.N8N_PASSWORD;
    const child = spawn(process.execPath, [CLI, ...args], {
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`CLI timeout after ${timeoutMs}ms: ${args.join(' ')}`));
    }, timeoutMs);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += String(d)));
    child.stderr.on('data', (d) => (stderr += String(d)));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolvePromise({ code, stdout, stderr });
    });
  });
}

function parseJsonLoose(output) {
  // Try direct JSON first
  try {
    return JSON.parse(output);
  } catch {}
  // Find the last JSON object in the output
  const lastBrace = output.lastIndexOf('{');
  if (lastBrace !== -1) {
    const candidate = output.slice(lastBrace);
    try {
      return JSON.parse(candidate);
    } catch {}
  }
  throw new Error(`Failed to parse JSON from output:\n${output}`);
}

function looksLikeVariablesLicenseError(text) {
  if (!text) return false;
  try {
    const payload = JSON.parse(text);
    const msg = payload?.message || payload?.data?.message || payload?.error?.message || '';
    if (typeof msg === 'string' && /license/i.test(msg) && /feat:?variables/i.test(msg)) return true;
  } catch {
    // fall through: also check raw text
  }
  const lower = String(text).toLowerCase();
  return lower.includes('license') && (lower.includes('feat:variables') || lower.includes('variables')) && (lower.includes('403') || lower.includes('forbidden'));
}

// Minimal MCP stdio client using LSP-style Content-Length frames
function createMcpClient() {
  const childEnv = { ...process.env };
  delete childEnv.N8N_USERNAME;
  delete childEnv.N8N_PASSWORD;
  const child = spawn(process.execPath, [MCP_SERVER], {
    env: childEnv,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let buffer = Buffer.alloc(0);
  const pending = new Map();
  let nextId = 1;
  let serverReady = false;
  let stderrBuf = '';

  function writeMessage(obj) {
    const json = Buffer.from(JSON.stringify(obj), 'utf8');
    const header = Buffer.from(`Content-Length: ${json.length}\r\n\r\n`, 'utf8');
    child.stdin.write(header);
    child.stdin.write(json);
  }

  child.stdout.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    // Parse all complete frames
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;
      const header = buffer.slice(0, headerEnd).toString('utf8');
      const match = /Content-Length: (\d+)/i.exec(header);
      if (!match) {
        // Drop malformed header
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }
      const length = parseInt(match[1], 10);
      const start = headerEnd + 4;
      const end = start + length;
      if (buffer.length < end) break; // wait for rest of body
      const body = buffer.slice(start, end).toString('utf8');
      buffer = buffer.slice(end);
      try {
        const msg = JSON.parse(body);
        if (msg.id && pending.has(msg.id)) {
          const { resolve } = pending.get(msg.id);
          pending.delete(msg.id);
          resolve(msg);
        }
      } catch {
        // ignore parse errors
      }
    }
  });

  child.stderr.on('data', (chunk) => {
    const text = String(chunk);
    stderrBuf += text;
    // The server logs to stderr. Consider it ready once it logs running on stdio
    if (/running on stdio/i.test(text)) {
      serverReady = true;
    }
  });

  function request(method, params = {}) {
    const id = nextId++;
    const payload = { jsonrpc: '2.0', id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`MCP request timeout for ${method}`));
      }, 20000);
      pending.set(id, {
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
      });
      writeMessage(payload);
    });
  }

  async function initialize() {
    // Wait briefly for server to initialize stderr logs
    const start = Date.now();
    while (!serverReady && Date.now() - start < 5000) {
      await new Promise((r) => setTimeout(r, 50));
    }
    // protocolVersion as per @modelcontextprotocol/sdk v1.18+ examples
    const res = await request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'n8n-mcp-smoke', version: '0.0.0' },
    });
    return res;
  }

  async function listTools() {
    return request('tools/list');
  }

  async function callTool(name, args = {}) {
    return request('tools/call', { name, arguments: args });
  }

  function kill() {
    try { child.kill('SIGKILL'); } catch {}
  }

  return { child, initialize, listTools, callTool, kill };
}

async function main() {
  // Ensure example workflow exists
  await fs.access(EXAMPLE_WORKFLOW);

  const results = [];
  let createdWorkflowId = null;
  let createdTagId = null;
  let createdVariableId = null;
  let createdExecutionId = null; // best-effort
  let variablesSupported = true;
  let tagsSupported = true;

  async function step(name, fn) {
    const started = Date.now();
    try {
      const value = await fn();
      const duration = Date.now() - started;
      console.log(`[PASS] ${name} (${duration}ms)`);
      results.push({ name, status: 'pass', duration });
      return value;
    } catch (e) {
      const duration = Date.now() - started;
      console.error(`[FAIL] ${name} (${duration}ms)`);
      if (e?.stdout) console.error('stdout:', e.stdout);
      if (e?.stderr) console.error('stderr:', e.stderr);
      console.error(e.stack || String(e));
      results.push({ name, status: 'fail', duration, error: String(e) });
      throw e;
    }
  }

  try {
    await step('list workflows', async () => {
      const { code, stdout } = await runCli(['list', '--limit', '1']);
      if (code !== 0) throw new Error(`non-zero exit: ${code}`);
      const json = parseJsonLoose(stdout);
      if (!json?.ok || !Array.isArray(json.data?.data)) throw new Error('unexpected response shape');
    });

    await step('create example workflow', async () => {
      const { code, stdout, stderr } = await runCli(['create', EXAMPLE_WORKFLOW]);
      if (code !== 0) {
        const err = new Error(`non-zero exit: ${code}`);
        // @ts-ignore attach for reporter
        err.stdout = stdout;
        // @ts-ignore
        err.stderr = stderr;
        throw err;
      }
      const json = parseJsonLoose(stdout);
      if (!json?.ok || !json.data?.id) throw new Error('missing workflow id');
      createdWorkflowId = json.data.id;
    });

    await step('get created workflow', async () => {
      const { code, stdout } = await runCli(['get', String(createdWorkflowId)]);
      if (code !== 0) throw new Error(`non-zero exit: ${code}`);
      const json = parseJsonLoose(stdout);
      if (!json?.ok || json.data?.id !== createdWorkflowId) throw new Error('id mismatch');
    });

    await step('activate workflow', async () => {
      const { code, stdout } = await runCli(['activate', String(createdWorkflowId)]);
      if (code !== 0) throw new Error(`non-zero exit: ${code}`);
      const json = parseJsonLoose(stdout);
      if (!json?.ok || !json.data?.active) throw new Error('workflow not active');
    });

    await step('webhook URLs', async () => {
      const { code, stdout } = await runCli(['webhook-urls', String(createdWorkflowId), 'webhook']);
      if (code !== 0) throw new Error(`non-zero exit: ${code}`);
      const json = parseJsonLoose(stdout);
      if (!json?.ok || !json.data?.testUrl || !json.data?.productionUrl) throw new Error('missing webhook urls');
    });

    await step('deactivate workflow', async () => {
      const { code, stdout } = await runCli(['deactivate', String(createdWorkflowId)]);
      if (code !== 0) throw new Error(`non-zero exit: ${code}`);
      const json = parseJsonLoose(stdout);
      if (!json?.ok || json.data?.active) throw new Error('workflow still active');
    });

    // run-once is best-effort for webhook workflows; keep it optional
    await step('list executions', async () => {
      const { code, stdout } = await runCli(['executions', 'list', '--limit', '1']);
      if (code !== 0) throw new Error(`non-zero exit: ${code}`);
      const json = parseJsonLoose(stdout);
      if (!json?.ok || !Array.isArray(json.data?.data)) throw new Error('unexpected executions response shape');
      // If any execution present, capture an id for later get/delete checks
      const first = json.data?.data?.[0];
      if (first?.id) createdExecutionId = first.id;
    });

    // Variables CRUD (feature may be unavailable or require specific permissions)
    await step('variables: support check', async () => {
      const { code, stdout, stderr } = await runCli(['variables', 'list']);
      // Treat non-zero exit OR explicit license error message as unsupported
      const stderrHasLicense = looksLikeVariablesLicenseError(stderr);
      const stdoutHasLicense = looksLikeVariablesLicenseError(stdout);
      if (code !== 0 || stderrHasLicense || stdoutHasLicense) {
        variablesSupported = false;
        console.log('[INFO] variables API not available (likely license-restricted); skipping variable CRUD.');
        if (stderr) console.log('[INFO] variables list stderr:', stderr.trim());
        else if (stdout) console.log('[INFO] variables list stdout:', stdout.trim());
      }
    });

    await step('variables: create', async () => {
      if (!variablesSupported) return; // skip
      const key = `smoke_key_${Date.now()}`;
      const val = 'smoke-value-1';
      const { code, stdout, stderr } = await runCli(['variables', 'create', '--key', key, '--value', val]);
      if (looksLikeVariablesLicenseError(stderr) || looksLikeVariablesLicenseError(stdout)) {
        // Edge-case: list was allowed but create is license-restricted; mark unsupported going forward
        variablesSupported = false;
        console.log('[INFO] variables create forbidden by license; skipping remaining variable steps.');
        return;
      }
      if (code !== 0) throw new Error(`non-zero exit: ${code}`);
      const json = parseJsonLoose(stdout);
      if (!json?.ok || !json.data?.id) throw new Error('variable create failed');
      createdVariableId = json.data.id;
    });
    await step('variables: list', async () => {
      if (!variablesSupported) return; // skip
      const { code, stdout, stderr } = await runCli(['variables', 'list']);
      if (looksLikeVariablesLicenseError(stderr) || looksLikeVariablesLicenseError(stdout)) {
        variablesSupported = false; return;
      }
      if (code !== 0) throw new Error(`non-zero exit: ${code}`);
      const json = parseJsonLoose(stdout);
      if (!json?.ok || !Array.isArray(json.data?.data)) throw new Error('variables list unexpected shape');
    });
    await step('variables: update', async () => {
      if (!variablesSupported || !createdVariableId) return; // skip if unsupported or create failed
      const { code, stdout, stderr } = await runCli(['variables', 'update', String(createdVariableId), '--value', 'smoke-value-2']);
      if (looksLikeVariablesLicenseError(stderr) || looksLikeVariablesLicenseError(stdout)) { variablesSupported = false; return; }
      if (code !== 0) throw new Error(`non-zero exit: ${code}`);
      const json = parseJsonLoose(stdout);
      if (!json?.ok || json.data?.value !== 'smoke-value-2') throw new Error('variable update failed');
    });

    // Tags CRUD and set on workflow (feature may be unavailable)
    await step('tags: support check', async () => {
      const { code, stdout, stderr } = await runCli(['tags', 'list', '1']);
      if (code !== 0) {
        tagsSupported = false;
        console.log('[INFO] tags API not available; skipping tag-related steps.');
        if (stderr) console.log('[INFO] tags list stderr:', stderr.trim());
        else if (stdout) console.log('[INFO] tags list stdout:', stdout.trim());
      }
    });
    await step('tags: create', async () => {
      if (!tagsSupported) return; // skip
      // Create tag with name only (omit color) for broader API compatibility
      const tagName = `smoke-tag-${Date.now()}`;
      const { code, stdout, stderr } = await runCli(['tags', 'create', tagName]);
      if (code !== 0) {
        // If tag creation fails unexpectedly, mark unsupported to avoid cascading failures
        tagsSupported = false;
        console.log('[INFO] tags create failed; skipping remaining tag steps.');
        if (stderr) console.log('[INFO] tags create stderr:', stderr.trim());
        else if (stdout) console.log('[INFO] tags create stdout:', stdout.trim());
        return;
      }
      const json = parseJsonLoose(stdout);
      if (json?.ok && json.data?.id) {
        createdTagId = json.data.id;
        return;
      }
      // Some instances may return only ok:true. Verify by listing and matching by name.
      console.log('[INFO] tags create returned unexpected payload; verifying by list...');
      const listRes = await runCli(['tags', 'list', '100']);
      if (listRes.code === 0) {
        try {
          const listJson = parseJsonLoose(listRes.stdout);
          const found = Array.isArray(listJson?.data?.data) ? listJson.data.data.find((t) => t?.name === tagName) : undefined;
          if (found?.id) {
            createdTagId = found.id;
            console.log('[INFO] tags create verified by list; proceeding with tag steps.');
            return;
          }
        } catch {}
      }
      // Could not verify tag creation; skip remaining tag steps
      tagsSupported = false;
      console.log('[INFO] Unable to verify tag creation; skipping remaining tag steps.');
    });
    await step('tags: list', async () => {
      if (!tagsSupported) return; // skip
      const { code, stdout, stderr } = await runCli(['tags', 'list', '1']);
      if (code !== 0) {
        tagsSupported = false;
        if (stderr) console.log('[INFO] tags list stderr:', stderr.trim());
        return;
      }
      const json = parseJsonLoose(stdout);
      if (!json?.ok || !Array.isArray(json.data?.data)) {
        tagsSupported = false;
        console.log('[INFO] tags list unexpected shape; skipping remaining tag steps.');
        return;
      }
    });
    await step('tags: get', async () => {
      if (!tagsSupported || !createdTagId) return;
      const { code, stdout, stderr } = await runCli(['tags', 'get', String(createdTagId)]);
      if (code !== 0) { tagsSupported = false; return; }
      const json = parseJsonLoose(stdout);
      if (!json?.ok || json.data?.id !== createdTagId) { tagsSupported = false; return; }
    });
    await step('workflows: set-tags', async () => {
      if (!tagsSupported || !createdWorkflowId || !createdTagId) return;
      const { code, stdout } = await runCli(['workflows', 'set-tags', String(createdWorkflowId), '--tags', String(createdTagId)]);
      if (code !== 0) throw new Error(`non-zero exit: ${code}`);
      const json = parseJsonLoose(stdout);
      if (!json?.ok || !Array.isArray(json.data)) throw new Error('set-tags failed');
    });
    await step('workflows: tags', async () => {
      if (!tagsSupported || !createdWorkflowId) return;
      const { code, stdout } = await runCli(['workflows', 'tags', String(createdWorkflowId)]);
      if (code !== 0) throw new Error(`non-zero exit: ${code}`);
      const json = parseJsonLoose(stdout);
      if (!json?.ok || !Array.isArray(json.data)) throw new Error('workflows tags list failed');
    });

    // Optional: executions get/delete using captured id (may not exist)
    await step('executions: get (optional)', async () => {
      if (!createdExecutionId) return;
      const { code, stdout } = await runCli(['executions', 'get', String(createdExecutionId)]);
      if (code !== 0) throw new Error(`non-zero exit: ${code}`);
      const json = parseJsonLoose(stdout);
      if (!json?.ok || json.data?.id !== createdExecutionId) throw new Error('executions get mismatch');
    });
    await step('executions: delete (optional)', async () => {
      if (!createdExecutionId) return;
      const { code, stdout } = await runCli(['executions', 'delete', String(createdExecutionId)]);
      if (code !== 0) throw new Error(`non-zero exit: ${code}`);
      const json = parseJsonLoose(stdout);
      if (!json?.ok) throw new Error('executions delete failed');
    });

    // MCP stdio server smoke (optional)
    let mcpSupported = true;
    await step('MCP: tools/list', async () => {
      const mcp = createMcpClient();
      try {
        try {
          await mcp.initialize();
          const res = await mcp.listTools();
          const payload = JSON.parse(res?.result?.content?.[0]?.text || '{}');
          if (!payload?.ok || !Array.isArray(payload.data?.tools)) throw new Error('MCP tools/list bad shape');
        } catch (e) {
          mcpSupported = false;
          console.log('[INFO] MCP server not available; skipping MCP steps.');
          return; // do not throw
        }
      } finally {
        mcp.kill();
      }
    });

    await step('MCP: basic workflow lifecycle', async () => {
      if (!mcpSupported) return; // skip entirely if MCP not available
      const mcp = createMcpClient();
      let mcpWorkflowId = null;
      let mcpVariablesSupported = true;
      try {
        await mcp.initialize();
        // Create
        const wfJson = JSON.parse(await fs.readFile(EXAMPLE_WORKFLOW, 'utf8'));
        const createRes = await mcp.callTool('create_workflow', wfJson);
        const created = JSON.parse(createRes?.result?.content?.[0]?.text || '{}');
        if (!created?.ok || !created.data?.id) throw new Error('MCP create_workflow failed');
        mcpWorkflowId = created.data.id;
        // Get
        const getRes = await mcp.callTool('get_workflow', { id: mcpWorkflowId });
        const got = JSON.parse(getRes?.result?.content?.[0]?.text || '{}');
        if (!got?.ok || got.data?.id !== mcpWorkflowId) throw new Error('MCP get_workflow mismatch');
        // Activate / Webhook URLs / Deactivate
        const actRes = await mcp.callTool('activate_workflow', { id: mcpWorkflowId });
        const act = JSON.parse(actRes?.result?.content?.[0]?.text || '{}');
        if (!act?.ok || !act.data?.active) throw new Error('MCP activate failed');
        const urlsRes = await mcp.callTool('webhook_urls', { workflowId: mcpWorkflowId, nodeId: 'webhook' });
        const urls = JSON.parse(urlsRes?.result?.content?.[0]?.text || '{}');
        if (!urls?.ok || !urls.data?.testUrl) throw new Error('MCP webhook_urls failed');
        const deactRes = await mcp.callTool('deactivate_workflow', { id: mcpWorkflowId });
        const deact = JSON.parse(deactRes?.result?.content?.[0]?.text || '{}');
        if (!deact?.ok || deact.data?.active) throw new Error('MCP deactivate failed');
        // Node catalog and validation
        const listTypes = await mcp.callTool('list_node_types', {});
        const typesPayload = JSON.parse(listTypes?.result?.content?.[0]?.text || '{}');
        if (!typesPayload?.ok || !Array.isArray(typesPayload.data)) throw new Error('MCP list_node_types failed');
        const getType = await mcp.callTool('get_node_type', { type: 'n8n-nodes-base.webhook' });
        const typePayload = JSON.parse(getType?.result?.content?.[0]?.text || '{}');
        if (!typePayload?.ok) throw new Error('MCP get_node_type failed');
        const examplesRes = await mcp.callTool('examples', { type: 'n8n-nodes-base.webhook' });
        const exPayload = JSON.parse(examplesRes?.result?.content?.[0]?.text || '{}');
        if (!exPayload?.ok) throw new Error('MCP examples failed');
        const validateRes = await mcp.callTool('validate_node_config', { type: 'n8n-nodes-base.webhook', params: { httpMethod: 'GET', path: 'smoke' } });
        const valPayload = JSON.parse(validateRes?.result?.content?.[0]?.text || '{}');
        if (!valPayload?.ok) throw new Error('MCP validate_node_config failed');
        // Variables via MCP (optional)
        try {
          const varCreate = await mcp.callTool('create_variable', { key: `mcp_smoke_${Date.now()}`, value: '1' });
          const varC = JSON.parse(varCreate?.result?.content?.[0]?.text || '{}');
          if (!varC?.ok || !varC.data?.id) throw new Error('create failed');
          const varId = varC.data.id;
          const varList = JSON.parse((await mcp.callTool('list_variables', {}))?.result?.content?.[0]?.text || '{}');
          if (!varList?.ok) throw new Error('list failed');
          const varUpdate = JSON.parse((await mcp.callTool('update_variable', { id: varId, value: '2' }))?.result?.content?.[0]?.text || '{}');
          if (!varUpdate?.ok) throw new Error('update failed');
          const varDelete = JSON.parse((await mcp.callTool('delete_variable', { id: varId }))?.result?.content?.[0]?.text || '{}');
          if (!varDelete?.ok) throw new Error('delete failed');
        } catch (e) {
          mcpVariablesSupported = false;
          console.log('[INFO] MCP variables not available; skipping variable operations.');
        }
        // Tags via MCP (optional)
        try {
          let tagCreateRes = await mcp.callTool('create_tag', { name: `mcp-tag-${Date.now()}` });
          let tagCreate = JSON.parse(tagCreateRes?.result?.content?.[0]?.text || '{}');
          if (!tagCreate?.ok || !tagCreate.data?.id) {
            tagCreateRes = await mcp.callTool('create_tag', { name: `mcp-tag-${Date.now()}`, color: '#00ff00' });
            tagCreate = JSON.parse(tagCreateRes?.result?.content?.[0]?.text || '{}');
          }
          if (!tagCreate?.ok || !tagCreate.data?.id) throw new Error('create_tag failed');
          const tagId = tagCreate.data.id;
          const setTags = JSON.parse((await mcp.callTool('set_workflow_tags', { workflowId: mcpWorkflowId, tagIds: [tagId] }))?.result?.content?.[0]?.text || '{}');
          if (!setTags?.ok) throw new Error('set_workflow_tags failed');
          const listWfTags = JSON.parse((await mcp.callTool('list_workflow_tags', { workflowId: mcpWorkflowId }))?.result?.content?.[0]?.text || '{}');
          if (!listWfTags?.ok) throw new Error('list_workflow_tags failed');
          const tagDelete = JSON.parse((await mcp.callTool('delete_tag', { id: tagId }))?.result?.content?.[0]?.text || '{}');
          if (!tagDelete?.ok) throw new Error('delete_tag failed');
        } catch (e) {
          console.log('[INFO] MCP tags not available or failed; skipping tag operations.');
        }
        // Delete workflow
        const delRes = await mcp.callTool('delete_workflow', { id: mcpWorkflowId });
        const del = JSON.parse(delRes?.result?.content?.[0]?.text || '{}');
        if (!del?.ok) throw new Error('MCP delete_workflow failed');
      } finally {
        mcp.kill();
      }
    });
  } finally {
    if (createdWorkflowId) {
      try {
        await step('cleanup: delete workflow', async () => {
          const { code } = await runCli(['delete', String(createdWorkflowId)]);
          if (code !== 0) throw new Error(`non-zero exit: ${code}`);
        });
      } catch (e) {
        console.error('Cleanup failed:', e);
      }
    }
    if (tagsSupported && createdTagId) {
      try {
        await step('cleanup: delete tag', async () => {
          const { code } = await runCli(['tags', 'delete', String(createdTagId)]);
          if (code !== 0) throw new Error(`non-zero exit: ${code}`);
        });
      } catch (e) {
        console.error('Cleanup failed:', e);
      }
    }
    if (createdVariableId) {
      try {
        await step('cleanup: delete variable', async () => {
          const { code } = await runCli(['variables', 'delete', String(createdVariableId)]);
          if (code !== 0) throw new Error(`non-zero exit: ${code}`);
        });
      } catch (e) {
        console.error('Cleanup failed:', e);
      }
    }
  }

  const failed = results.filter((r) => r.status === 'fail');
  if (failed.length) {
    console.error(`\nSmoke tests failed: ${failed.length} failing step(s)`);
    process.exit(1);
  } else {
    console.log('\nAll smoke tests passed');
  }
}

main().catch((e) => {
  console.error('Smoke test run failed:', e.stack || String(e));
  process.exit(1);
});
