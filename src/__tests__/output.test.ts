import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { success, error, parseFormatFlags, printJson } from '../output.js';

describe('output helpers', () => {
  let writeSpy: any;
  let logSpy: any;

  beforeEach(() => {
    writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true as any);
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    writeSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('success returns ok payload with data and optional meta', () => {
    const base = success({ a: 1 });
    expect(base).toEqual({ ok: true, data: { a: 1 } });

    const withMeta = success({ a: 1 }, { page: 2 });
    expect(withMeta).toEqual({ ok: true, data: { a: 1 }, meta: { page: 2 } });
  });

  it('error returns ok:false with message, code, and details', () => {
    const e1 = error(new Error('boom'), 'E_FAIL', { retry: false });
    expect(e1).toEqual({ ok: false, error: { message: 'boom', code: 'E_FAIL', details: { retry: false } } });

    const e2 = error('plain');
    expect(e2).toEqual({ ok: false, error: { message: 'plain' } });
  });

  it('parseFormatFlags toggles compact vs pretty correctly', () => {
    expect(parseFormatFlags([])).toEqual({});
    expect(parseFormatFlags(['--compact'])).toEqual({ compact: true });
    expect(parseFormatFlags(['--compact', '--pretty'])).toEqual({ compact: false });
  });

  it('printJson respects compact flag and pretty by default', () => {
    printJson({ x: 1 }, { compact: true });
    expect(writeSpy).toHaveBeenCalled();

    printJson({ y: 2 });
    expect(logSpy).toHaveBeenCalled();
  });
});
