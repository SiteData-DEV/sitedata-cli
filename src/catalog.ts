import type { JsonSchema, PublicApiDefinition } from './types.js';

const CATALOG_PATH = '/api/v1/mcp/catalog';
const CATALOG_TIMEOUT_MS = 5_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSchema(value: unknown): value is JsonSchema {
  if (!isRecord(value)) return false;
  const types = ['object', 'string', 'integer', 'number', 'boolean', 'array'];
  if (typeof value.type !== 'string' || !types.includes(value.type)) return false;
  if (value.properties !== undefined) {
    if (!isRecord(value.properties) || !Object.values(value.properties).every(isSchema)) {
      return false;
    }
  }
  if (value.items !== undefined && !isSchema(value.items)) return false;
  if (value.minimum !== undefined && typeof value.minimum !== 'number') {
    return false;
  }
  if (value.maximum !== undefined && typeof value.maximum !== 'number') {
    return false;
  }
  if (
    value.minLength !== undefined &&
    (typeof value.minLength !== 'number' ||
      !Number.isInteger(value.minLength) ||
      value.minLength < 0)
  ) return false;
  if (value.pattern !== undefined && typeof value.pattern !== 'string') return false;
  if (
    value.required !== undefined &&
    (!Array.isArray(value.required) ||
      !value.required.every((item) => typeof item === 'string'))
  ) return false;
  if (
    value.oneOf !== undefined &&
    (!Array.isArray(value.oneOf) ||
      value.oneOf.length === 0 ||
      !value.oneOf.every(isSchema))
  ) return false;
  if (value.examples !== undefined && !Array.isArray(value.examples)) return false;
  return true;
}

function isPublicPath(path: string): boolean {
  return /^\/api\/v1\/(?:[a-z0-9_-]+|\{[A-Za-z][A-Za-z0-9_]*\})(?:\/(?:[a-z0-9_-]+|\{[A-Za-z][A-Za-z0-9_]*\}))*$/.test(path);
}

function isDefinition(value: unknown): value is PublicApiDefinition {
  if (!isRecord(value)) return false;
  return (
    (value.method === 'GET' || value.method === 'POST') &&
    typeof value.id === 'string' &&
    /^[a-z0-9-]+$/.test(value.id) &&
    typeof value.path === 'string' &&
    (isPublicPath(value.path)) &&
    typeof value.mcpName === 'string' &&
    /^sitedata_[a-z0-9_]+$/.test(value.mcpName) &&
    typeof value.description === 'string' &&
    typeof value.readOnly === 'boolean' &&
    isSchema(value.inputSchema) && value.inputSchema.type === 'object'
  );
}

export function parseCatalog(value: unknown): readonly PublicApiDefinition[] {
  if (!isRecord(value) || value.code !== 'ok' || !isRecord(value.data)) {
    throw new Error('Catalog response has an invalid envelope.');
  }
  if (value.data.schemaVersion !== 1 || !Array.isArray(value.data.apis)) {
    throw new Error('Catalog response has an unsupported schema version.');
  }
  if (value.data.apis.length === 0 || !value.data.apis.every(isDefinition)) {
    throw new Error('Catalog response contains an invalid API definition.');
  }
  if (new Set(value.data.apis.map(item => item.mcpName)).size !== value.data.apis.length) {
    throw new Error('Catalog response contains duplicate MCP tool names.');
  }
  return value.data.apis;
}

export async function loadApiCatalog(options: {
  baseUrl: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): Promise<readonly PublicApiDefinition[]> {
  const fetcher = options.fetch ?? globalThis.fetch;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? CATALOG_TIMEOUT_MS
  );
  try {
    const response = await fetcher(
      options.baseUrl.replace(/\/$/, '') + CATALOG_PATH,
      { headers: { accept: 'application/json' }, signal: controller.signal }
    );
    if (!response.ok) {
      throw new Error('Catalog request failed with status ' + response.status + '.');
    }
    return parseCatalog(await response.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    throw new Error('Unable to load the SiteData catalog: ' + message, {
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}
