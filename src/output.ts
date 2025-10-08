export interface OutputOptions {
  compact?: boolean;
}

export function success(data: any, meta?: Record<string, any>) {
  return meta ? { ok: true, data, meta } : { ok: true, data };
}

export function error(err: unknown, code?: string, details?: any) {
  const message = err instanceof Error ? err.message : String(err);
  const payload: any = { ok: false, error: { message } };
  if (code) payload.error.code = code;
  if (details !== undefined) payload.error.details = details;
  
  // Add endpoint attempts if available (for multi-endpoint fallback operations)
  if (err instanceof Error && (err as any).attempts) {
    payload.error.attemptedEndpoints = (err as any).attempts;
  }
  
  // Add hints for known limitations
  if (message.includes('tag color') && message.includes('UI')) {
    payload.error.hint = 'Tag color updates may not be supported on this n8n instance. Consider setting colors via the n8n web UI.';
  }
  if (message.includes('set workflow tags') && message.includes('405')) {
    payload.error.hint = 'Tag attachment endpoints vary by n8n version. Consider using the n8n web UI to attach tags.';
  }
  
  return payload;
}

export function printJson(obj: any, opts: OutputOptions = {}) {
  const { compact } = opts;
  if (compact) {
    // single line JSON
    process.stdout.write(JSON.stringify(obj) + "\n");
  } else {
    console.log(JSON.stringify(obj, null, 2));
  }
}

export function parseFormatFlags(argv: string[]): OutputOptions {
  // Default optimized for humans/tests: pretty JSON
  const opts: OutputOptions = {};
  if (argv.includes('--compact')) opts.compact = true;
  if (argv.includes('--pretty')) opts.compact = false;
  return opts;
}

