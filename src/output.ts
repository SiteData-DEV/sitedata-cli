import { toKebabCase } from './schema.js';
import type { OutputMode } from './arguments.js';
import type { JsonSchema, PublicApiDefinition } from './types.js';

function stringify(value: unknown, mode: OutputMode): string {
  return JSON.stringify(value, null, mode === 'pretty' ? 2 : undefined) ?? 'null';
}

export function renderValue(value: unknown, mode: OutputMode): string {
  if (mode === 'raw' && typeof value === 'string') return value;
  return stringify(value, mode);
}

export function renderGeneralHelp(): string {
  return [
    'SiteData CLI',
    '',
    'Usage:',
    '  sitedata login',
    '  sitedata logout',
    '  sitedata auth status',
    '  sitedata update [--check]',
    '  sitedata list [global options]',
    '  sitedata describe <api> [global options]',
    '  sitedata <api> [arguments] [global options]',
    '',
    'Examples:',
    '  sitedata login',
    '  sitedata rankings traffic-growth --output json',
    '  sitedata favorites list --kind website --output json',
    '  sitedata favorites create-folder --name Research',
    '',
    'Global options:',
    '      --base-url <url>       API base URL (or SITEDATA_BASE_URL)',
    '  -o, --output <mode>        pretty, json, or raw (default: pretty)',
    '      --data-only            Print only the response data field',
    '      --timeout <seconds>     Request timeout (default: 45)',
    '      --no-update             Skip automatic update for this command',
    '  -h, --help                 Show help',
    '  -V, --version              Show version',
    '',
    'Run "sitedata list" to see all APIs.',
  ].join('\n');
}

function schemaType(schema: JsonSchema): string {
  if (schema.enum?.length) {
    return schema.enum
      .map((item) => (typeof item === 'string' ? toKebabCase(item) : item))
      .join('|');
  }
  if (schema.type === 'array') return (schema.items?.type ?? 'value') + '[]';
  return schema.type;
}

function renderModes(definition: PublicApiDefinition): string[] {
  const branches = definition.inputSchema.oneOf ?? [];
  if (!branches.length) return [];
  return [
    '',
    'Modes:',
    ...branches.map((branch) => {
      const action = branch.properties?.action?.enum?.[0];
      const mode = typeof action === 'string'
        ? toKebabCase(action)
        : toKebabCase(branch.required?.[0] ?? 'mode');
      const required = (branch.required ?? [])
        .filter((name) => name !== 'action')
        .map((name) => {
          const schema = definition.inputSchema.properties?.[name];
          return '--' + toKebabCase(name) + ' <' +
            schemaType(schema ?? { type: 'string' }) + '>';
        })
        .join(' ');
      return '  ' + mode + (required ? '  ' + required : '');
    }),
  ];
}

function renderExamples(definition: PublicApiDefinition): string[] {
  const examples = definition.inputSchema.examples ?? [];
  const lines = examples
    .filter((example): example is Record<string, unknown> =>
      typeof example === 'object' && example !== null && !Array.isArray(example)
    )
    .map((example) => {
      const action = typeof example.action === 'string' ? example.action : undefined;
      const argumentsText = Object.entries(example)
        .filter(([name]) => name !== 'action')
        .map(([name, value]) =>
          '--' + toKebabCase(name) + ' ' + JSON.stringify(value)
        )
        .join(' ');
      return '  sitedata ' + definition.id +
        (action ? ' ' + toKebabCase(action) : '') +
        (argumentsText ? ' ' + argumentsText : '');
    });
  return lines.length ? ['', 'Examples:', ...lines] : [];
}

export function renderDescription(definition: PublicApiDefinition): string {
  const required = new Set(definition.inputSchema.required ?? []);
  const properties = Object.entries(definition.inputSchema.properties ?? {});
  const usageOptions = properties
    .filter(([name]) => required.has(name))
    .map(([name]) => '--' + toKebabCase(name) + ' <value>')
    .join(' ');
  const lines = [
    definition.id,
    definition.description,
    '',
    'Usage:',
    '  sitedata ' + definition.id + (usageOptions ? ' ' + usageOptions : ''),
  ];

  if (properties.length) {
    lines.push('', 'Arguments:');
    const labels = properties.map(([name, schema]) => {
      const requiredLabel = required.has(name) ? ' (required)' : '';
      return '  --' + toKebabCase(name) + ' <' + schemaType(schema) + '>' + requiredLabel;
    });
    const width = Math.max(...labels.map((label) => label.length));
    for (let index = 0; index < properties.length; index += 1) {
      const schema = properties[index]?.[1];
      let description = schema?.description ?? '';
      if (schema?.default !== undefined) {
        description += (description ? '; ' : '') + 'default: ' + schema.default;
      }
      lines.push((labels[index] ?? '').padEnd(width + 2) + description);
    }
  } else {
    lines.push('', 'This API has no arguments.');
  }

  lines.push(...renderModes(definition), ...renderExamples(definition));

  lines.push('', 'Endpoint: ' + definition.method + ' ' + definition.path);
  if (definition.docsPath) {
    lines.push('Docs: https://sitedata.dev' + definition.docsPath);
  }
  return lines.join('\n');
}

export function renderCatalog(
  catalog: readonly PublicApiDefinition[],
  mode: OutputMode
): string {
  if (mode !== 'pretty') {
    return stringify(
      catalog.map(({ id, method, path, description, docsPath, inputSchema }) => ({
        id,
        method,
        path,
        description,
        ...(docsPath ? { docsPath } : {}),
        inputSchema,
      })),
      mode
    );
  }

  const width = Math.max(...catalog.map((definition) => definition.id.length));
  return catalog
    .map(
      (definition) =>
        '  ' + definition.id.padEnd(width) + '  ' + definition.description
    )
    .join('\n');
}
