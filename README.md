# SiteData CLI

[![npm version](https://img.shields.io/npm/v/@sitedata/cli.svg)](https://www.npmjs.com/package/@sitedata/cli)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933.svg)](https://nodejs.org/)

[English](./README.md) | [中文](./README.zh.md)

The official command-line client for [SiteData](https://sitedata.dev), built for humans and AI agents. Discover website rankings, manage website and keyword favorites, and receive structured output directly in your terminal through secure OAuth authentication.

[Install](#installation-and-quick-start) · [AI agents](#ai-agent-quick-start) · [Authentication](#authentication) · [Commands](#commands) · [Advanced usage](#advanced-usage) · [Security](#security)

## Why SiteData CLI?

- **Designed for agents** — stable commands, machine-readable schemas, JSON output, explicit exit codes, and no interactive prompts during API calls.
- **Always current** — commands and parameters come from the SiteData online Catalog instead of a stale bundled snapshot.
- **Simple browser login** — OAuth Authorization Code + PKCE opens the browser and completes through a local callback.
- **Secure credential storage** — OAuth credentials are stored in Windows Credential Locker, macOS Keychain, or Linux Secret Service.
- **Per-installation authorization** — each operating-system user installation has a persistent random client identifier, so signing in again replaces only that installation's previous session.
- **Read and write support** — GET APIs use query parameters, while POST APIs send JSON request bodies.
- **Structured output** — choose formatted JSON, compact JSON, the raw response, or only the response `data` field.

## Who is it for?

| You are… | Recommended workflow |
| --- | --- |
| A terminal user | Install globally, run `sitedata login`, then invoke an API command. |
| An AI coding-agent user | Log in once, then let Codex, Claude Code, or another terminal-capable agent run `sitedata ... --output json`. |
| A script or automation operator | Complete OAuth as the same operating-system user that runs the automation, and use JSON output with explicit exit-code handling. |
| An MCP client user | Use the dedicated [SiteData MCP server](https://mcp.sitedata.dev/mcp) for native MCP tools. CLI OAuth and MCP OAuth are separate. |

## Capabilities

| Category | Capabilities |
| --- | --- |
| Website rankings | Complete traffic-growth, Domain Rating growth, and payment-traffic rankings, including current/archive periods and available filters. |
| Favorites | List, add, update, and delete website or keyword favorites. |
| Favorite folders | Create, rename, delete, and filter favorites by folders. |
| Discovery | List the current API Catalog and inspect command schemas, enum values, defaults, and examples. |

The server publishes the authoritative command Catalog. Run `sitedata list` to see every API currently available to the CLI.

## Installation and quick start

### Requirements

- Node.js 20 or newer
- npm or a compatible package manager
- A SiteData account for OAuth authorization

### Install

```bash
npm install --global @sitedata/cli
sitedata --version
```

### Quick start for terminal users

```bash
# 1. Sign in through the browser
sitedata login

# 2. Check authentication
sitedata auth status

# 3. Discover the current APIs
sitedata list

# 4. Query the traffic-growth ranking
sitedata rankings traffic-growth --output json

# 5. List saved website favorites
sitedata favorites list --kind website --output json
```

Browser login uses the fixed public OAuth client `sitedata-cli`, resource `https://sitedata.dev`, and scope `api:invoke`.

## AI agent quick start

> Browser authorization requires user interaction. Agents must never read, print, or copy credentials from the operating system's credential store.

```bash
# 1. Install
npm install --global @sitedata/cli

# 2. Ask the user to complete browser authorization
sitedata login

# 3. Verify authentication and discover APIs
sitedata auth status
sitedata list --output json

# 4. Inspect and call APIs
sitedata describe rankings --output json
sitedata rankings traffic-growth --output json
sitedata favorites list --kind all --output json
```

Add the following to `AGENTS.md`, `CLAUDE.md`, or equivalent instructions so an agent can use the CLI consistently:

```md
Use the globally installed `sitedata` CLI when SiteData ranking or favorite data is needed.
Add `--output json` to API commands. Run `sitedata list --output json` to discover
the current APIs and `sitedata describe <command> --output json` to inspect parameters.
Never read or expose saved OAuth tokens.
```

The agent must run as the same operating-system user that completed `sitedata login`. Windows credentials are not automatically available inside WSL, Docker, another computer, or a remote agent runtime.

## Authentication

SiteData CLI uses OAuth Authorization Code + PKCE:

```bash
sitedata login
sitedata auth status
sitedata logout
```

The access token is refreshed automatically before expiry. When logging out, the CLI attempts to revoke the OAuth credential remotely and always deletes the local credential.

Each installation stores a random identifier with the `sd_` prefix. Reauthorizing the same installation replaces its previous SiteData CLI session without revoking sessions belonging to other installations.

## Commands

### Discover APIs and schemas

```bash
sitedata list
sitedata list --output json
sitedata describe rankings
sitedata describe favorites --output json
sitedata rankings --help
```

The CLI loads `/api/v1/mcp/catalog` from the selected API Base URL. If the online Catalog is unavailable or invalid, the command fails instead of using an outdated local definition.

### Ranking queries

The `rankings` command takes `rankingType` as its required argument. Enum values can use their kebab-case aliases:

```bash
# Current traffic-growth ranking
sitedata rankings traffic-growth --output json

# Archived Domain Rating growth ranking
sitedata rankings domain-rating-growth --period archive --month 2026-08 --output json

# Payment-traffic ranking filtered by gateway and locale
sitedata rankings payment-traffic --gateway stripe --locale en --output json

# Newly detected websites in a public tag
sitedata rankings traffic-growth --new-sites --tag-type category --tag-code ai --output json
```

### Favorites and folders

The `favorites` command is a POST API. Its required `action` can be supplied as the first positional argument:

```bash
# List favorites
sitedata favorites list --kind all --output json
sitedata favorites list --kind website --folder-id <folder-id> --output json

# Add and update favorites
sitedata favorites add --kind website --domain example.com --remark Research
sitedata favorites add --kind keyword --keyword "ai tools"
sitedata favorites update --kind website --id <favorite-id> --folder-id <folder-id>
sitedata favorites delete --kind keyword --id <favorite-id>

# Manage folders
sitedata favorites create-folder --name Research
sitedata favorites rename-folder --folder-id <folder-id> --name Competitors
sitedata favorites delete-folder --folder-id <folder-id>
```

The online Catalog remains the source of truth. Use `sitedata describe favorites` before automation to inspect the current action enum and parameters.

### Positional arguments and option aliases

Required parameters may be passed by name or, when unambiguous, positionally:

```bash
sitedata rankings --ranking-type traffic-growth
sitedata rankings traffic-growth
```

Catalog parameter names accept kebab-case aliases. For example, `rankingType`, `newSites`, and `folderId` can be written as `--ranking-type`, `--new-sites`, and `--folder-id`.

## Advanced usage

### Output modes

```text
--output pretty   Indented JSON (default)
--output json     Compact JSON for agents and scripts
--output raw      Original response body
--data-only       Print only the response envelope's data field
```

`--data-only` cannot be combined with `--output raw`. Successful output is written to stdout; errors and update notices are written to stderr.

### Global options

```text
    --base-url <url>       API Base URL (or SITEDATA_BASE_URL)
-o, --output <mode>        pretty, json, or raw (default: pretty)
    --data-only            Print only the response data field
    --timeout <seconds>     Request timeout (default: 45)
    --no-update             Skip automatic update for this command
-h, --help                 Show help
-V, --version              Show version
```

### Environment variables

| Variable | Purpose |
| --- | --- |
| `SITEDATA_BASE_URL` | Override the REST API Base URL |
| `SITEDATA_OAUTH_ISSUER` | Override the OAuth Issuer for development |
| `SITEDATA_OAUTH_RESOURCE` | Override the OAuth Resource for development |
| `SITEDATA_NO_UPDATE=1` | Disable automatic updates |
| `SITEDATA_PACKAGE_MANAGER` | Select `npm`, `pnpm`, `yarn`, or `bun` for global updates |

Stable releases use `https://sitedata.dev` for the API, OAuth Issuer, and OAuth Resource. Versions containing `-next` use `https://www2.sitedata.dev` as the default OAuth Issuer while retaining the production API Resource and Base URL. All endpoints can be overridden for local development.

### Automatic updates

The CLI checks the npm release channel that corresponds to the installed version. Successful checks are cached for one hour. Registry failures are retried after five minutes, and failed installations are retried after fifteen minutes.

When a newer version is found, the CLI uses the detected package manager to perform a global update. The current command continues with the already loaded version, and the new version is used on the next run. Concurrent processes use an update lock so only one attempts installation.

Automatic update failures only emit a warning to stderr; the original command continues. Automatic updates are disabled by default when `CI=true`.

```bash
sitedata update --check  # Check now without installing
sitedata update          # Check and install now
sitedata --no-update rankings traffic-growth
```

`SITEDATA_NO_UPDATE_CHECK=1` remains supported as a legacy opt-out.

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | API, authentication, network, or runtime failure |
| `2` | Invalid command or arguments |

## Development

```bash
pnpm install
pnpm check
npm pack --dry-run
```

## Security

- OAuth uses Authorization Code + PKCE; the public client contains no Client Secret.
- The callback server listens only on `127.0.0.1` using a random port.
- OAuth tokens are stored with the operating system's native credential service, not in plaintext project configuration.
- Credentials are never included in normal command output or error messages.
- CLI OAuth tokens use the REST API audience and `api:invoke` scope and cannot be used as MCP tokens.
- AI agents can make incorrect decisions. Review commands that may modify favorites or expose private business data, and grant only the necessary access.

## Related links

- [SiteData](https://sitedata.dev)
- [SiteData MCP](https://mcp.sitedata.dev/mcp)
- [SiteData CLI on npm](https://www.npmjs.com/package/@sitedata/cli)
- [Source code](https://github.com/SiteData-DEV/sitedata-cli)
- [Issue tracker](https://github.com/SiteData-DEV/sitedata-cli/issues)
