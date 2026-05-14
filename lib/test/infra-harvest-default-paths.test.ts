/**
 * Coverage tests for infra/harvest/default-paths.ts.
 *
 * Tests default path resolution functions.
 */
import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  defaultCacheDir,
  defaultHubCacheDir,
  defaultIndexFile,
  type DefaultPathEnv,
  defaultProgressFile,
} from '../src/infra/harvest/default-paths';

describe('defaultCacheDir', () => {
  it('uses PROMPT_REGISTRY_CACHE when set', () => {
    const env: DefaultPathEnv = { PROMPT_REGISTRY_CACHE: '/custom/cache' };
    expect(defaultCacheDir(env)).toBe('/custom/cache');
  });

  it('uses XDG_CACHE_HOME when PROMPT_REGISTRY_CACHE not set', () => {
    const env: DefaultPathEnv = { XDG_CACHE_HOME: '/xdg/cache' };
    expect(defaultCacheDir(env)).toBe('/xdg/cache/prompt-registry');
  });

  it('uses homedir fallback when neither env var set', () => {
    const env: DefaultPathEnv = {};
    const result = defaultCacheDir(env);
    expect(result).toContain('.cache');
    expect(result).toContain('prompt-registry');
  });

  it('uses process.env by default', () => {
    const result = defaultCacheDir();
    expect(typeof result).toBe('string');
  });
});

describe('defaultIndexFile', () => {
  it('returns index file path in cache dir', () => {
    const env: DefaultPathEnv = { PROMPT_REGISTRY_CACHE: '/custom/cache' };
    expect(defaultIndexFile(env)).toBe('/custom/cache/primitive-index.json');
  });

  it('uses default cache dir when env vars not set', () => {
    const env: DefaultPathEnv = {};
    const result = defaultIndexFile(env);
    expect(result).toContain('primitive-index.json');
    expect(result).toContain('.cache');
  });
});

describe('defaultHubCacheDir', () => {
  it('uses hubId when provided', () => {
    const env: DefaultPathEnv = { PROMPT_REGISTRY_CACHE: '/custom/cache' };
    expect(defaultHubCacheDir('owner/repo', env)).toBe('/custom/cache/hubs/owner_repo');
  });

  it('sanitises hubId to filesystem-safe characters', () => {
    const env: DefaultPathEnv = { PROMPT_REGISTRY_CACHE: '/custom/cache' };
    expect(defaultHubCacheDir('owner/repo with spaces', env)).toBe('/custom/cache/hubs/owner_repo_with_spaces');
  });

  it('replaces slashes with underscores', () => {
    const env: DefaultPathEnv = { PROMPT_REGISTRY_CACHE: '/custom/cache' };
    expect(defaultHubCacheDir('owner/repo', env)).toBe('/custom/cache/hubs/owner_repo');
  });

  it('uses "local" when hubId is undefined', () => {
    const env: DefaultPathEnv = { PROMPT_REGISTRY_CACHE: '/custom/cache' };
    expect(defaultHubCacheDir(undefined, env)).toBe('/custom/cache/hubs/local');
  });

  it('uses "local" when hubId is empty string', () => {
    const env: DefaultPathEnv = { PROMPT_REGISTRY_CACHE: '/custom/cache' };
    expect(defaultHubCacheDir('', env)).toBe('/custom/cache/hubs/local');
  });

  it('uses "local" when hubId is whitespace only', () => {
    const env: DefaultPathEnv = { PROMPT_REGISTRY_CACHE: '/custom/cache' };
    expect(defaultHubCacheDir('   ', env)).toBe('/custom/cache/hubs/local');
  });

  it('sanitises special characters', () => {
    const env: DefaultPathEnv = { PROMPT_REGISTRY_CACHE: '/custom/cache' };
    expect(defaultHubCacheDir('owner/repo:branch', env)).toBe('/custom/cache/hubs/owner_repo_branch');
  });
});

describe('defaultProgressFile', () => {
  it('returns progress file in hub cache dir', () => {
    const env: DefaultPathEnv = { PROMPT_REGISTRY_CACHE: '/custom/cache' };
    expect(defaultProgressFile('owner/repo', env)).toBe('/custom/cache/hubs/owner_repo/progress.jsonl');
  });

  it('uses local hub cache when hubId is undefined', () => {
    const env: DefaultPathEnv = { PROMPT_REGISTRY_CACHE: '/custom/cache' };
    expect(defaultProgressFile(undefined, env)).toBe('/custom/cache/hubs/local/progress.jsonl');
  });
});
