import { createRequire } from 'node:module';

export interface DefaultEndpoints {
  oauthIssuer: string;
  oauthResource: string;
  apiBaseUrl: string;
}

const require = createRequire(import.meta.url);
const packageMetadata = require('../package.json') as { version: string };

export const VERSION = packageMetadata.version;

export function resolveDefaultEndpoints(version: string): DefaultEndpoints {
  const prerelease = version.split('-', 2)[1];
  const isNext = prerelease === 'next' || prerelease?.startsWith('next.') === true;

  if (isNext) {
    return {
      oauthIssuer: 'https://www2.sitedata.dev',
      oauthResource: 'https://sitedata.dev',
      apiBaseUrl: 'https://sitedata.dev',
    };
  }

  return {
    oauthIssuer: 'https://sitedata.dev',
    oauthResource: 'https://sitedata.dev',
    apiBaseUrl: 'https://sitedata.dev',
  };
}

export const DEFAULT_ENDPOINTS = resolveDefaultEndpoints(VERSION);
