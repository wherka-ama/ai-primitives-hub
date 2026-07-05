/**
 * Tests for registry/hub-manager.ts (Stage 1: CRUD + fetch/validate).
 */
import type {
  HubConfig,
  HubReference,
  ValidationResult,
} from '@ai-primitives-hub/core';
import type {
  ActiveHubStore,
  HubResolver,
  HubStore,
} from '@ai-primitives-hub/infra';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  HubManager,
} from '../../src/registry/hub-manager';

function makeConfig(name = 'Test Hub'): HubConfig {
  return {
    version: '1.0.0',
    metadata: { name, description: 'd', maintainer: 'm', updatedAt: '2024-01-01T00:00:00.000Z' },
    sources: [],
    profiles: []
  };
}

const OK: ValidationResult = { valid: true, errors: [] };

function makeStore(): HubStore & {
  saved: Map<string, { config: HubConfig; reference: HubReference }>;
} {
  const saved = new Map<string, { config: HubConfig; reference: HubReference }>();
  return {
    saved,
    save: vi.fn(async (id: string, config: HubConfig, reference: HubReference) => {
      saved.set(id, { config, reference });
    }),
    load: vi.fn(async (id: string) => {
      const entry = saved.get(id);
      if (!entry) {
        throw new Error(`Hub not found: ${id}`);
      }
      return entry;
    }),
    remove: vi.fn(async (id: string) => {
      if (!saved.has(id)) {
        throw new Error(`Hub not found: ${id}`);
      }
      saved.delete(id);
    }),
    list: vi.fn(async () => [...saved.keys()]),
    getMetadata: vi.fn(async (id: string) => {
      if (!saved.has(id)) {
        throw new Error(`Hub not found: ${id}`);
      }
      return { reference: saved.get(id)!.reference, lastModified: '2024-01-01T00:00:00.000Z', size: 42 };
    }),
    has: vi.fn(async (id: string) => saved.has(id))
  } as HubStore & { saved: Map<string, { config: HubConfig; reference: HubReference }> };
}

function makeActiveStore(): ActiveHubStore & { current: string | null } {
  const state = { current: null as string | null };
  return {
    current: state.current,
    get: vi.fn(async () => state.current),
    set: vi.fn(async (id: string | null) => {
      state.current = id;
    })
  } as ActiveHubStore & { current: string | null };
}

function makeResolver(config: HubConfig = makeConfig()): HubResolver {
  return {
    resolve: vi.fn(async (ref: HubReference) => ({ config, reference: ref }))
  };
}

describe('HubManager (app)', () => {
  let store: ReturnType<typeof makeStore>;
  let activeStore: ReturnType<typeof makeActiveStore>;
  let resolver: HubResolver;
  let validateConfig: ReturnType<typeof vi.fn<(config: HubConfig) => Promise<ValidationResult>>>;
  let manager: HubManager;

  beforeEach(() => {
    store = makeStore();
    activeStore = makeActiveStore();
    resolver = makeResolver();
    validateConfig = vi.fn(async () => OK);
    manager = new HubManager({ store, activeStore, resolver, validateConfig });
  });

  describe('importHub', () => {
    it('resolves, validates, and saves under the given id', async () => {
      const ref: HubReference = { type: 'local', location: '/hub-config.yml' };
      const id = await manager.importHub(ref, 'my-hub');

      expect(id).toBe('my-hub');
      // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest mock method reference, not a real unbound `this` call
      expect(store.save).toHaveBeenCalledWith('my-hub', expect.any(Object), ref);
    });

    it('auto-generates an id from the config name when none is given', async () => {
      const ref: HubReference = { type: 'local', location: '/hub-config.yml' };
      const id = await manager.importHub(ref);
      expect(id).toMatch(/^test-hub-\d+$/);
    });

    it('rejects an invalid reference before resolving', async () => {
      await expect(manager.importHub({ type: 'github', location: 'not-owner-slash-repo' }))
        .rejects.toThrow(/Invalid reference/);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest mock method reference, not a real unbound `this` call
      expect(resolver.resolve).not.toHaveBeenCalled();
    });

    it('rejects when the fetched config fails validation', async () => {
      validateConfig.mockResolvedValue({ valid: false, errors: ['bad shape'] });
      await expect(manager.importHub({ type: 'local', location: '/x.yml' }))
        .rejects.toThrow(/Hub validation failed/);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest mock method reference, not a real unbound `this` call
      expect(store.save).not.toHaveBeenCalled();
    });

    it('rejects an invalid explicit hub id', async () => {
      await expect(manager.importHub({ type: 'local', location: '/x.yml' }, '../bad'))
        .rejects.toThrow(/Invalid hub ID/);
    });
  });

  describe('loadHub / validateHub', () => {
    it('re-validates on load and throws if now invalid', async () => {
      await manager.importHub({ type: 'local', location: '/x.yml' }, 'my-hub');
      validateConfig.mockResolvedValue({ valid: false, errors: ['drifted'] });

      await expect(manager.loadHub('my-hub')).rejects.toThrow('Hub validation failed: drifted');
    });

    it('delegates validateHub to the injected validator', async () => {
      const config = makeConfig();
      await manager.validateHub(config);
      expect(validateConfig).toHaveBeenCalledWith(config);
    });
  });

  describe('listHubs', () => {
    it('lists every saved hub with name/description', async () => {
      await manager.importHub({ type: 'local', location: '/a.yml' }, 'hub-a');
      await manager.importHub({ type: 'local', location: '/b.yml' }, 'hub-b');

      const hubs = await manager.listHubs();
      expect(hubs.map((h) => h.id).toSorted()).toEqual(['hub-a', 'hub-b']);
      expect(hubs[0].name).toBe('Test Hub');
    });

    it('returns an empty list when nothing is imported', async () => {
      expect(await manager.listHubs()).toEqual([]);
    });
  });

  describe('deleteHub', () => {
    it('removes the hub from the store', async () => {
      await manager.importHub({ type: 'local', location: '/a.yml' }, 'hub-a');
      await manager.deleteHub('hub-a');
      // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest mock method reference, not a real unbound `this` call
      expect(store.remove).toHaveBeenCalledWith('hub-a');
    });
  });

  describe('syncHub', () => {
    it('re-fetches using the existing reference and re-saves', async () => {
      const ref: HubReference = { type: 'local', location: '/a.yml' };
      await manager.importHub(ref, 'hub-a');

      await manager.syncHub('hub-a');

      // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest mock method reference, not a real unbound `this` call
      expect(resolver.resolve).toHaveBeenCalledWith(ref);
      // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest mock method reference, not a real unbound `this` call
      expect(store.save).toHaveBeenLastCalledWith('hub-a', expect.any(Object), ref);
    });

    it('throws when the re-fetched config fails validation', async () => {
      await manager.importHub({ type: 'local', location: '/a.yml' }, 'hub-a');
      validateConfig.mockResolvedValue({ valid: false, errors: ['bad'] });

      await expect(manager.syncHub('hub-a')).rejects.toThrow(/Hub validation failed after sync/);
    });
  });

  describe('getHubInfo', () => {
    it('combines config + sidecar metadata', async () => {
      await manager.importHub({ type: 'local', location: '/a.yml' }, 'hub-a');
      const info = await manager.getHubInfo('hub-a');
      expect(info.id).toBe('hub-a');
      expect(info.metadata.name).toBe('Test Hub');
      expect(info.metadata.size).toBe(42);
    });
  });

  describe('verifyHubAvailability', () => {
    it('returns true when the reference validates and resolves', async () => {
      expect(await manager.verifyHubAvailability({ type: 'local', location: '/a.yml' })).toBe(true);
    });

    it('returns false (never throws) when resolution fails', async () => {
      (resolver.resolve as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
      expect(await manager.verifyHubAvailability({ type: 'local', location: '/a.yml' })).toBe(false);
    });

    it('returns false for an invalid reference', async () => {
      expect(await manager.verifyHubAvailability({ type: 'github', location: 'bad' })).toBe(false);
    });
  });

  describe('active hub management', () => {
    it('returns null when nothing is active', async () => {
      expect(await manager.getActiveHubId()).toBeNull();
      expect(await manager.getActiveHub()).toBeNull();
    });

    it('sets and retrieves the active hub', async () => {
      await manager.importHub({ type: 'local', location: '/a.yml' }, 'hub-a');
      await manager.setActiveHub('hub-a');

      expect(await manager.getActiveHubId()).toBe('hub-a');
      const active = await manager.getActiveHub();
      expect(active?.id).toBe('hub-a');
    });

    it('rejects activating a non-existent hub', async () => {
      await expect(manager.setActiveHub('missing')).rejects.toThrow('Hub not found: missing');
    });

    it('clears the active hub pointer when a stale id is loaded', async () => {
      await manager.importHub({ type: 'local', location: '/a.yml' }, 'hub-a');
      await manager.setActiveHub('hub-a');
      await store.remove('hub-a');

      expect(await manager.getActiveHub()).toBeNull();
      expect(await activeStore.get()).toBeNull();
    });

    it('allows clearing the active hub with null', async () => {
      await manager.importHub({ type: 'local', location: '/a.yml' }, 'hub-a');
      await manager.setActiveHub('hub-a');
      await manager.setActiveHub(null);
      expect(await manager.getActiveHubId()).toBeNull();
    });
  });

  describe('getHub', () => {
    it('returns hub info for an existing hub', async () => {
      await manager.importHub({ type: 'local', location: '/a.yml' }, 'hub-a');
      const hub = await manager.getHub('hub-a');
      expect(hub?.id).toBe('hub-a');
    });

    it('returns null for a missing hub', async () => {
      expect(await manager.getHub('missing')).toBeNull();
    });
  });
});
