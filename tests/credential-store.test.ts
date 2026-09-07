import assert from 'node:assert/strict';
import test from 'node:test';

import { createSystemCredentialStore } from '../src/credential-store.js';

test('Linux Secret Service treats a missing credential as signed out', async () => {
  const calls: Array<{ command: string; args: string[] }> = [];
  const store = createSystemCredentialStore({
    platform: 'linux',
    runner: async (command, args) => {
      calls.push({ command, args });
      return { code: 1, stdout: '' };
    },
  });

  assert.equal(await store.load(), null);
  await store.clear();
  assert.deepEqual(
    calls.map((call) => call.args[0]),
    ['lookup', 'clear']
  );
});

test('Windows Credential Locker receives saved secrets through stdin', async () => {
  let receivedStdin = '';
  let receivedArgs: string[] = [];
  const store = createSystemCredentialStore({
    platform: 'win32',
    runner: async (_command, args, stdin) => {
      receivedArgs = args;
      receivedStdin = stdin ?? '';
      return { code: 0, stdout: '' };
    },
  });

  await store.save({
    kind: 'oauth',
    accessToken: 'access-secret',
    refreshToken: 'refresh-secret',
    expiresAt: 1_900_000_000_000,
    scope: 'api:invoke',
    resource: 'https://sitedata.dev',
    clientId: 'sitedata-cli',
    issuer: 'https://sitedata.dev',
  });
  assert.match(receivedStdin, /access-secret/);
  assert.equal(receivedArgs.includes('access-secret'), false);
  assert.equal(receivedArgs.includes('refresh-secret'), false);
});
