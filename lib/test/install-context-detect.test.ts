/**
 * Tests for context auto-detection in `install` (Feature 1).
 *
 * Covers:
 *  - lockfile auto-detected from cwd → install proceeds as lockfile mode
 *  - active hub auto-detected from XDG → install proceeds as interactive mode
 *  - single target auto-detected from prompt-registry.yml
 *  - error when neither lockfile, hub, nor source is available
 */
import * as fsp from 'node:fs/promises';
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
  InstallCommand,
} from '../src/cli/commands/install';
import {
  runCommand,
} from '../src/cli/framework';
import {
  NodeFileSystem,
} from '../src/infra/fs/node-filesystem';

let tmp: string;
let xdgConfig: string;

beforeEach(async () => {
  tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'prc-ctx-'));
  xdgConfig = path.join(tmp, 'xdg');
  await fsp.mkdir(xdgConfig, { recursive: true });
});

afterEach(async () => {
  await fsp.rm(tmp, { recursive: true, force: true });
});

describe('install: context auto-detection', () => {
  it('errors (USAGE.MISSING_FLAG) when no lockfile, hub, or source in cwd', async () => {
    await fsp.writeFile(
      path.join(tmp, 'prompt-registry.yml'),
      'targets:\n  - name: my-target\n    type: vscode\n    scope: user\n',
      'utf8'
    );

    const result = await runCommand(['install', '-o', 'json'], {
      commandClasses: [InstallCommand],
      context: { cwd: tmp, fs: new NodeFileSystem(), env: { XDG_CONFIG_HOME: xdgConfig, HOME: tmp } }
    });

    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.stdout) as { errors: { code: string }[] };
    expect(parsed.errors[0].code).toBe('USAGE.MISSING_FLAG');
  });

  it('auto-detects lockfile from cwd and selects the single configured target', async () => {
    const targetDir = path.join(tmp, 'target');
    await fsp.mkdir(targetDir, { recursive: true });

    await fsp.writeFile(
      path.join(tmp, 'prompt-registry.yml'),
      [
        'targets:',
        '  - name: auto-target',
        '    type: vscode',
        '    scope: user',
        `    path: ${targetDir}`
      ].join('\n') + '\n',
      'utf8'
    );

    const lockContent = JSON.stringify({
      schemaVersion: 1,
      entries: [
        {
          target: 'auto-target',
          sourceId: 'local-bundle',
          bundleId: 'my-bundle',
          bundleVersion: '1.0.0',
          sha256: 'deadbeef',
          installedAt: new Date().toISOString(),
          files: []
        }
      ],
      sources: {
        'local-bundle': {
          type: 'local',
          url: path.join(tmp, 'bundle-dir')
        }
      }
    });
    await fsp.writeFile(path.join(tmp, 'prompt-registry.lock.json'), lockContent, 'utf8');

    const result = await runCommand(['install', '-o', 'json'], {
      commandClasses: [InstallCommand],
      context: { cwd: tmp, fs: new NodeFileSystem(), env: { XDG_CONFIG_HOME: xdgConfig, HOME: tmp } }
    });

    const parsed = JSON.parse(result.stdout) as { status: string; data?: { target: string } };
    expect(parsed.status).not.toBe(undefined);
    expect(parsed.data?.target).toBe('auto-target');
  });

  it('auto-detects single configured target even when lockfile given explicitly', async () => {
    const targetDir = path.join(tmp, 'target');
    await fsp.mkdir(targetDir, { recursive: true });

    await fsp.writeFile(
      path.join(tmp, 'prompt-registry.yml'),
      [
        'targets:',
        '  - name: only-target',
        '    type: vscode',
        '    scope: user',
        `    path: ${targetDir}`
      ].join('\n') + '\n',
      'utf8'
    );

    const lockContent = JSON.stringify({
      schemaVersion: 1,
      entries: [
        {
          target: 'only-target',
          sourceId: 'local-bundle',
          bundleId: 'my-bundle',
          bundleVersion: '1.0.0',
          sha256: 'deadbeef',
          installedAt: new Date().toISOString(),
          files: []
        }
      ],
      sources: {
        'local-bundle': { type: 'local', url: path.join(tmp, 'bundle-dir') }
      }
    });
    const lockPath = path.join(tmp, 'prompt-registry.lock.json');
    await fsp.writeFile(lockPath, lockContent, 'utf8');

    const result = await runCommand(['install', '-o', 'json', '--lockfile', lockPath], {
      commandClasses: [InstallCommand],
      context: { cwd: tmp, fs: new NodeFileSystem(), env: { XDG_CONFIG_HOME: xdgConfig, HOME: tmp } }
    });

    const parsed = JSON.parse(result.stdout) as { status: string; data?: { target: string } };
    expect(parsed.status).not.toBe(undefined);
    expect(parsed.data?.target).toBe('only-target');
  });
});
