import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import axios from 'axios';
import { TemplatesClient } from '../templates-client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TemplatesClient', () => {
  let mockHttp: any;

  beforeEach(() => {
    mockHttp = { get: jest.fn() };
    mockedAxios.create.mockReturnValue(mockHttp);
  });

  it('defaults to the public api.n8n.io templates host', () => {
    new TemplatesClient();
    expect(mockedAxios.create).toHaveBeenCalledWith(expect.objectContaining({ baseURL: 'https://api.n8n.io/templates' }));
  });

  it('honors N8N_TEMPLATES_HOST override', () => {
    new TemplatesClient('https://templates.internal.example/');
    expect(mockedAxios.create).toHaveBeenCalledWith(expect.objectContaining({ baseURL: 'https://templates.internal.example' }));
  });

  it('always sends a search param, even when query is omitted', async () => {
    mockHttp.get.mockResolvedValue({ data: { totalWorkflows: 0, workflows: [] } });
    const client = new TemplatesClient();
    await client.searchTemplates();
    expect(mockHttp.get).toHaveBeenCalledWith('/search?search=');
  });

  it('encodes nodeTypes as a JSON array query param', async () => {
    mockHttp.get.mockResolvedValue({ data: { totalWorkflows: 1, workflows: [] } });
    const client = new TemplatesClient();
    await client.searchTemplates({ nodeTypes: ['n8n-nodes-base.slack', 'n8n-nodes-base.gmail'] });
    const url = mockHttp.get.mock.calls[0][0] as string;
    expect(url).toContain(encodeURIComponent(JSON.stringify(['n8n-nodes-base.slack', 'n8n-nodes-base.gmail'])));
  });

  it('returns the search response as-is', async () => {
    const payload = { totalWorkflows: 2, workflows: [{ id: 1, name: 'Foo' }] };
    mockHttp.get.mockResolvedValue({ data: payload });
    const client = new TemplatesClient();
    const result = await client.searchTemplates({ query: 'foo' });
    expect(result).toEqual(payload);
  });

  it('unwraps get_template response to the inner workflow object', async () => {
    const inner = { id: 42, name: 'Example', workflow: { nodes: [], connections: {} } };
    mockHttp.get.mockResolvedValue({ data: { workflow: inner } });
    const client = new TemplatesClient();
    const result = await client.getTemplate(42);
    expect(result).toEqual(inner);
    expect(mockHttp.get).toHaveBeenCalledWith('/workflows/42');
  });

  it('throws a clear error when the templates host is unreachable', async () => {
    mockHttp.get.mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    const client = new TemplatesClient();
    await expect(client.searchTemplates({ query: 'x' })).rejects.toThrow('Failed to search templates');
  });
});
