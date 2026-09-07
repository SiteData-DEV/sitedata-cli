import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_ENDPOINTS,
  VERSION,
  resolveDefaultEndpoints,
} from '../src/config.js';

test('next versions use the test environment', () => {
  assert.deepEqual(resolveDefaultEndpoints('0.0.1-next.1'), {
    oauthIssuer: 'https://www2.sitedata.dev',
    oauthResource: 'https://sitedata.dev',
    apiBaseUrl: 'https://sitedata.dev',
  });
  assert.deepEqual(resolveDefaultEndpoints('0.0.1-next'), {
    oauthIssuer: 'https://www2.sitedata.dev',
    oauthResource: 'https://sitedata.dev',
    apiBaseUrl: 'https://sitedata.dev',
  });
});

test('stable and unrelated prerelease versions use production', () => {
  assert.deepEqual(resolveDefaultEndpoints('0.0.1'), {
    oauthIssuer: 'https://sitedata.dev',
    oauthResource: 'https://sitedata.dev',
    apiBaseUrl: 'https://sitedata.dev',
  });
  assert.deepEqual(resolveDefaultEndpoints('0.0.1-beta.1'), {
    oauthIssuer: 'https://sitedata.dev',
    oauthResource: 'https://sitedata.dev',
    apiBaseUrl: 'https://sitedata.dev',
  });
});

test('current package version selects the exported defaults', () => {
  assert.equal(VERSION, '0.1.0');
  assert.equal(DEFAULT_ENDPOINTS.oauthIssuer, 'https://sitedata.dev');
  assert.equal(DEFAULT_ENDPOINTS.oauthResource, 'https://sitedata.dev');
  assert.equal(DEFAULT_ENDPOINTS.apiBaseUrl, 'https://sitedata.dev');
});
