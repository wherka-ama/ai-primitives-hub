/**
 * Tests for context auto-detection in `uninstall` (symmetry with install).
 *
 * Covers:
 *  - lockfile auto-detected from cwd + single target from prompt-registry.yml → exits 0
 *  - explicit --lockfile + single target auto-detected → exits 0
 *  - multiple targets configured → USAGE.MISSING_FLAG with list of names
 *  - no lockfile, no config → USAGE.MISSING_FLAG (no context available)
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
  UninstallCommand,
} from '../src/cli/commands/uninstall';
import {
  runCommand,
} from '../src/cli/framework';
import {
  NodeFileSystem,
} from '../src/infra/fs/node-filesystem';

let tmp: string;
let xdgConfig: string;

beforeEach(async () => {
  tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'prc-uninst-'));
  xdgConfig = path.join(tmp, 'xdg');
  await fsp.mkdir(xdgConfig, { recursive: true });
});

afterEach(async () => {
  await fsp.rm(tmp, { recursive: true, force: true });
});

/**
 * Minimal valid lockfile with zero entries for the given target.
 * @param targetName
 */
function emptyLockfile(targetName: string): string {
  return JSON.stringify({
    schemaVersion: 1,
    entries: [
      {
        target: targetName,
        sourceId: 'local-bundle',
        bundleId: 'some-bundle',
        bundleVersion: '1.0.0',
        installedAt: new Date().toISOString(),
        files: []
      }
    ],
    sources: { 'local-bundle': { type: 'local', url: '/dev/null' } }
  });
}

const fs = new NodeFileSystem();

describe('uninstall: context auto-detection', () => {
  it('auto-detects lockfile from cwd and single target from prompt-registry.yml → exits 0', async () => {
    await fsp.writeFile(
      path.join(tmp, 'prompt-registry.yml'),
      'targets:\n  - name: my-vscode\n    type: vscode\n    scope: user\n',
      'utf8'
    );
    await fsp.writeFile(
      path.join(tmp, 'prompt-registry.lock.json'),
      emptyLockfile('my-vscode'),
      'utf8'
    );

    const result = await runCommand(['uninstall', '-o', 'json'], {
      commandClasses: [UninstallCommand],
      context: { cwd: tmp, fs, env: { XDG_CONFIG_HOME: xdgConfig, HOME: tmp } }
    });

    expect(result.exitCode, `stderr=${result.stderr}`).toBe(0);
    const parsed = JSON.parse(result.stdout) as { status: string; data: { target: string } };
    expect(parsed.status).toBe('ok');
    expect(parsed.data.target).toBe('my-vscode');
  });

  it('auto-detects single target when --lockfile is provided explicitly', async () => {
    const lockPath = path.join(tmp, 'custom.lock.json');
    await fsp.writeFile(
      path.join(tmp, 'prompt-registry.yml'),
      'targets:\n  - name: only-target\n    type: copilot-cli\n    scope: user\n',
      'utf8'
    );
    await fsp.writeFile(lockPath, emptyLockfile('only-target'), 'utf8');

    const result = await runCommand(['uninstall', '--lockfile', lockPath, '-o', 'json'], {
      commandClasses: [UninstallCommand],
      context: { cwd: tmp, fs, env: { XDG_CONFIG_HOME: xdgConfig, HOME: tmp } }
    });

    expect(result.exitCode, `stderr=${result.stderr}`).toBe(0);
    const parsed = JSON.parse(result.stdout) as { status: string; data: { target: string } };
    expect(parsed.status).toBe('ok');
    expect(parsed.data.target).toBe('only-target');
  });

  it('errors with multi-target hint when multiple targets configured and no --target given', async () => {
    await fsp.writeFile(
      path.join(tmp, 'prompt-registry.yml'),
      [
        'targets:',
        '  - name: vsc-target',
        '    type: vscode',
        '    scope: user',
        '  - name: cli-target',
        '    type: copilot-cli',
        '    scope: user'
      ].join('\n') + '\n',
      'utf8'
    );
    await fsp.writeFile(
      path.join(tmp, 'prompt-registry.lock.json'),
      emptyLockfile('vsc-target'),
      'utf8'
    );

    const result = await runCommand(['uninstall', '-o', 'json'], {
      commandClasses: [UninstallCommand],
      context: { cwd: tmp, fs, env: { XDG_CONFIG_HOME: xdgConfig, HOME: tmp } }
    });

    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.stdout) as { errors: { code: string; hint?: string }[] };
    expect(parsed.errors[0].code).toBe('USAGE.MISSING_FLAG');
    expect(parsed.errors[0].hint).toMatch(/Multiple targets configured/);
    expect(parsed.errors[0].hint).toMatch(/vsc-target/);
    expect(parsed.errors[0].hint).toMatch(/cli-target/);
  });

  it('errors when no lockfile, no config, and no args → USAGE.MISSING_FLAG', async () => {
    const result = await runCommand(['uninstall', '-o', 'json'], {
      commandClasses: [UninstallCommand],
      context: { cwd: tmp, fs, env: { XDG_CONFIG_HOME: xdgConfig, HOME: tmp } }
    });

    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.stdout) as { errors: { code: string }[] };
    expect(parsed.errors[0].code).toBe('USAGE.MISSING_FLAG');
  });

  it('respects explicit --target even when single target is configured differently', async () => {
    await fsp.writeFile(
      path.join(tmp, 'prompt-registry.yml'),
      'targets:\n  - name: auto-target\n    type: vscode\n    scope: user\n',
      'utf8'
    );
    const lockPath = path.join(tmp, 'prompt-registry.lock.json');
    await fsp.writeFile(lockPath, emptyLockfile('explicit-target'), 'utf8');

    const result = await runCommand(['uninstall', '--target', 'explicit-target', '--lockfile', lockPath, '-o', 'json'], {
      commandClasses: [UninstallCommand],
      context: { cwd: tmp, fs, env: { XDG_CONFIG_HOME: xdgConfig, HOME: tmp } }
    });

    expect(result.exitCode).toBe(1);
    const parsed = JSON.parse(result.stdout) as { errors: { code: string; message: string }[] };
    expect(parsed.errors[0].code).toBe('USAGE.MISSING_FLAG');
    expect(parsed.errors[0].message).toMatch(/explicit-target.*not configured/);
  });
});
