import axios, { AxiosInstance } from 'axios';
import { N8nTemplateSearchResponse, N8nTemplateWorkflow } from './types.js';

/**
 * n8n's public template library (api.n8n.io). Unauthenticated, not license-gated —
 * gives the AI real, working workflow examples to ground node usage against.
 */
export class TemplatesClient {
  private baseUrl: string;
  private http: AxiosInstance;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl || process.env.N8N_TEMPLATES_HOST || 'https://api.n8n.io/templates').replace(/\/$/, '');
    this.http = axios.create({ baseURL: this.baseUrl, timeout: 10000 });
  }

  async searchTemplates(options?: { query?: string; nodeTypes?: string[]; category?: string; limit?: number }): Promise<N8nTemplateSearchResponse> {
    const params = new URLSearchParams();
    // The API always requires `search`, even if empty.
    params.append('search', options?.query || '');
    if (options?.nodeTypes?.length) params.append('nodes', JSON.stringify(options.nodeTypes));
    if (options?.category) params.append('category', JSON.stringify([options.category]));
    if (options?.limit) params.append('rows', options.limit.toString());

    try {
      const response = await this.http.get<N8nTemplateSearchResponse>(`/search?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to search templates from ${this.baseUrl}: ${error.message}`);
    }
  }

  async getTemplate(id: number | string): Promise<N8nTemplateWorkflow> {
    try {
      const response = await this.http.get<{ workflow: N8nTemplateWorkflow }>(`/workflows/${id}`);
      return response.data.workflow;
    } catch (error: any) {
      throw new Error(`Failed to fetch template ${id} from ${this.baseUrl}: ${error.message}`);
    }
  }
}
