import type { BackendConfig } from '../../shared/contracts';

/** Cliente HTTP mínimo para que el proceso principal consulte el backend. */
export class ApiClient {
  constructor(private readonly config: BackendConfig) {}

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T = void>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-api-token': this.config.token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${method} ${path} respondió ${response.status}`);
    return (response.status === 204 ? undefined : await response.json()) as T;
  }
}
