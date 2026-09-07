import assert from 'node:assert/strict';
import test from 'node:test';
import { callApi } from '../src/api-client.js';
import { ApiRequestError } from '../src/errors.js';
import { trafficDefinition } from './fixtures.js';

const traffic = trafficDefinition;

test('sends an OAuth bearer token and schema parameters to SiteData', async () => {
  let requestUrl = '';
  let authorization = '';
  const fetcher: typeof fetch = async (input, init) => {
    requestUrl = String(input);
    authorization = new Headers(init?.headers).get('authorization') ?? '';
    return Response.json({ code: 'ok', data: { value: 1 } });
  };

  const response = await callApi({
    baseUrl: 'https://sitedata.dev',
    definition: traffic,
    parameters: { domain: 'example.com', month: 3 },
    credential: 'oauth-token',
    timeoutMs: 1_000,
    fetch: fetcher,
  });

  assert.equal(
    requestUrl,
    'https://sitedata.dev/api/v1/traffic?domain=example.com&month=3'
  );
  assert.equal(authorization, 'Bearer oauth-token');
  assert.deepEqual(response.body, { code: 'ok', data: { value: 1 } });
});

test('preserves structured SiteData errors', async () => {
  const fetcher: typeof fetch = async () =>
    Response.json(
      { code: 'insufficient_credits', message: 'Insufficient credits' },
      { status: 402 }
    );

  await assert.rejects(
    callApi({
      baseUrl: 'https://sitedata.dev',
      definition: traffic,
      parameters: { domain: 'example.com' },
      credential: 'oauth-token',
      timeoutMs: 1_000,
      fetch: fetcher,
    }),
    (error) =>
      error instanceof ApiRequestError &&
      error.status === 402 &&
      /insufficient_credits/.test(error.message)
  );
});

test('sends POST parameters as a JSON request body', async () => {
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  const fetcher: typeof fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return Response.json({ code: 'ok', data: { created: true } });
  };

  await callApi({
    baseUrl: 'https://sitedata.dev',
    definition: {
      id: 'favorites',
      method: 'POST',
      path: '/api/v1/favorites',
      mcpName: 'sitedata_favorites',
      description: 'Manage favorites.',
      readOnly: false,
      inputSchema: {
        type: 'object',
        properties: { action: { type: 'string' }, kind: { type: 'string' } },
        required: ['action'],
      },
    },
    parameters: { action: 'list', kind: 'website' },
    credential: 'oauth-token',
    timeoutMs: 1_000,
    fetch: fetcher,
  });

  assert.equal(requestUrl, 'https://sitedata.dev/api/v1/favorites');
  assert.equal(requestInit?.method, 'POST');
  assert.equal(
    new Headers(requestInit?.headers).get('content-type'),
    'application/json'
  );
  assert.equal(requestInit?.body, '{"action":"list","kind":"website"}');
});
