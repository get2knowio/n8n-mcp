// Simple structured logger with levels and redaction; writes to stderr

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const levelOrder: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function envLevel(): LogLevel {
  const raw = (process.env.MCP_DEBUG || process.env.LOG_LEVEL || 'info').toLowerCase();
  if (raw === 'true') return 'debug';
  if (['error', 'warn', 'info', 'debug'].includes(raw)) return raw as LogLevel;
  return 'info';
}

let currentLevel: LogLevel = envLevel();

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

// Best-effort redaction for common secret shapes
export function redact(value: unknown): unknown {
  try {
    if (value == null) return value;
    if (typeof value === 'string') {
      return value
        .replace(/(X-N8N-API-KEY=)([^\s]+)/gi, '$1***')
        .replace(/(Authorization: )([^\s]+)/gi, '$1***')
        .replace(/(api_key|token|password|apikey|secret)("?\s*[:=]\s*"?)([^"\s]+)/gi, '$1$2***');
    }
    if (Array.isArray(value)) return value.map(redact);
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (/^(authorization|x-n8n-api-key|password|token|secret)$/i.test(k)) {
          out[k] = '***';
        } else {
          out[k] = redact(v);
        }
      }
      return out;
    }
  } catch {
    // ignore
  }
  return value;
}

function write(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (levelOrder[level] > levelOrder[currentLevel]) return;
  const payload: Record<string, unknown> = {
    level,
    time: new Date().toISOString(),
    message,
  };
  if (meta && Object.keys(meta).length) payload.meta = redact(meta);
  // Always write to stderr to avoid interfering with MCP stdout
  process.stderr.write(`${JSON.stringify(payload)}\n`);
}

export const logger = {
  error: (msg: string, meta?: Record<string, unknown>) => write('error', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => write('warn', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => write('info', msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => write('debug', msg, meta),
};

// Helper to generate short correlation IDs
export function newCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Enable deeper stacks in debug mode
if (levelOrder[currentLevel] >= levelOrder.debug) {
  // eslint-disable-next-line no-global-assign
  Error.stackTraceLimit = 50;
}

// Optional source-map support via env (avoids requiring Node flag in all contexts)
(async () => {
  try {
    const want = process.env.MCP_ENABLE_SOURCE_MAPS === '1' || process.env.MCP_DEBUG === 'debug';
    if (want) {
      // Dynamic import to keep it optional at runtime
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await import('source-map-support/register.js');
      logger.debug('Source-map support enabled');
    }
  } catch (e) {
    // Non-fatal
    write('warn', 'Failed to enable source-map support', { error: String(e) });
  }
})();
