/**
 * ProfileActivator tests
 */
import {
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import {
  ProfileActivator,
} from '../src/app/registry/profile-activator';
import type {
  Profile,
  RegistrySource,
  Target,
} from '../src/domain';
import {
  createSimpleMockFs,
} from './helpers/install-test-helpers';

describe('ProfileActivator', () => {
  let mockFs: any;
  let mockHttp: any;
  let mockTokens: any;
  let activator: ProfileActivator;

  beforeEach(() => {
    mockFs = createSimpleMockFs();

    mockHttp = {
      fetch: async () => ({ body: new Uint8Array(), status: 200 })
    };

    mockTokens = {
      get: () => null,
      getToken: () => null
    };

    activator = new ProfileActivator({
      fs: mockFs,
      env: { HOME: '/tmp/test' },
      http: mockHttp,
      tokens: mockTokens
    });
  });

  it('should construct with dependencies', () => {
    expect(activator).toBeDefined();
  });

  it('throws error when no targets provided', async () => {
    const profile: Profile = {
      id: 'test-profile',
      name: 'Test Profile',
      bundles: []
    };

    await expect(activator.activate({
      hubId: 'test-hub',
      profile,
      sources: {},
      targets: []
    })).rejects.toThrow('PROFILE.ACTIVATION_NO_TARGETS');
  });

  it('throws error when source not in hub config', async () => {
    const profile: Profile = {
      id: 'test-profile',
      name: 'Test Profile',
      bundles: [
        { id: 'bundle1', version: '1.0.0', source: 'missing-source', required: true }
      ]
    };

    const sources: Record<string, RegistrySource> = {
      'other-source': { type: 'github', url: 'https://github.com/owner/repo', id: 'other-source', name: 'Other', enabled: true, priority: 0, hubId: 'test-hub' }
    };

    const targets: Target[] = [{ name: 'vscode', type: 'vscode', scope: 'user' } as any];

    await expect(activator.activate({
      hubId: 'test-hub',
      profile,
      sources,
      targets
    })).rejects.toThrow('PROFILE.SOURCE_MISSING');
  });

  it('throws error when source type is unsupported', async () => {
    const profile: Profile = {
      id: 'test-profile',
      name: 'Test Profile',
      bundles: [
        { id: 'bundle1', version: '1.0.0', source: 'unsupported-source', required: true }
      ]
    };

    const sources: Record<string, RegistrySource> = {
      'unsupported-source': { type: 'unsupported' as any, url: 'https://example.com', id: 'unsupported-source', name: 'Unsupported', enabled: true, priority: 0, hubId: 'test-hub' }
    };

    const targets: Target[] = [{ name: 'vscode', type: 'vscode', scope: 'user' } as any];

    await expect(activator.activate({
      hubId: 'test-hub',
      profile,
      sources,
      targets
    })).rejects.toThrow('PROFILE.SOURCE_UNSUPPORTED');
  });

  it('handles profile with empty bundles list', async () => {
    const profile: Profile = {
      id: 'test-profile',
      name: 'Test Profile',
      bundles: []
    };

    const sources: Record<string, RegistrySource> = {};
    const targets: Target[] = [{ name: 'vscode', type: 'vscode', scope: 'user' } as any];

    const result = await activator.activate({
      hubId: 'test-hub',
      profile,
      sources,
      targets
    });

    expect(result.state.syncedBundles).toEqual([]);
    expect(result.state.profileId).toBe('test-profile');
  });

  it('handles multiple targets', async () => {
    const profile: Profile = {
      id: 'test-profile',
      name: 'Test Profile',
      bundles: []
    };

    const sources: Record<string, RegistrySource> = {};
    const targets: Target[] = [
      { name: 'vscode', type: 'vscode', scope: 'user' } as any,
      { name: 'workspace', type: 'vscode', scope: 'workspace' } as any
    ];

    const result = await activator.activate({
      hubId: 'test-hub',
      profile,
      sources,
      targets
    });

    expect(result.state.syncedTargets.length).toBe(2);
    expect(result.state.syncedTargets).toContain('vscode');
    expect(result.state.syncedTargets).toContain('workspace');
  });

  it('sets correct activation timestamp', async () => {
    const profile: Profile = {
      id: 'test-profile',
      name: 'Test Profile',
      bundles: []
    };

    const sources: Record<string, RegistrySource> = {};
    const targets: Target[] = [{ name: 'vscode', type: 'vscode', scope: 'user' } as any];

    const before = new Date().toISOString();
    const result = await activator.activate({
      hubId: 'test-hub',
      profile,
      sources,
      targets
    });
    const after = new Date().toISOString();

    expect(result.state.activatedAt).toBeDefined();
    expect(result.state.activatedAt >= before).toBe(true);
    expect(result.state.activatedAt <= after).toBe(true);
  });
});
