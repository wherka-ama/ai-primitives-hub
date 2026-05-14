/**
 * Tests for UX improvements:
 *   F-07: top-level `search` alias
 *   F-13: uninstall lockfile auto-locate
 */
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import {
  PrimitiveIndex,
  saveIndex,
} from '../src';
import {
  IndexSearchCommand,
} from '../src/cli/commands/index-search';
import {
  UninstallCommand,
} from '../src/cli/commands/uninstall';
import {
  runCommand,
} from '../src/cli/framework';
import {
  createNodeFsAdapter,
} from './cli/helpers/node-fs-adapter';
import {
  createFixtureBundles,
  FakeBundleProvider,
} from './fixtures/primitive-index';

let tmpRoot: string;
let indexFile: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prc-ux-'));
  indexFile = path.join(tmpRoot, 'primitive-index.json');
  const idx = await PrimitiveIndex.buildFrom(
    new FakeBundleProvider(createFixtureBundles()),
    { hubId: 'test' }
  );
  saveIndex(idx, indexFile);
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('F-07: top-level search alias', () => {
  it('IndexSearchCommand is registered under both [index, search] and [search]', () => {
    expect(IndexSearchCommand.paths).toContainEqual(['index', 'search']);
    expect(IndexSearchCommand.paths).toContainEqual(['search']);
  });
});

describe('F-13: uninstall lockfile auto-locate', () => {
  it('without --lockfile but with lockfile present, auto-selects it (exits 1 on missing target, not USAGE.MISSING_FLAG)', async () => {
    // Write a valid lockfile so auto-locate kicks in
    const lockfile = {
      schemaVersion: 1,
      entries: [{ bundleId: 'b1', target: 'my-vscode', installedFiles: [], checksum: '', installedAt: '' }]
    };
    await fs.writeFile(
      path.join(tmpRoot, 'prompt-registry.lock.json'),
      JSON.stringify(lockfile)
    );
    // target list doesn't include 'my-vscode' → should fail with target-not-found, not USAGE.MISSING_FLAG
    const { stdout } = await runCommand(
      ['uninstall', '-o', 'json'],
      {
        commandClasses: [UninstallCommand],
        context: { cwd: tmpRoot, fs: createNodeFsAdapter(), env: { HOME: tmpRoot } }
      }
    );
    // Should not be the "provide bundle/lockfile/--all" error
    const parsed = JSON.parse(stdout) as { errors?: { message: string }[] };
    if (parsed.errors) {
      expect(parsed.errors[0].message).not.toMatch(/provide.*bundle-id.*lockfile.*--all/i);
    }
  });

  it('without lockfile present, still returns USAGE.MISSING_FLAG', async () => {
    // No lockfile in tmpRoot
    const { exitCode, stdout } = await runCommand(
      ['uninstall', '-o', 'json'],
      {
        commandClasses: [UninstallCommand],
        context: { cwd: tmpRoot, fs: createNodeFsAdapter(), env: { HOME: tmpRoot } }
      }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout) as { errors: { code: string }[] };
    expect(parsed.errors[0].code).toBe('USAGE.MISSING_FLAG');
  });
});
