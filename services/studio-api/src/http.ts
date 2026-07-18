import type { StudioConfig } from './env';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
} as const;

export function json(data: unknown, init: ResponseInit = {}): Response {
  return Response.json(data, {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...init.headers,
    },
  });
}

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  };
  return json(body, { status });
}

export async function readJson<T>(request: Request, maximumBytes = 256_000): Promise<T> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use application/json.');
  }

  const bytes = await readBodyBytes(request, maximumBytes);
  try {
    const body = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const parsed = JSON.parse(body) as T;
    assertJsonComplexity(parsed);
    return parsed;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }
}

export async function readBodyBytes(
  request: Request,
  maximumBytes: number,
  tooLarge: () => HttpError = () =>
    new HttpError(413, 'REQUEST_TOO_LARGE', 'The request is too large.'),
): Promise<Uint8Array> {
  const declared = request.headers.get('content-length');
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) throw tooLarge();
    const declaredLength = Number(declared);
    if (!Number.isSafeInteger(declaredLength) || declaredLength > maximumBytes) {
      throw tooLarge();
    }
  }
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw tooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function assertJsonComplexity(value: unknown): void {
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  let nodes = 0;
  while (stack.length > 0) {
    const item = stack.pop();
    if (!item) break;
    nodes += 1;
    if (nodes > 20_000 || item.depth > 64) {
      throw new HttpError(422, 'JSON_TOO_COMPLEX', 'The request contains too much nested data.');
    }
    if (Array.isArray(item.value)) {
      for (let index = item.value.length - 1; index >= 0; index -= 1) {
        stack.push({ value: item.value[index], depth: item.depth + 1 });
      }
    } else if (item.value !== null && typeof item.value === 'object') {
      const values = Object.values(item.value);
      for (let index = values.length - 1; index >= 0; index -= 1) {
        stack.push({ value: values[index], depth: item.depth + 1 });
      }
    }
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function corsHeaders(request: Request, config: StudioConfig): HeadersInit {
  const origin = request.headers.get('origin');
  if (!origin || !config.allowedOrigins.has(origin)) return {};

  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': [
      'content-type',
      'x-device-token',
      'x-image-alt',
      'x-image-alt-base64',
      'x-image-decorative',
      'x-image-height',
      'x-image-sha256',
      'x-image-width',
    ].join(','),
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

export function withCors(response: Response, request: Request, config: StudioConfig): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders(request, config))) {
    if (name.toLowerCase() === 'vary') {
      const values = new Set(
        `${headers.get('vary') ?? ''},${value}`
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
      );
      headers.set('vary', [...values].join(', '));
    } else {
      headers.set(name, value);
    }
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
