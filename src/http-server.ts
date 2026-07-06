import http from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { N8nMcpServer } from './index.js';
import { logger } from './logger.js';

export interface HttpServerOptions {
  /** Port to bind. Falls back to MCP_HTTP_PORT, then PORT, then 3000. */
  port?: number;
  /** Host/interface to bind. Falls back to MCP_HTTP_HOST, then 127.0.0.1 (loopback). */
  host?: string;
  /** MCP endpoint path. Falls back to MCP_HTTP_PATH, then /mcp. */
  path?: string;
  /** Optional bearer token. Falls back to MCP_HTTP_TOKEN. When unset, no auth is enforced. */
  token?: string;
}

interface Session {
  transport: StreamableHTTPServerTransport;
  server: N8nMcpServer;
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual requires equal-length buffers; the length check itself is not
  // constant-time, but the token length is not the secret.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/**
 * Start the n8n MCP server over the Streamable HTTP transport.
 *
 * Single-tenant: every session's N8nMcpServer reads the same N8N_* env config.
 * Sessions are stateful — each gets its own N8nMcpServer instance (and thus its own
 * SDK Server + workflow-id alias maps), so per-client state stays isolated.
 */
export async function startHttpServer(options: HttpServerOptions = {}): Promise<http.Server> {
  const port = options.port ?? Number(process.env.MCP_HTTP_PORT ?? process.env.PORT ?? 3000);
  const host = options.host ?? process.env.MCP_HTTP_HOST ?? '127.0.0.1';
  const mcpPath = options.path ?? process.env.MCP_HTTP_PATH ?? '/mcp';
  const token = options.token ?? process.env.MCP_HTTP_TOKEN;

  const sessions = new Map<string, Session>();

  const authorized = (req: http.IncomingMessage): boolean => {
    if (!token) return true;
    const header = req.headers['authorization'];
    if (!header || Array.isArray(header)) return false;
    const match = /^Bearer (.+)$/.exec(header);
    return match ? tokenMatches(match[1], token) : false;
  };

  const httpServer = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host ?? host}`);

      // Liveness/preflight — intentionally unauthenticated.
      if (req.method === 'GET' && url.pathname === '/healthz') {
        sendJson(res, 200, { ok: true });
        return;
      }

      if (url.pathname !== mcpPath) {
        sendJson(res, 404, { error: 'not found' });
        return;
      }

      if (!authorized(req)) {
        sendJson(res, 401, { jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null });
        return;
      }

      const sessionIdHeader = req.headers['mcp-session-id'];
      const sessionId = typeof sessionIdHeader === 'string' ? sessionIdHeader : undefined;
      const existing = sessionId ? sessions.get(sessionId) : undefined;

      if (req.method === 'POST') {
        const raw = await readBody(req);
        let body: unknown;
        try {
          body = raw ? JSON.parse(raw) : undefined;
        } catch {
          sendJson(res, 400, { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null });
          return;
        }

        let transport: StreamableHTTPServerTransport;
        if (existing) {
          transport = existing.transport;
        } else if (!sessionId && isInitializeRequest(body)) {
          const server = new N8nMcpServer();
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            // Respond with plain JSON rather than an SSE stream — every tool here is a
            // simple request/response, and JSON is friendlier to curl/fetch clients.
            enableJsonResponse: true,
            onsessioninitialized: (id) => {
              sessions.set(id, { transport, server });
              logger.info('MCP HTTP session initialized', { sessionId: id, sessions: sessions.size });
            },
            onsessionclosed: (id) => {
              sessions.delete(id);
              logger.info('MCP HTTP session closed', { sessionId: id, sessions: sessions.size });
            },
          });
          transport.onclose = () => {
            if (transport.sessionId) sessions.delete(transport.sessionId);
          };
          await server.connect(transport);
        } else {
          sendJson(res, 400, {
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Bad Request: no valid session ID for a non-initialize request' },
            id: null,
          });
          return;
        }

        await transport.handleRequest(req, res, body);
        return;
      }

      // GET (SSE stream) and DELETE (session teardown) require an established session.
      if (req.method === 'GET' || req.method === 'DELETE') {
        if (!existing) {
          sendJson(res, 404, { jsonrpc: '2.0', error: { code: -32001, message: 'Session not found' }, id: null });
          return;
        }
        await existing.transport.handleRequest(req, res);
        return;
      }

      res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'GET, POST, DELETE' });
      res.end(JSON.stringify({ error: 'method not allowed' }));
    } catch (err) {
      logger.error('MCP HTTP request failed', { error: err instanceof Error ? err.message : String(err) });
      if (!res.headersSent) {
        sendJson(res, 500, { jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
      }
    }
  });

  await new Promise<void>((resolve) => httpServer.listen(port, host, resolve));
  const address = httpServer.address();
  const boundPort = typeof address === 'object' && address ? address.port : port;
  logger.info('N8n MCP server running on Streamable HTTP', {
    host,
    port: boundPort,
    path: mcpPath,
    authRequired: !!token,
  });
  return httpServer;
}
