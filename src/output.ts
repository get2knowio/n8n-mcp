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

