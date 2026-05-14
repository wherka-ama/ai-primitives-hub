/**
 * Coverage tests for ProfileActivationStore (5.26% → higher).
 *
 * Tests save, load, remove, getActive, listAll, schema validation,
 * and D21 single-active-profile invariant.
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
  ProfileActivationStore,
} from '../src/infra/stores/profile-activation-store';
import {
  createNodeFsAdapter,
} from './cli/helpers/node-fs-adapter';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prc-pas-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('ProfileActivationStore', () => {
  it('save and load round-trip', async () => {
    const store = new ProfileActivationStore(tmpDir, createNodeFsAdapter());
    const state = {
      hubId: 'test-hub',
      profileId: 'test-profile',
      schemaVersion: 1 as const,
      activatedAt: new Date().toISOString(),
      syncedBundles: [],
      syncedBundleVersions: {},
      syncedTargets: []
    };
    await store.save(state);
    const loaded = await store.load('test-hub', 'test-profile');
    expect(loaded).toEqual(state);
  });

  it('load returns null for missing state', async () => {
    const store = new ProfileActivationStore(tmpDir, createNodeFsAdapter());
    const loaded = await store.load('missing-hub', 'missing-profile');
    expect(loaded).toBe(null);
  });

  it('remove deletes state file', async () => {
    const store = new ProfileActivationStore(tmpDir, createNodeFsAdapter());
    const state = {
      hubId: 'test-hub',
      profileId: 'test-profile',
      schemaVersion: 1 as const,
      activatedAt: new Date().toISOString(),
      syncedBundles: [],
      syncedBundleVersions: {},
      syncedTargets: []
    };
    await store.save(state);
    await store.remove('test-hub', 'test-profile');
    const loaded = await store.load('test-hub', 'test-profile');
    expect(loaded).toBe(null);
  });

  it('remove is no-op when file does not exist', async () => {
    const store = new ProfileActivationStore(tmpDir, createNodeFsAdapter());
    await expect(
      store.remove('missing-hub', 'missing-profile')
    ).resolves.not.toThrow();
  });

  it('getActive returns null when no activations', async () => {
    const store = new ProfileActivationStore(tmpDir, createNodeFsAdapter());
    const active = await store.getActive();
    expect(active).toBe(null);
  });

  it('getActive returns the single active state', async () => {
    const store = new ProfileActivationStore(tmpDir, createNodeFsAdapter());
    const state = {
      hubId: 'test-hub',
      profileId: 'test-profile',
      schemaVersion: 1 as const,
      activatedAt: new Date().toISOString(),
      syncedBundles: [],
      syncedBundleVersions: {},
      syncedTargets: []
    };
    await store.save(state);
    const active = await store.getActive();
    expect(active).toEqual(state);
  });

  it('getActive throws D21 violation when multiple activations exist', async () => {
    const store = new ProfileActivationStore(tmpDir, createNodeFsAdapter());
    await store.save({
      hubId: 'hub1',
      profileId: 'prof1',
      schemaVersion: 1 as const,
      activatedAt: new Date().toISOString(),
      syncedBundles: [],
      syncedBundleVersions: {},
      syncedTargets: []
    });
    await store.save({
      hubId: 'hub2',
      profileId: 'prof2',
      schemaVersion: 1 as const,
      activatedAt: new Date().toISOString(),
      syncedBundles: [],
      syncedBundleVersions: {},
      syncedTargets: []
    });
    await expect(store.getActive()).rejects.toThrow('D21 violation');
  });

  it('load throws on unsupported schema version', async () => {
    const store = new ProfileActivationStore(tmpDir, createNodeFsAdapter());
    const statePath = path.join(tmpDir, 'hub_prof.json');
    await fs.writeFile(statePath, JSON.stringify({
      hubId: 'hub',
      profileId: 'prof',
      schemaVersion: 999 as const,
      activatedAt: new Date().toISOString(),
      syncedBundles: [],
      syncedBundleVersions: {},
      syncedTargets: []
    }));
    await expect(store.load('hub', 'prof')).rejects.toThrow('Unsupported profile activation schema version');
  });

  it('getActive throws on unsupported schema version', async () => {
    const store = new ProfileActivationStore(tmpDir, createNodeFsAdapter());
    const statePath = path.join(tmpDir, 'hub_prof.json');
    await fs.writeFile(statePath, JSON.stringify({
      hubId: 'hub',
      profileId: 'prof',
      schemaVersion: 999 as const,
      activatedAt: new Date().toISOString(),
      syncedBundles: [],
      syncedBundleVersions: {},
      syncedTargets: []
    }));
    await expect(store.getActive()).rejects.toThrow('Unsupported profile activation schema version');
  });

  it('listAll returns empty array when no activations', async () => {
    const store = new ProfileActivationStore(tmpDir, createNodeFsAdapter());
    const all = await store.listAll();
    expect(all).toEqual([]);
  });

  it('listAll returns all activation states', async () => {
    const store = new ProfileActivationStore(tmpDir, createNodeFsAdapter());
    const state1 = {
      hubId: 'hub1',
      profileId: 'prof1',
      schemaVersion: 1 as const,
      activatedAt: new Date().toISOString(),
      syncedBundles: [],
      syncedBundleVersions: {},
      syncedTargets: []
    };
    const state2 = {
      hubId: 'hub2',
      profileId: 'prof2',
      schemaVersion: 1 as const,
      activatedAt: new Date().toISOString(),
      syncedBundles: [],
      syncedBundleVersions: {},
      syncedTargets: []
    };
    await store.save(state1);
    await store.save(state2);
    const all = await store.listAll();
    expect(all).toHaveLength(2);
    expect(all).toContainEqual(state1);
    expect(all).toContainEqual(state2);
  });

  it('listAll throws on unsupported schema version', async () => {
    const store = new ProfileActivationStore(tmpDir, createNodeFsAdapter());
    const statePath = path.join(tmpDir, 'hub_prof.json');
    await fs.writeFile(statePath, JSON.stringify({
      hubId: 'hub',
      profileId: 'prof',
      schemaVersion: 999 as const,
      activatedAt: new Date().toISOString(),
      syncedBundles: [],
      syncedBundleVersions: {},
      syncedTargets: []
    }));
    await expect(store.listAll()).rejects.toThrow('Unsupported profile activation schema version');
  });
});
