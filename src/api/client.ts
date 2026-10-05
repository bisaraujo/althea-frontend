const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = {
  token?: string | null;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: BodyInit | null;
  headers?: Record<string, string>;
};

async function parseResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 30000);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body,
      signal: controller.signal,
    });
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'AbortError') {
      throw new ApiError('O servidor demorou demais para responder. Tente novamente.', 0);
    }
    throw new ApiError('Não foi possível conectar ao servidor. Verifique sua conexão.', 0);
  } finally {
    window.clearTimeout(timeoutId);
  }

  let data: unknown;
  try {
    data = await parseResponse(response);
  } catch {
    throw new ApiError('A resposta do servidor veio incompleta. Tente novamente.', response.status || 0);
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'detail' in data
        ? String((data as { detail: unknown }).detail)
        : 'Não foi possível completar a requisição.';
    if (response.status === 401 && options.token) {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export { API_URL };
