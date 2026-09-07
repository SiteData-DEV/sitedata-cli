import { ApiRequestError } from './errors.js';
import { VERSION } from './config.js';
import type { PublicApiDefinition } from './types.js';

export interface ApiResponse {
  status: number;
  body: unknown;
  text: string;
}

function errorMessage(status: number, body: unknown): string {
  if (typeof body === 'object' && body !== null) {
    const record = body as Record<string, unknown>;
    const message = typeof record.message === 'string' ? record.message : undefined;
    const code = typeof record.code === 'string' ? record.code : undefined;
    if (message && code) return message + ' (' + code + ')';
    if (message) return message;
  }
  return 'SiteData request failed with status ' + status + '.';
}

export async function callApi(options: {
  baseUrl: string;
  definition: PublicApiDefinition;
  parameters: Record<string, unknown>;
  credential: string;
  timeoutMs: number;
  fetch?: typeof fetch;
}): Promise<ApiResponse> {
  const url = new URL(
    options.baseUrl.replace(/\/$/, '') + options.definition.path
  );
  if (options.definition.method === 'GET') {
    for (const [name, value] of Object.entries(options.parameters)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(name, String(item));
      } else {
        url.searchParams.set(name, String(value));
      }
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const headers: Record<string, string> = {
      accept: 'application/json',
      authorization: 'Bearer ' + options.credential,
      'user-agent': `@sitedata/cli/${VERSION}`,
    };
    if (options.definition.method === 'POST') {
      headers['content-type'] = 'application/json';
    }
    const response = await (options.fetch ?? globalThis.fetch)(url, {
      method: options.definition.method,
      headers,
      ...(options.definition.method === 'POST'
        ? { body: JSON.stringify(options.parameters) }
        : {}),
      signal: controller.signal,
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // Preserve non-JSON response text for diagnostics and raw output.
    }
    if (!response.ok) {
      throw new ApiRequestError(
        response.status,
        body,
        errorMessage(response.status, body)
      );
    }
    return { status: response.status, body, text };
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiRequestError(
        0,
        null,
        'SiteData request timed out after ' + options.timeoutMs / 1000 + ' seconds.'
      );
    }
    throw new ApiRequestError(
      0,
      null,
      error instanceof Error ? error.message : 'SiteData request failed.'
    );
  } finally {
    clearTimeout(timeout);
  }
}
