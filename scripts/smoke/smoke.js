#!/usr/bin/env node
/**
 * Simple smoke tests for the dist CLI against a real n8n instance.
 *
 * Requirements (environment):
 *  - N8N_BASE_URL (e.g. http://localhost:5678)
 *  - N8N_API_KEY (recommended) OR N8N_USERNAME and N8N_PASSWORD
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
const repoRoot = resolve(__dirname, '../..');
dotenv.config({ path: resolve(repoRoot, '.env') });

// Configure env and basic preflight checks
const requiredEnv = ['N8N_BASE_URL'];
const hasApiKey = !!process.env.N8N_API_KEY;
const hasBasic = !!(process.env.N8N_USERNAME && process.env.N8N_PASSWORD);
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required env: ${key}`);
    process.exit(2);
  }
}
if (!hasApiKey && !hasBasic) {
  console.error('Missing credentials: set N8N_API_KEY or N8N_USERNAME + N8N_PASSWORD');
  process.exit(2);
}

process.env.MCP_ENABLE_SOURCE_MAPS = process.env.MCP_ENABLE_SOURCE_MAPS || '1';
process.env.MCP_DEBUG = process.env.MCP_DEBUG || 'debug';

const CLI = resolve(__dirname, '../../dist/cli.js');
const EXAMPLE_WORKFLOW = resolve(__dirname, '../../examples/example-workflow.json');

async function runCli(args, { timeoutMs = 20000 } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      env: process.env,
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

async function main() {
  // Ensure example workflow exists
  await fs.access(EXAMPLE_WORKFLOW);

  const results = [];
  let createdWorkflowId = null;

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
