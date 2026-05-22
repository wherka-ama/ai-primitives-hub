/**
 * Tests for `index search --install` and `index search --install --interactive`.
 *
 * Covers:
 *  - Plain search (no `--install`) is unaffected
 *  - `--install` with zero hits → exit 0, no prompt
 *  - `--install` (non-interactive) with hits but no active hub → stderr, exit 1
 *  - `--install` (non-interactive) with hits, active hub, no matching sources → exit 0, no prompt
 *  - `--install --interactive` with hits and matching source → shows checkbox prompt
 */
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import inquirer from 'inquirer';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  PrimitiveIndex,
  saveIndex,
} from '../src';
import {
  createIndexSearchCommand,
} from '../src/cli/commands/index-search';
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

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}));

let tmp: string;
let xdgConfig: string;
let indexFile: string;

beforeEach(async () => {
  tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'prc-srch-install-'));
  xdgConfig = path.join(tmp, 'xdg');
  await fsp.mkdir(xdgConfig, { recursive: true });
  indexFile = path.join(tmp, 'primitive-index.json');
  const idx = await PrimitiveIndex.buildFrom(
    new FakeBundleProvider(createFixtureBundles()),
    { hubId: 'test' }
  );
  saveIndex(idx, indexFile);
  vi.clearAllMocks();
});

afterEach(async () => {
  await fsp.rm(tmp, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('index search --install', () => {
  it('plain search (no --install) exits 0 and produces search output', async () => {
    const { exitCode, stdout } = await runCommand(
      ['index', 'search'],
      {
        commands: [createIndexSearchCommand({ query: 'rust', indexFile, output: 'json' })],
        context: { cwd: tmp, fs: createNodeFsAdapter(), env: { XDG_CONFIG_HOME: xdgConfig, HOME: tmp } }
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { status: string; data: { hits: unknown[] } };
    expect(parsed.status).toBe('ok');
    expect(Array.isArray(parsed.data.hits)).toBe(true);
  });

  it('--install with zero hits exits 0 without touching hub', async () => {
    const { exitCode, stdout } = await runCommand(
      ['index', 'search'],
      {
        commands: [createIndexSearchCommand({
          query: 'zzzzz-no-match',
          indexFile,
          output: 'json',
          install: true
        })],
        context: { cwd: tmp, fs: createNodeFsAdapter(), env: { XDG_CONFIG_HOME: xdgConfig, HOME: tmp } }
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { status: string; data: { hits: unknown[] } };
    expect(parsed.status).toBe('ok');
    expect(parsed.data.hits).toHaveLength(0);
  });

  it('--install with hits but no active hub writes error to stderr and exits 1', async () => {
    const { exitCode, stdout, stderr } = await runCommand(
      ['index', 'search'],
      {
        commands: [createIndexSearchCommand({
          query: 'python',
          indexFile,
          output: 'json',
          install: true
        })],
        context: { cwd: tmp, fs: createNodeFsAdapter(), env: { XDG_CONFIG_HOME: xdgConfig, HOME: tmp } }
      }
    );
    expect(exitCode, `stdout=${stdout} stderr=${stderr}`).toBe(1);
    expect(stderr).toMatch(/No active hub/i);
  });

  it('--install (non-interactive) with hits, active hub, no matching sources → exits 0, no prompt', async () => {
    const hubsDir = path.join(xdgConfig, 'prompt-registry', 'hubs');
    await fsp.mkdir(hubsDir, { recursive: true });

    const activeHubId = 'test-hub';
    const hubYaml = [
      `version: "1.0.0"`,
      `metadata:`,
      `  name: Test Hub`,
      `  description: Test`,
      `  maintainer: test`,
      `sources: []`,
      `profiles: []`
    ].join('\n') + '\n';
    await fsp.writeFile(path.join(hubsDir, `${activeHubId}.yml`), hubYaml, 'utf8');

    const activeHubPath = path.join(xdgConfig, 'prompt-registry', 'active-hub.json');
    await fsp.writeFile(activeHubPath, JSON.stringify({ hubId: activeHubId }), 'utf8');

    const { exitCode } = await runCommand(
      ['index', 'search'],
      {
        commands: [createIndexSearchCommand({
          query: 'python',
          indexFile,
          output: 'json',
          install: true
        })],
        context: { cwd: tmp, fs: createNodeFsAdapter(), env: { XDG_CONFIG_HOME: xdgConfig, HOME: tmp } }
      }
    );
    expect(exitCode).toBe(0);
    expect(vi.mocked(inquirer.prompt)).not.toHaveBeenCalled();
  });

  it('--install --interactive with hits and matching hub source → shows checkbox prompt', async () => {
    vi.mocked(inquirer.prompt).mockResolvedValueOnce({ selectedIds: [] });

    const hubsDir = path.join(xdgConfig, 'prompt-registry', 'hubs');
    await fsp.mkdir(hubsDir, { recursive: true });

    const activeHubId = 'test-hub';
    const hubYaml = [
      `version: "1.0.0"`,
      `metadata:`,
      `  name: Test Hub`,
      `  description: Test`,
      `  maintainer: test`,
      `sources:`,
      `  - id: github-def`,
      `    name: GitHub Def`,
      `    type: github`,
      `    url: https://github.com/test/github-def`,
      `    enabled: true`,
      `    priority: 1`,
      `profiles: []`
    ].join('\n') + '\n';
    await fsp.writeFile(path.join(hubsDir, `${activeHubId}.yml`), hubYaml, 'utf8');

    const activeHubPath = path.join(xdgConfig, 'prompt-registry', 'active-hub.json');
    await fsp.writeFile(activeHubPath, JSON.stringify({ hubId: activeHubId }), 'utf8');

    const { exitCode } = await runCommand(
      ['index', 'search'],
      {
        commands: [createIndexSearchCommand({
          query: 'python',
          indexFile,
          output: 'json',
          install: true,
          interactive: true
        })],
        context: { cwd: tmp, fs: createNodeFsAdapter(), env: { XDG_CONFIG_HOME: xdgConfig, HOME: tmp } }
      }
    );
    expect(exitCode).toBe(0);
    expect(vi.mocked(inquirer.prompt)).toHaveBeenCalled();
  });
});
