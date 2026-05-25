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
} from '../src/cli/commands/hub';
import {
  ProfileCreateCommand,
  ProfileCurrentCommand,
  ProfileDeactivateCommand,
  ProfileEditCommand,
  ProfileListCommand,
  ProfileShowCommand,
} from '../src/cli/commands/profile';
import {
  runCommand,
} from '../src/cli/framework';
import {
  createNodeFsAdapter,
} from './cli/helpers/node-fs-adapter';

const HUB_WITH_PROFILES = `version: 1.0.0
metadata:
  name: Test Hub
  description: hub for tests
  maintainer: tester
  updatedAt: "2026-01-01T00:00:00Z"
sources: []
profiles:
  - id: backend
    name: Backend Developer
    bundles: []
  - id: frontend
    name: Frontend Developer
    bundles: []
`;

let tmpRoot: string;
let xdgConfig: string;
let hubDir: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prc-profile-cmd-'));
  xdgConfig = path.join(tmpRoot, 'xdg');
  hubDir = path.join(tmpRoot, 'hub-source');
  await fs.mkdir(hubDir, { recursive: true });
  await fs.writeFile(path.join(hubDir, 'hub-config.yml'), HUB_WITH_PROFILES);
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

const ctx = () => ({
  cwd: tmpRoot,
  fs: createNodeFsAdapter(),
  env: { XDG_CONFIG_HOME: xdgConfig, HOME: tmpRoot }
});

const addHub = async () => {
  await runCommand(
    ['hub', 'add', '--type', 'local', '--location', hubDir, '--no-sync'],
    { commandClasses: [HubAddCommand], context: ctx() }
  );
};

describe('profile list', () => {
  it('fails with HUB.NOT_FOUND when no hub active and no --hub given', async () => {
    const { exitCode, stdout } = await runCommand(
      ['profile', 'list', '-o', 'json'],
      { commandClasses: [ProfileListCommand], context: ctx() }
    );
    expect(exitCode).toBe(1);
    expect(stdout).toContain('HUB.NOT_FOUND');
  });

  it('lists profiles from active hub', async () => {
    await addHub();
    const { exitCode, stdout } = await runCommand(
      ['profile', 'list', '-o', 'json'],
      { commandClasses: [ProfileListCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { data: { profiles: { id: string }[] } };
    expect(parsed.data.profiles.length).toBe(2);
    expect(parsed.data.profiles.map((p) => p.id)).toContain('backend');
    expect(parsed.data.profiles.map((p) => p.id)).toContain('frontend');
  });

  it('text output shows profile names', async () => {
    await addHub();
    const { exitCode, stdout } = await runCommand(
      ['profile', 'list'],
      { commandClasses: [ProfileListCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain('backend');
    expect(stdout).toContain('frontend');
  });

  it('returns HUB.NOT_FOUND for unknown hub id', async () => {
    await addHub();
    const { exitCode, stdout } = await runCommand(
      ['profile', 'list', '--hub', 'nonexistent', '-o', 'json'],
      { commandClasses: [ProfileListCommand], context: ctx() }
    );
    expect(exitCode).toBe(1);
    expect(stdout).toContain('HUB.NOT_FOUND');
  });
});

describe('profile show', () => {
  it('fails with USAGE.MISSING_FLAG when no profileId given', async () => {
    const { exitCode, stderr } = await runCommand(
      ['profile', 'show'],
      { commandClasses: [ProfileShowCommand], context: ctx() }
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('USAGE.MISSING_FLAG');
  });

  it('fails with HUB.NOT_FOUND when no active hub', async () => {
    const { exitCode, stdout } = await runCommand(
      ['profile', 'show', 'backend', '-o', 'json'],
      { commandClasses: [ProfileShowCommand], context: ctx() }
    );
    expect(exitCode).toBe(1);
    expect(stdout).toContain('HUB.NOT_FOUND');
  });

  it('shows profile details', async () => {
    await addHub();
    const { exitCode, stdout } = await runCommand(
      ['profile', 'show', 'backend', '-o', 'json'],
      { commandClasses: [ProfileShowCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { data: { profile: { id: string; name: string } } };
    expect(parsed.data.profile.id).toBe('backend');
    expect(parsed.data.profile.name).toBe('Backend Developer');
  });

  it('returns BUNDLE.NOT_FOUND for unknown profile', async () => {
    await addHub();
    const { exitCode, stdout } = await runCommand(
      ['profile', 'show', 'nonexistent', '-o', 'json'],
      { commandClasses: [ProfileShowCommand], context: ctx() }
    );
    expect(exitCode).toBe(1);
    expect(stdout).toContain('BUNDLE.NOT_FOUND');
  });

  it('text output shows profile name and id', async () => {
    await addHub();
    const { exitCode, stdout } = await runCommand(
      ['profile', 'show', 'backend'],
      { commandClasses: [ProfileShowCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Backend Developer');
    expect(stdout).toContain('backend');
  });
});

describe('profile current', () => {
  it('returns no active profile when none set', async () => {
    const { exitCode, stdout } = await runCommand(
      ['profile', 'current', '-o', 'json'],
      { commandClasses: [ProfileCurrentCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { data: { active: null } };
    expect(parsed.data.active).toBeNull();
  });

  it('text output shows no active profile message', async () => {
    const { exitCode, stdout } = await runCommand(
      ['profile', 'current'],
      { commandClasses: [ProfileCurrentCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain('No active profile');
  });
});

describe('profile deactivate', () => {
  it('returns ok with null deactivated when no active profile', async () => {
    const { exitCode, stdout } = await runCommand(
      ['profile', 'deactivate', '-o', 'json'],
      { commandClasses: [ProfileDeactivateCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { data: { deactivated: null } };
    expect(parsed.data.deactivated).toBeNull();
  });

  it('text output says no active profile when none set', async () => {
    const { exitCode, stdout } = await runCommand(
      ['profile', 'deactivate'],
      { commandClasses: [ProfileDeactivateCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain('No active profile');
  });

  it('dry-run shows dryRun=true when no active profile', async () => {
    const { exitCode, stdout } = await runCommand(
      ['profile', 'deactivate', '--dry-run', '-o', 'json'],
      { commandClasses: [ProfileDeactivateCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { data: { deactivated: null } };
    expect(parsed.data.deactivated).toBeNull();
  });
});

describe('profile create', () => {
  it('fails with USAGE.MISSING_FLAG when no profileId', async () => {
    const { exitCode, stderr } = await runCommand(
      ['profile', 'create'],
      { commandClasses: [ProfileCreateCommand], context: ctx() }
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('profile create');
  });

  it('fails with USAGE.MISSING_FLAG when no --name', async () => {
    const { exitCode, stderr } = await runCommand(
      ['profile', 'create', 'my-profile'],
      { commandClasses: [ProfileCreateCommand], context: ctx() }
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('USAGE.MISSING_FLAG');
  });

  it('creates a profile in default-local hub', async () => {
    const { exitCode, stdout } = await runCommand(
      ['profile', 'create', 'my-profile', '--name', 'My Profile', '-o', 'json'],
      { commandClasses: [ProfileCreateCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { data: { profile: { id: string; name: string } } };
    expect(parsed.data.profile.id).toBe('my-profile');
    expect(parsed.data.profile.name).toBe('My Profile');
  });

  it('creates profile with bundles', async () => {
    const { exitCode, stdout } = await runCommand(
      ['profile', 'create', 'dev', '--name', 'Dev', '--bundles', 'b1,b2', '-o', 'json'],
      { commandClasses: [ProfileCreateCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { data: { profile: { bundles: number } } };
    expect(parsed.data.profile.bundles).toBe(2);
  });

  it('creates profile in specified hub', async () => {
    await addHub();
    const { exitCode, stdout } = await runCommand(
      ['profile', 'create', 'new-p', '--name', 'New Profile', '--hub', 'test-hub', '-o', 'json'],
      { commandClasses: [ProfileCreateCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { data: { hubId: string } };
    expect(parsed.data.hubId).toBe('test-hub');
  });

  it('text output confirms creation', async () => {
    const { exitCode, stdout } = await runCommand(
      ['profile', 'create', 'my-profile', '--name', 'My Profile'],
      { commandClasses: [ProfileCreateCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain('my-profile');
  });
});

describe('profile edit', () => {
  it('fails with USAGE.MISSING_FLAG when no profileId', async () => {
    const { exitCode, stderr } = await runCommand(
      ['profile', 'edit'],
      { commandClasses: [ProfileEditCommand], context: ctx() }
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('profile edit');
  });

  it('fails when hub not found', async () => {
    const { exitCode, stdout } = await runCommand(
      ['profile', 'edit', 'my-profile', '--hub', 'nonexistent', '-o', 'json'],
      { commandClasses: [ProfileEditCommand], context: ctx() }
    );
    expect(exitCode).toBe(1);
    expect(stdout).toContain('USAGE.MISSING_FLAG');
  });

  it('fails when profile not found in hub', async () => {
    await runCommand(
      ['profile', 'create', 'existing', '--name', 'Existing'],
      { commandClasses: [ProfileCreateCommand], context: ctx() }
    );
    const { exitCode, stdout } = await runCommand(
      ['profile', 'edit', 'nonexistent', '-o', 'json'],
      { commandClasses: [ProfileEditCommand], context: ctx() }
    );
    expect(exitCode).toBe(1);
    expect(stdout).toContain('USAGE.MISSING_FLAG');
  });

  it('edits profile name', async () => {
    await addHub();
    const { exitCode, stdout } = await runCommand(
      ['profile', 'edit', 'backend', '--name', 'New Backend', '--hub', 'test-hub', '-o', 'json'],
      { commandClasses: [ProfileEditCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { data: { profile: { name: string } } };
    expect(parsed.data.profile.name).toBe('New Backend');
  });

  it('edits profile by adding bundles', async () => {
    await addHub();
    const { exitCode, stdout } = await runCommand(
      ['profile', 'edit', 'backend', '--add-bundles', 'b1,b2', '--hub', 'test-hub', '-o', 'json'],
      { commandClasses: [ProfileEditCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { data: { profile: { bundles: number } } };
    expect(parsed.data.profile.bundles).toBe(2);
  });

  it('edits profile by removing bundles', async () => {
    await addHub();
    const { exitCode } = await runCommand(
      ['profile', 'edit', 'backend', '--add-bundles', 'b1,b2', '--hub', 'test-hub', '-o', 'json'],
      { commandClasses: [ProfileEditCommand], context: ctx() }
    );
    await runCommand(
      ['profile', 'edit', 'backend', '--remove-bundles', 'b1', '--hub', 'test-hub', '-o', 'json'],
      { commandClasses: [ProfileEditCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
  });

  it('text output confirms update', async () => {
    await addHub();
    const { exitCode, stdout } = await runCommand(
      ['profile', 'edit', 'backend', '--description', 'Updated', '--hub', 'test-hub'],
      { commandClasses: [ProfileEditCommand], context: ctx() }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain('backend');
  });
});
