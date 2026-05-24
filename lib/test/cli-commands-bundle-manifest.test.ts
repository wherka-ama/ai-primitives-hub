import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import {
  createBundleManifestCommand,
} from '../src/cli/commands/bundle-manifest';
import {
  type FsAbstraction,
  runCommand,
} from '../src/cli/framework';
import {
  createNodeFsAdapter,
} from './cli/helpers/node-fs-adapter';

let tmpRoot: string;
let realFs: FsAbstraction;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prc-bundle-manifest-'));
  await fs.mkdir(path.join(tmpRoot, 'collections'), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, 'prompts'), { recursive: true });
  await fs.writeFile(
    path.join(tmpRoot, 'prompts', 'foo.prompt.md'),
    '# Foo Prompt\n\n> Brief description here.\n\nBody of the prompt.\n'
  );
  await fs.writeFile(
    path.join(tmpRoot, 'collections', 'demo.collection.yml'),
    `id: demo
name: Demo
description: A demo collection.
tags: [demo]
items:
  - path: prompts/foo.prompt.md
    kind: prompt
`
  );
  realFs = createNodeFsAdapter();
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('bundle manifest', () => {
  it('writes a manifest file and reports the totals', async () => {
    const outFile = path.join(tmpRoot, 'deployment-manifest.yml');
    const result = await runCommand(['bundle', 'manifest'], {
      commands: [createBundleManifestCommand({
        output: 'json',
        version: '1.0.0',
        collectionFile: 'collections/demo.collection.yml',
        outFile
      })],
      context: { cwd: tmpRoot, fs: realFs }
    });
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      data: { id: string; version: string; totalItems: number };
    };
    expect(parsed.data.id).toBe('demo');
    expect(parsed.data.version).toBe('1.0.0');
    expect(parsed.data.totalItems).toBe(1);
    const manifestText = await fs.readFile(outFile, 'utf8');
    const manifest = yaml.load(manifestText) as { id: string; prompts: { id: string }[] };
    expect(manifest.id).toBe('demo');
    expect(manifest.prompts[0].id).toBe('foo.prompt');
  });

  it('exits 1 when an item file is missing', async () => {
    await fs.rm(path.join(tmpRoot, 'prompts', 'foo.prompt.md'));
    const result = await runCommand(['bundle', 'manifest'], {
      commands: [createBundleManifestCommand({
        output: 'json',
        version: '1.0.0',
        collectionFile: 'collections/demo.collection.yml',
        outFile: path.join(tmpRoot, 'm.yml')
      })],
      context: { cwd: tmpRoot, fs: realFs }
    });
    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.stdout) as { errors: { code: string }[] };
    expect(parsed.errors[0].code).toBe('BUNDLE.ITEM_NOT_FOUND');
  });

  it('exits 1 when collections/ directory is missing and no explicit file', async () => {
    await fs.rm(path.join(tmpRoot, 'collections'), { recursive: true });
    const result = await runCommand(['bundle', 'manifest'], {
      commands: [createBundleManifestCommand({
        output: 'json',
        version: '1.0.0',
        outFile: path.join(tmpRoot, 'm.yml')
      })],
      context: { cwd: tmpRoot, fs: realFs }
    });
    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.stdout) as { errors: { code: string }[] };
    expect(parsed.errors[0].code).toBe('FS.NOT_FOUND');
  });

  it('exits 1 when no collection.yml files exist in collections/', async () => {
    await fs.rm(path.join(tmpRoot, 'collections', 'demo.collection.yml'));
    const result = await runCommand(['bundle', 'manifest'], {
      commands: [createBundleManifestCommand({
        output: 'json',
        version: '1.0.0',
        outFile: path.join(tmpRoot, 'm.yml')
      })],
      context: { cwd: tmpRoot, fs: realFs }
    });
    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.stdout) as { errors: { code: string }[] };
    expect(parsed.errors[0].code).toBe('BUNDLE.NOT_FOUND');
  });

  it('extracts metadata from markdown with description blockquote', async () => {
    await fs.writeFile(
      path.join(tmpRoot, 'prompts', 'foo.prompt.md'),
      '# Foo\n\n> Description from blockquote\n\nBody\n'
    );
    const result = await runCommand(['bundle', 'manifest'], {
      commands: [createBundleManifestCommand({
        output: 'json',
        version: '1.0.0',
        collectionFile: 'collections/demo.collection.yml',
        outFile: path.join(tmpRoot, 'm.yml')
      })],
      context: { cwd: tmpRoot, fs: realFs }
    });
    expect(result.exitCode).toBe(0);
    const manifestText = await fs.readFile(path.join(tmpRoot, 'm.yml'), 'utf8');
    const manifest = yaml.load(manifestText) as { prompts: { description: string }[] };
    expect(manifest.prompts[0].description).toBe('Description from blockquote');
  });

  it('includes MCP server count in output when mcpServers is defined', async () => {
    await fs.writeFile(
      path.join(tmpRoot, 'collections', 'demo.collection.yml'),
      `id: demo
name: Demo
mcpServers:
  server1: {}
  server2: {}
items:
  - path: prompts/foo.prompt.md
    kind: prompt
`
    );
    const result = await runCommand(['bundle', 'manifest'], {
      commands: [createBundleManifestCommand({
        output: 'text',
        version: '1.0.0',
        collectionFile: 'collections/demo.collection.yml',
        outFile: path.join(tmpRoot, 'm.yml')
      })],
      context: { cwd: tmpRoot, fs: realFs }
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('MCP Servers: 2');
  });

  it('renders text output with item type breakdown', async () => {
    const result = await runCommand(['bundle', 'manifest'], {
      commands: [createBundleManifestCommand({
        output: 'text',
        version: '1.0.0',
        collectionFile: 'collections/demo.collection.yml',
        outFile: path.join(tmpRoot, 'm.yml')
      })],
      context: { cwd: tmpRoot, fs: realFs }
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Generated');
    expect(result.stdout).toContain('total items: 1');
  });
});
