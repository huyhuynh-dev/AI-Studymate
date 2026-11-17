export interface AdminErrorPayload {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

export class AdminApiError extends Error {
  public readonly status: number;
  public readonly response?: {
    status: number;
    data: AdminErrorPayload;
  };

  constructor(
    message: string,
    status: number,
    data: AdminErrorPayload = {},
  ) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.response = {
      status,
      data,
    };
  }
}

export interface AdminRequestConfig {
  params?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  skipAuthRefresh?: boolean;
}

interface HttpResponse<T> {
  data: T;
  status: number;
}

const BASE_PROXY_URL = '/api/proxy';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: () => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown) {
  failedQueue.forEach((item) => {
    if (error) {
      item.reject(error);
    } else {
      item.resolve();
    }
  });
  failedQueue = [];
}

function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>,
  baseUrl = BASE_PROXY_URL,
): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const fullPath = `${baseUrl}${cleanPath}`;
  if (!params) return fullPath;

  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });

  const qs = search.toString();
  return qs ? `${fullPath}?${qs}` : fullPath;
}

async function parseErrorPayload(res: Response): Promise<AdminErrorPayload> {
  try {
    const json = (await res.json()) as AdminErrorPayload;
    return json ?? {};
  } catch {
    return {};
  }
}

function resolveErrorMessage(payload: AdminErrorPayload, status: number): string {
  if (Array.isArray(payload.message) && payload.message.length > 0) {
    return payload.message.join(', ');
  }
  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
  }
  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error;
  }
  return `Yêu cầu thất bại với mã trạng thái ${status}.`;
}

async function refreshAdminSession(): Promise<void> {
  const res = await fetch('/api/auth/refresh', {
    method: 'GET',
    cache: 'no-store',
    credentials: 'include',
  });

  if (!res.ok) {
    const payload = await parseErrorPayload(res);
    throw new AdminApiError(
      resolveErrorMessage(payload, res.status),
      res.status,
      payload,
    );
  }
}

async function executeRequest<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  config: AdminRequestConfig = {},
  hasRetried = false,
  baseUrl = BASE_PROXY_URL,
): Promise<HttpResponse<T>> {
  const url = buildUrl(path, config.params, baseUrl);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config.headers ?? {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    credentials: 'include',
  });

  if (
    res.status === 401 &&
    !hasRetried &&
    !config.skipAuthRefresh &&
    baseUrl === BASE_PROXY_URL
  ) {
    if (isRefreshing) {
      await new Promise<void>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      });
      return executeRequest<T>(method, path, body, config, true, baseUrl);
    }

    isRefreshing = true;
    try {
      await refreshAdminSession();
      isRefreshing = false;
      processQueue(null);
      return executeRequest<T>(method, path, body, config, true, baseUrl);
    } catch (refreshError: unknown) {
      isRefreshing = false;
      processQueue(refreshError);
      throw refreshError;
    }
  }

  if (!res.ok) {
    const payload = await parseErrorPayload(res);
    throw new AdminApiError(
      resolveErrorMessage(payload, res.status),
      res.status,
      payload,
    );
  }

  const text = await res.text();
  const data = (text ? JSON.parse(text) : {}) as T;
  return { data, status: res.status };
}

export const axiosAdmin = {
  get: <T>(path: string, config?: AdminRequestConfig) =>
    executeRequest<T>('GET', path, undefined, config),
  post: <T>(path: string, data?: unknown, config?: AdminRequestConfig) =>
    executeRequest<T>('POST', path, data, config),
  patch: <T>(path: string, data?: unknown, config?: AdminRequestConfig) =>
    executeRequest<T>('PATCH', path, data, config),
  delete: <T>(path: string, config?: AdminRequestConfig) =>
    executeRequest<T>('DELETE', path, undefined, config),
  authPost: <T>(path: string, data?: unknown, config?: AdminRequestConfig) =>
    executeRequest<T>('POST', path, data, { ...config, skipAuthRefresh: true }, false, ''),
};

export function extractAdminErrorMessage(
  error: unknown,
  fallback = 'Có lỗi xảy ra khi kết nối máy chủ Quản trị.',
): string {
  if (error instanceof AdminApiError) {
    const payloadMsg = error.response?.data?.message;
    if (Array.isArray(payloadMsg) && payloadMsg.length > 0) {
      return payloadMsg.join(', ');
    }
    if (typeof payloadMsg === 'string' && payloadMsg.trim()) {
      return payloadMsg;
    }
    if (error.message.trim()) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
