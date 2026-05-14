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
  createInitCommand,
} from '../src/cli/commands/init';
import {
  runCommand,
} from '../src/cli/framework';
import {
  createNodeFsAdapter,
} from './cli/helpers/node-fs-adapter';

let tmpRoot: string;
let xdgConfig: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prc-init-'));
  xdgConfig = path.join(tmpRoot, 'xdg-config');
  await fs.mkdir(xdgConfig, { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('cli `init`', () => {
  it('creates prompt-registry.yml with default target on blank project', async () => {
    const { exitCode, stdout, stderr } = await runCommand(
      ['init'],
      {
        commands: [createInitCommand({ output: 'json', yes: true })],
        context: {
          cwd: tmpRoot,
          fs: createNodeFsAdapter(),
          env: { XDG_CONFIG_HOME: xdgConfig, HOME: tmpRoot }
        }
      }
    );
    expect(stderr).toBe('');
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as {
      status: string;
      data: { target: { name: string; type: string } };
    };
    expect(parsed.status).toBe('ok');
    expect(parsed.data.target.name).toBe('copilot');
    expect(parsed.data.target.type).toBe('copilot-cli');

    const configExists = await fs
      .access(path.join(tmpRoot, 'prompt-registry.yml'))
      .then(() => true)
      .catch(() => false);
    expect(configExists).toBe(true);
  });

  it('accepts custom target name and type', async () => {
    const { exitCode, stdout } = await runCommand(
      ['init'],
      {
        commands: [createInitCommand({
          output: 'json',
          yes: true,
          targetName: 'my-workspace',
          targetType: 'vscode'
        })],
        context: {
          cwd: tmpRoot,
          fs: createNodeFsAdapter(),
          env: { XDG_CONFIG_HOME: xdgConfig, HOME: tmpRoot }
        }
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as {
      data: { target: { name: string; type: string } };
    };
    expect(parsed.data.target.name).toBe('my-workspace');
    expect(parsed.data.target.type).toBe('vscode');
  });

  it('exits 1 with USAGE.MISSING_FLAG for unknown target type', async () => {
    const { exitCode, stdout } = await runCommand(
      ['init'],
      {
        commands: [createInitCommand({
          output: 'json',
          yes: true,
          targetType: 'not-a-real-type'
        })],
        context: {
          cwd: tmpRoot,
          fs: createNodeFsAdapter(),
          env: { XDG_CONFIG_HOME: xdgConfig, HOME: tmpRoot }
        }
      }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout) as { errors: { code: string }[] };
    expect(parsed.errors[0].code).toBe('USAGE.MISSING_FLAG');
  });

  it('returns hub: null in data when no --hub flag supplied', async () => {
    const { exitCode, stdout } = await runCommand(
      ['init'],
      {
        commands: [createInitCommand({ output: 'json', yes: true })],
        context: {
          cwd: tmpRoot,
          fs: createNodeFsAdapter(),
          env: { XDG_CONFIG_HOME: xdgConfig, HOME: tmpRoot }
        }
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { data: { hub: null } };
    expect(parsed.data.hub).toBeNull();
  });

  it('text output includes next-steps hint when no hub supplied', async () => {
    const { exitCode, stdout } = await runCommand(
      ['init'],
      {
        commands: [createInitCommand({ output: 'text', yes: true })],
        context: {
          cwd: tmpRoot,
          fs: createNodeFsAdapter(),
          env: { XDG_CONFIG_HOME: xdgConfig, HOME: tmpRoot }
        }
      }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain('hub add');
  });
});
