import { callApi } from './api-client.js';
import {
  refreshRequestCredential,
  resolveRequestCredential,
} from './auth.js';
import { parseArguments, parseCommandParameters } from './arguments.js';
import { loadApiCatalog } from './catalog.js';
import {
  createSystemCredentialStore,
  type CredentialStore,
} from './credential-store.js';
import { ApiRequestError, UsageError } from './errors.js';
import {
  createSystemInstallationStore,
  type InstallationStore,
} from './installation-store.js';
import {
  DEFAULT_OAUTH_ISSUER,
  DEFAULT_OAUTH_RESOURCE,
  loginWithBrowser,
  revokeOAuthCredential,
} from './oauth.js';
import { VERSION } from './config.js';
import {
  renderCatalog,
  renderDescription,
  renderGeneralHelp,
  renderValue,
} from './output.js';
import { updateCli, type CliUpdateOptions } from './update.js';

export { VERSION } from './config.js';

export interface CliDependencies {
  fetch?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
  credentialStore?: CredentialStore;
  installationStore?: InstallationStore;
  login?: typeof loginWithBrowser;
  update?: (options: CliUpdateOptions) => ReturnType<typeof updateCli>;
  now?: () => number;
}

function findApi(
  catalog: readonly import('./types.js').PublicApiDefinition[],
  id: string
) {
  const normalized = id === 'balance' ? 'credits-balance' : id;
  return catalog.find((definition) => definition.id === normalized);
}

function responseData(body: unknown): unknown {
  if (typeof body === 'object' && body !== null && 'data' in body) {
    return (body as Record<string, unknown>).data;
  }
  return body;
}

export async function runCli(
  argv: string[],
  dependencies: CliDependencies = {}
): Promise<number> {
  const stdout = dependencies.stdout ?? ((text) => process.stdout.write(text));
  const stderr = dependencies.stderr ?? ((text) => process.stderr.write(text));
  const fetcher = dependencies.fetch ?? globalThis.fetch;
  let credentialStore = dependencies.credentialStore;
  let installationStore = dependencies.installationStore;
  const getCredentialStore = () => {
    credentialStore ??= createSystemCredentialStore();
    return credentialStore;
  };
  const getInstallationStore = () => {
    installationStore ??= createSystemInstallationStore({
      env: dependencies.env ?? process.env,
    });
    return installationStore;
  };

  try {
    const parsed = parseArguments(argv, dependencies.env ?? process.env);
    const { globals, rest } = parsed;
    let catalogPromise: ReturnType<typeof loadApiCatalog> | undefined;
    const getCatalog = () =>
      (catalogPromise ??= loadApiCatalog({
        baseUrl: globals.baseUrl,
        fetch: fetcher,
      }));

    if (globals.version) {
      stdout(VERSION + '\n');
      return 0;
    }
    if (rest.length === 0) {
      stdout(renderGeneralHelp() + '\n');
      return 0;
    }

    const command = rest[0];
    if (command === undefined) throw new UsageError('A command is required.');

    if (command === 'help' || globals.help) {
      let requested =
        command === 'help' || command === 'describe'
          ? rest[1]
          : command === 'list'
            ? undefined
            : command;
      if (
        requested === 'login' ||
        requested === 'logout' ||
        requested === 'auth' ||
        requested === 'update'
      ) {
        requested = undefined;
      }
      if (!requested) {
        stdout(renderGeneralHelp() + '\n');
        return 0;
      }
      const definition = findApi(await getCatalog(), requested);
      if (!definition) throw new UsageError('Unknown API: ' + requested);
      stdout(renderDescription(definition) + '\n');
      return 0;
    }

    if (command === 'login') {
      if (rest.length > 1) throw new UsageError('login does not accept arguments.');
      const clientInstanceId = await getInstallationStore().loadOrCreate();
      const oauth = await (dependencies.login ?? loginWithBrowser)({
        clientInstanceId,
        issuer:
          (dependencies.env ?? process.env).SITEDATA_OAUTH_ISSUER ??
          DEFAULT_OAUTH_ISSUER,
        resource:
          (dependencies.env ?? process.env).SITEDATA_OAUTH_RESOURCE ??
          DEFAULT_OAUTH_RESOURCE,
        fetch: fetcher,
        onStatus: (message) => stderr(message + '\n'),
        now: dependencies.now?.(),
      });
      await getCredentialStore().save(oauth);
      stdout('Logged in to SiteData with OAuth.\n');
      return 0;
    }

    if (command === 'update') {
      if (
        rest.length > 2 ||
        (rest.length === 2 && rest[1] !== '--check')
      ) {
        throw new UsageError('Usage: sitedata update [--check]');
      }
      const checkOnly = rest[1] === '--check';
      const result = await (dependencies.update ?? updateCli)({
        currentVersion: VERSION,
        env: dependencies.env ?? process.env,
        fetch: fetcher,
        ...(dependencies.now ? { now: dependencies.now() } : {}),
        force: true,
        checkOnly,
      });
      if (result.status === 'check_failed') {
        stderr('Error: Unable to check for SiteData CLI updates.\n');
        return 1;
      }
      if (result.status === 'up_to_date') {
        stdout(`SiteData CLI is up to date: v${VERSION}\n`);
        return 0;
      }
      if (result.status === 'available' && result.latestVersion) {
        stdout(
          `Update available: v${VERSION} -> v${result.latestVersion}\n` +
          'Run sitedata update to install it.\n'
        );
        return 0;
      }
      if (result.status === 'updated' && result.latestVersion) {
        stdout(
          `SiteData CLI updated: v${VERSION} -> v${result.latestVersion}\n` +
          'Run your next command to use the new version.\n'
        );
        return 0;
      }
      if (result.status === 'busy') {
        stdout('Another SiteData CLI update is already in progress.\n');
        return 0;
      }
      if (result.status === 'install_failed') {
        stderr(
          `Error: SiteData CLI update failed. ${result.message ?? ''}`.trimEnd() +
          '\n'
        );
        return 1;
      }
      return 0;
    }

    if (command === 'logout') {
      if (rest.length > 1) throw new UsageError('logout does not accept arguments.');
      const store = getCredentialStore();
      const credential = await store.load();
      if (credential?.kind === 'oauth') {
        try {
          await revokeOAuthCredential(credential, { fetch: fetcher });
        } catch (error) {
          stderr(
            'Warning: remote OAuth revocation failed; the local credential will still be removed. ' +
              (error instanceof Error ? error.message : '') +
              '\n'
          );
        }
      }
      await store.clear();
      stdout('Saved SiteData credentials removed.\n');
      return 0;
    }

    if (command === 'auth') {
      const subcommand = rest[1];
      if (subcommand === 'status' && rest.length === 2) {
        const credential = await getCredentialStore().load();
        if (!credential) {
          stdout('Not authenticated. Run sitedata login.\n');
          return 1;
        }
        stdout(
          'Authenticated with OAuth. Access token expires at ' +
            new Date(credential.expiresAt).toISOString() +
            '.\n'
        );
        return 0;
      }
      throw new UsageError('Usage: sitedata auth status');
    }

    const catalog = await getCatalog();

    if (command === 'list') {
      if (rest.length > 1) throw new UsageError('list does not accept arguments.');
      stdout(renderCatalog(catalog, globals.output) + '\n');
      return 0;
    }

    if (command === 'describe') {
      const id = rest[1];
      if (!id || rest.length > 2) {
        throw new UsageError('Usage: sitedata describe <api>');
      }
      const definition = findApi(catalog, id);
      if (!definition) throw new UsageError('Unknown API: ' + id);
      if (globals.output === 'pretty') {
        stdout(renderDescription(definition) + '\n');
      } else {
        stdout(renderValue(definition, globals.output) + '\n');
      }
      return 0;
    }

    const definition = findApi(catalog, command);
    if (!definition) throw new UsageError('Unknown API: ' + command);
    if (globals.dataOnly && globals.output === 'raw') {
      throw new UsageError('--data-only cannot be combined with --output raw.');
    }

    const parameters = parseCommandParameters(definition, rest.slice(1));
    const store = getCredentialStore();
    let credential = await resolveRequestCredential({
      store,
      fetch: fetcher,
      now: dependencies.now?.(),
    });
    const request = () =>
      callApi({
        baseUrl: globals.baseUrl,
        definition,
        parameters,
        credential: credential.token,
        timeoutMs: globals.timeoutMs,
        fetch: fetcher,
      });
    let response;
    try {
      response = await request();
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.status === 401 &&
        credential.source === 'oauth'
      ) {
        credential = await refreshRequestCredential({
          credential,
          store,
          fetch: fetcher,
          now: dependencies.now?.(),
        });
        response = await request();
      } else {
        throw error;
      }
    }
    const value = globals.dataOnly ? responseData(response.body) : response.body;
    stdout(
      (globals.output === 'raw'
        ? response.text
        : renderValue(value, globals.output)) + '\n'
    );
    return 0;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      stderr('Error: ' + error.message + '\n');
      return error.exitCode;
    }
    if (error instanceof UsageError) {
      stderr('Error: ' + error.message + '\n');
      return error.exitCode;
    }
    stderr(
      'Error: ' +
        (error instanceof Error ? error.message : 'Unexpected CLI failure.') +
        '\n'
    );
    return 1;
  }
}
