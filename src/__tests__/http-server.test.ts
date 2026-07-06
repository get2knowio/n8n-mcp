import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

// Only the n8n client is mocked so no real n8n is contacted. The SDK server and the
// StreamableHTTP transport are the real thing — this exercises a genuine HTTP round trip.
jest.mock('../n8n-client.js', () => ({
  N8nClient: jest.fn().mockImplementation(() => ({})),
}));

import { startHttpServer } from '../http-server.js';

const TOKEN = 'test-secret-token';
const ACCEPT = 'application/json, text/event-stream';

describe('startHttpServer (Streamable HTTP transport)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.N8N_BASE_URL = 'http://test-n8n.local:5678';
    process.env.N8N_API_KEY = 'test-api-key';
    server = await startHttpServer({ port: 0, host: '127.0.0.1', token: TOKEN });
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  const initializeBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'jest', version: '0.0.0' },
    },
  };

  it('serves /healthz without auth', async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it('rejects an MCP request with no bearer token', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: ACCEPT },
      body: JSON.stringify(initializeBody),
    });
    expect(res.status).toBe(401);
  });

  it('initializes a session and lists tools over one session', async () => {
    // initialize -> expect a session id header and a valid result
    const initRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: ACCEPT, Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(initializeBody),
    });
    expect(initRes.status).toBe(200);
    const sessionId = initRes.headers.get('mcp-session-id');
    expect(sessionId).toBeTruthy();
    const initJson: any = await initRes.json();
    expect(initJson.result?.serverInfo?.name).toBe('n8n-mcp');

    // required lifecycle step before issuing further requests
    const notifyRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: ACCEPT,
        Authorization: `Bearer ${TOKEN}`,
        'mcp-session-id': sessionId!,
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });
    expect(notifyRes.status).toBeLessThan(300);

    // tools/list reuses the session — static list, no n8n call
    const listRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: ACCEPT,
        Authorization: `Bearer ${TOKEN}`,
        'mcp-session-id': sessionId!,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    });
    expect(listRes.status).toBe(200);
    const listJson: any = await listRes.json();
    expect(Array.isArray(listJson.result?.tools)).toBe(true);
    expect(listJson.result.tools.length).toBeGreaterThan(0);
    expect(listJson.result.tools.some((t: any) => t.name === 'health_check')).toBe(true);
  });

  it('rejects a non-initialize request with no session id', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: ACCEPT, Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/list' }),
    });
    expect(res.status).toBe(400);
  });
});
