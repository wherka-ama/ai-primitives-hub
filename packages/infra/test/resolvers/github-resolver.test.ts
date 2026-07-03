/**
 * Coverage tests for infra/resolvers/github-resolver.ts.
 *
 * No equivalent test existed in the reference branch this module was
 * ported from (a pre-existing gap there, not something dropped during
 * this port) — written fresh against `GitHubBundleResolver`'s actual
 * behavior.
 */
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  extractSemver,
  GitHubBundleResolver,
} from '../../src/resolvers/github-resolver';
import {
  FakeHttpClient,
} from '../helpers/fake-http-client';

const RELEASES_URL = 'https://api.github.com/repos/owner/repo/releases';
const mockTokenProvider = {
  getToken: async (): Promise<string | undefined> => undefined
};

const release = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  tag_name: 'owner-repo-mybundle-v1.0.0',
  assets: [
    { name: 'bundle.zip', browser_download_url: 'https://github.com/owner/repo/releases/download/v1.0.0/bundle.zip', url: 'https://api.github.com/assets/1' }
  ],
  draft: false,
  prerelease: false,
  ...overrides
});

describe('extractSemver', () => {
  it('extracts bare semver', () => {
    expect(extractSemver('1.2.3')).toBe('1.2.3');
  });

  it('extracts v-prefixed semver', () => {
    expect(extractSemver('v1.2.3')).toBe('1.2.3');
  });

  it('extracts semver from a suffixed tag', () => {
    expect(extractSemver('my-bundle-1.0.0')).toBe('1.0.0');
  });

  it('extracts prerelease semver', () => {
    expect(extractSemver('v1.2.3-rc.1')).toBe('1.2.3-rc.1');
  });

  it('returns null when no semver pattern is present', () => {
    expect(extractSemver('release')).toBeNull();
  });
});

describe('GitHubBundleResolver', () => {
  it('returns null when the repo has no releases', async () => {
    const http = new FakeHttpClient().addRoute({ url: RELEASES_URL, status: 200, body: '[]' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const resolver = new GitHubBundleResolver({ repoSlug: 'owner/repo', http, tokens: mockTokenProvider });

    const result = await resolver.resolve({ bundleId: 'owner-repo-mybundle', bundleVersion: 'latest' });
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });

  it('resolves the latest matching release', async () => {
    const http = new FakeHttpClient().addRoute({
      url: RELEASES_URL,
      status: 200,
      body: JSON.stringify([release()])
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const resolver = new GitHubBundleResolver({ repoSlug: 'owner/repo', http, tokens: mockTokenProvider });

    const result = await resolver.resolve({ bundleId: 'owner-repo-mybundle', bundleVersion: 'latest' });
    expect(result).not.toBeNull();
    expect(result?.ref.bundleVersion).toBe('1.0.0');
    expect(result?.ref.sourceType).toBe('github');
    expect(result?.downloadUrl).toBe('https://api.github.com/assets/1');
    vi.restoreAllMocks();
  });

  it('resolves a specific version', async () => {
    const http = new FakeHttpClient().addRoute({
      url: RELEASES_URL,
      status: 200,
      body: JSON.stringify([
        release({ tag_name: 'owner-repo-mybundle-v1.0.0' }),
        release({ tag_name: 'owner-repo-mybundle-v2.0.0' })
      ])
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const resolver = new GitHubBundleResolver({ repoSlug: 'owner/repo', http, tokens: mockTokenProvider });

    const result = await resolver.resolve({ bundleId: 'owner-repo-mybundle', bundleVersion: '1.0.0' });
    expect(result?.ref.bundleVersion).toBe('1.0.0');
    vi.restoreAllMocks();
  });

  it('ignores draft and prerelease releases when picking latest', async () => {
    const http = new FakeHttpClient().addRoute({
      url: RELEASES_URL,
      status: 200,
      body: JSON.stringify([
        release({ tag_name: 'owner-repo-mybundle-v2.0.0', draft: true }),
        release({ tag_name: 'owner-repo-mybundle-v1.0.0' })
      ])
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const resolver = new GitHubBundleResolver({ repoSlug: 'owner/repo', http, tokens: mockTokenProvider });

    const result = await resolver.resolve({ bundleId: 'owner-repo-mybundle', bundleVersion: 'latest' });
    expect(result?.ref.bundleVersion).toBe('1.0.0');
    vi.restoreAllMocks();
  });

  it('returns null when no asset matches the expected name', async () => {
    const http = new FakeHttpClient().addRoute({
      url: RELEASES_URL,
      status: 200,
      body: JSON.stringify([release({ assets: [{ name: 'unrelated.txt', browser_download_url: 'https://x', url: 'https://x' }] })])
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const resolver = new GitHubBundleResolver({ repoSlug: 'owner/repo', http, tokens: mockTokenProvider });

    const result = await resolver.resolve({ bundleId: 'owner-repo-mybundle', bundleVersion: 'latest' });
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });

  it('matches a bundle-id-specific asset name', async () => {
    const http = new FakeHttpClient().addRoute({
      url: RELEASES_URL,
      status: 200,
      body: JSON.stringify([release({
        assets: [{ name: 'owner-repo-mybundle.bundle.zip', browser_download_url: 'https://x', url: 'https://api.github.com/assets/9' }]
      })])
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const resolver = new GitHubBundleResolver({ repoSlug: 'owner/repo', http, tokens: mockTokenProvider });

    const result = await resolver.resolve({ bundleId: 'owner-repo-mybundle', bundleVersion: 'latest' });
    expect(result?.downloadUrl).toBe('https://api.github.com/assets/9');
    vi.restoreAllMocks();
  });

  it('uses a custom asset name when configured', async () => {
    const http = new FakeHttpClient().addRoute({
      url: RELEASES_URL,
      status: 200,
      body: JSON.stringify([release({
        assets: [{ name: 'custom.zip', browser_download_url: 'https://x', url: 'https://api.github.com/assets/custom' }]
      })])
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const resolver = new GitHubBundleResolver({ repoSlug: 'owner/repo', assetName: 'custom.zip', http, tokens: mockTokenProvider });

    const result = await resolver.resolve({ bundleId: 'owner-repo-mybundle', bundleVersion: 'latest' });
    expect(result?.downloadUrl).toBe('https://api.github.com/assets/custom');
    vi.restoreAllMocks();
  });

  it('sends an Authorization header when a token is available', async () => {
    const http = new FakeHttpClient().addRoute({
      url: RELEASES_URL,
      status: 200,
      body: JSON.stringify([release()])
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const resolver = new GitHubBundleResolver({
      repoSlug: 'owner/repo',
      http,
      tokens: { getToken: async (): Promise<string | undefined> => 'tok' }
    });

    await resolver.resolve({ bundleId: 'owner-repo-mybundle', bundleVersion: 'latest' });
    expect(http.calls[0].headers?.Authorization).toBe('Bearer tok');
    vi.restoreAllMocks();
  });

  it('treats a 404 releases response as an empty release list', async () => {
    const http = new FakeHttpClient().addRoute({ url: RELEASES_URL, status: 404 });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const resolver = new GitHubBundleResolver({ repoSlug: 'owner/repo', http, tokens: mockTokenProvider });

    const result = await resolver.resolve({ bundleId: 'owner-repo-mybundle', bundleVersion: 'latest' });
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });

  it('throws on non-2xx, non-404 API errors', async () => {
    const http = new FakeHttpClient().addRoute({ url: RELEASES_URL, status: 500, body: 'boom' });
    const resolver = new GitHubBundleResolver({ repoSlug: 'owner/repo', http, tokens: mockTokenProvider });

    await expect(resolver.resolve({ bundleId: 'owner-repo-mybundle', bundleVersion: 'latest' }))
      .rejects.toThrow('GitHub API 500');
  });

  it('caches the release list across multiple resolve calls', async () => {
    const http = new FakeHttpClient().addRoute({
      url: RELEASES_URL,
      status: 200,
      body: JSON.stringify([release()])
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const resolver = new GitHubBundleResolver({ repoSlug: 'owner/repo', http, tokens: mockTokenProvider });

    await resolver.resolve({ bundleId: 'owner-repo-mybundle', bundleVersion: 'latest' });
    await resolver.resolve({ bundleId: 'owner-repo-mybundle', bundleVersion: 'latest' });
    expect(http.calls.length).toBe(1);
    vi.restoreAllMocks();
  });
});
