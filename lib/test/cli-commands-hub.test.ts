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
  HubAddCommand,
  HubListCommand,
  HubRefreshCommand,
  HubRemoveCommand,
  HubSyncCommand,
  HubUseCommand,
} from '../src/cli/commands/hub';
import {
  runCommand,
} from '../src/cli/framework';
import {
  createNodeFsAdapter,
} from './cli/helpers/node-fs-adapter';

const HUB_CONFIG_YAML = `version: 1.0.0
metadata:
  name: Test Hub
  description: hub for tests
  maintainer: tester
  updatedAt: "2026-01-01T00:00:00Z"
sources: []
profiles: []
`;

let tmpRoot: string;
let xdgConfig: string;
let hubDir: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prc-hub-cmd-'));
  xdgConfig = path.join(tmpRoot, 'xdg');
  hubDir = path.join(tmpRoot, 'hub-source');
  await fs.mkdir(hubDir, { recursive: true });
  await fs.writeFile(path.join(hubDir, 'hub-config.yml'), HUB_CONFIG_YAML);
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

const ctx = () => ({
  cwd: tmpRoot,
  fs: createNodeFsAdapter(),
  env: { XDG_CONFIG_HOME: xdgConfig, HOME: tmpRoot }
});

describe('hub list', () => {
  it('returns empty list when no hubs imported', async () => {
    const { exitCode, stdout } = await runCommand(
      ['hub', 'list', '-o', 'json'],
      { commandClasses: [HubListCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { data: { hubs: unknown[]; activeId: null } };
    expect(parsed.data.hubs).toStrictEqual([]);
    expect(parsed.data.activeId).toBeNull();
  });

  it('text output shows "No hubs" message when empty', async () => {
    const { exitCode, stdout } = await runCommand(
      ['hub', 'list'],
      { commandClasses: [HubListCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain('No hubs');
  });

  it('shows imported hub with active marker', async () => {
    await runCommand(
      ['hub', 'add', '--type', 'local', '--location', hubDir, '--no-sync', '-o', 'json'],
      { commandClasses: [HubAddCommand], context: ctx() }
    );
    const { exitCode, stdout } = await runCommand(
      ['hub', 'list', '-o', 'json'],
      { commandClasses: [HubListCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { data: { hubs: { id: string }[]; activeId: string } };
    expect(parsed.data.hubs.length).toBe(1);
    expect(parsed.data.hubs[0].id).toBe('test-hub');
    expect(parsed.data.activeId).toBe('test-hub');
  });
});

describe('hub add', () => {
  it('fails with USAGE.MISSING_FLAG when --location is missing', async () => {
    const { exitCode, stderr } = await runCommand(
      ['hub', 'add', '--type', 'local'],
      { commandClasses: [HubAddCommand], context: ctx() }
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('USAGE.MISSING_FLAG');
  });

  it('adds a local hub and returns the id', async () => {
    const { exitCode, stdout } = await runCommand(
      ['hub', 'add', '--type', 'local', '--location', hubDir, '--no-sync', '-o', 'json'],
      { commandClasses: [HubAddCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { data: { id: string; type: string } };
    expect(parsed.data.id).toBe('test-hub');
    expect(parsed.data.type).toBe('local');
  });

  it('adds hub with --no-use flag (not auto-used)', async () => {
    const { exitCode, stdout } = await runCommand(
      ['hub', 'add', '--type', 'local', '--location', hubDir, '--no-use', '--no-sync', '-o', 'json'],
      { commandClasses: [HubAddCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { data: { used: boolean } };
    expect(parsed.data.used).toBe(false);
  });

  it('adds hub with --no-sync flag', async () => {
    const { exitCode, stdout } = await runCommand(
      ['hub', 'add', '--type', 'local', '--location', hubDir, '--no-sync', '-o', 'json'],
      { commandClasses: [HubAddCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { data: { synced: boolean } };
    expect(parsed.data.synced).toBe(false);
  });

  it('adds hub with relative local path resolved against cwd', async () => {
    const relPath = path.relative(tmpRoot, hubDir);
    const { exitCode } = await runCommand(
      ['hub', 'add', '--type', 'local', '--location', relPath, '--no-sync', '-o', 'json'],
      { commandClasses: [HubAddCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
  });

  it('text output includes imported hub id', async () => {
    const { exitCode, stdout } = await runCommand(
      ['hub', 'add', '--type', 'local', '--location', hubDir, '--no-sync'],
      { commandClasses: [HubAddCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain('test-hub');
  });
});

describe('hub use', () => {
  it('fails with USAGE.MISSING_FLAG when no id and no --clear', async () => {
    const { exitCode, stderr } = await runCommand(
      ['hub', 'use'],
      { commandClasses: [HubUseCommand], context: ctx() }
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('USAGE.MISSING_FLAG');
  });

  it('clears active hub with --clear', async () => {
    await runCommand(
      ['hub', 'add', '--type', 'local', '--location', hubDir, '--no-sync'],
      { commandClasses: [HubAddCommand], context: ctx() }
    );
    const { exitCode, stdout } = await runCommand(
      ['hub', 'use', '--clear', '-o', 'json'],
      { commandClasses: [HubUseCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { data: { activeId: null } };
    expect(parsed.data.activeId).toBeNull();
  });

  it('sets active hub to given id', async () => {
    await runCommand(
      ['hub', 'add', '--type', 'local', '--location', hubDir, '--no-use', '--no-sync'],
      { commandClasses: [HubAddCommand], context: ctx() }
    );
    const { exitCode, stdout } = await runCommand(
      ['hub', 'use', 'test-hub', '-o', 'json'],
      { commandClasses: [HubUseCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { data: { activeId: string } };
    expect(parsed.data.activeId).toBe('test-hub');
  });

  it('text output on --clear says cleared', async () => {
    const { exitCode, stdout } = await runCommand(
      ['hub', 'use', '--clear'],
      { commandClasses: [HubUseCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain('cleared');
  });
});

describe('hub remove', () => {
  it('fails with USAGE.MISSING_FLAG when no hub id given', async () => {
    const { exitCode, stderr } = await runCommand(
      ['hub', 'remove'],
      { commandClasses: [HubRemoveCommand], context: ctx() }
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('USAGE.MISSING_FLAG');
  });

  it('removes an imported hub', async () => {
    await runCommand(
      ['hub', 'add', '--type', 'local', '--location', hubDir, '--no-sync'],
      { commandClasses: [HubAddCommand], context: ctx() }
    );
    const { exitCode, stdout } = await runCommand(
      ['hub', 'remove', 'test-hub', '-o', 'json'],
      { commandClasses: [HubRemoveCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { data: { id: string } };
    expect(parsed.data.id).toBe('test-hub');
  });

  it('text output confirms removal', async () => {
    await runCommand(
      ['hub', 'add', '--type', 'local', '--location', hubDir, '--no-sync'],
      { commandClasses: [HubAddCommand], context: ctx() }
    );
    const { exitCode, stdout } = await runCommand(
      ['hub', 'remove', 'test-hub'],
      { commandClasses: [HubRemoveCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain('test-hub');
  });
});

describe('hub sync', () => {
  it('fails with USAGE.MISSING_FLAG when no hub id and no active hub', async () => {
    const { exitCode, stderr } = await runCommand(
      ['hub', 'sync'],
      { commandClasses: [HubSyncCommand], context: ctx() }
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('USAGE.MISSING_FLAG');
  });

  it('syncs a local hub by id', async () => {
    await runCommand(
      ['hub', 'add', '--type', 'local', '--location', hubDir, '--no-sync'],
      { commandClasses: [HubAddCommand], context: ctx() }
    );
    const { exitCode, stdout } = await runCommand(
      ['hub', 'sync', 'test-hub', '-o', 'json'],
      { commandClasses: [HubSyncCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { data: { id: string } };
    expect(parsed.data.id).toBe('test-hub');
  });

  it('syncs active hub when no id given', async () => {
    await runCommand(
      ['hub', 'add', '--type', 'local', '--location', hubDir, '--no-sync'],
      { commandClasses: [HubAddCommand], context: ctx() }
    );
    const { exitCode, stdout } = await runCommand(
      ['hub', 'sync', '-o', 'json'],
      { commandClasses: [HubSyncCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { data: { id: string } };
    expect(parsed.data.id).toBe('test-hub');
  });
});

describe('hub refresh', () => {
  it('fails with HUB.NO_ACTIVE when no active hub', async () => {
    const { exitCode, stderr } = await runCommand(
      ['hub', 'refresh'],
      { commandClasses: [HubRefreshCommand], context: ctx() }
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('HUB.NO_ACTIVE');
  });

  it('refreshes the active hub', async () => {
    await runCommand(
      ['hub', 'add', '--type', 'local', '--location', hubDir, '--no-sync'],
      { commandClasses: [HubAddCommand], context: ctx() }
    );
    const { exitCode, stdout } = await runCommand(
      ['hub', 'refresh', '-o', 'json'],
      { commandClasses: [HubRefreshCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { data: { id: string } };
    expect(parsed.data.id).toBe('test-hub');
  });

  it('text output confirms refresh', async () => {
    await runCommand(
      ['hub', 'add', '--type', 'local', '--location', hubDir, '--no-sync'],
      { commandClasses: [HubAddCommand], context: ctx() }
    );
    const { exitCode, stdout } = await runCommand(
      ['hub', 'refresh'],
      { commandClasses: [HubRefreshCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain('test-hub');
  });
});
