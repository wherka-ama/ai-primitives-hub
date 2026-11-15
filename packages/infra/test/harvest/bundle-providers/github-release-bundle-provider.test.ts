import {
  createHash,
} from 'node:crypto';
import type {
  HubSourceSpec,
} from '@ai-primitives-hub/core';
import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  duplicateZipEntryNames,
  GitHubReleaseBundleProvider,
} from '../../../src/harvest/bundle-providers/github-release-bundle-provider';
import {
  harvestBundle,
} from '../../../src/harvest/harvester';
import {
  buildZip,
} from '../../../src/writers/zip-writer';
import {
  FakeGitHubApi,
} from '../../helpers/fake-github-api';

const OWNER = 'acme';
const REPO = 'skills';
const RELEASES = `/repos/${OWNER}/${REPO}/releases?per_page=100`;
const enc = new TextEncoder();

const spec: HubSourceSpec = {
  id: 'acme-skills', name: 'acme', type: 'github',
  url: `https://github.com/${OWNER}/${REPO}`, owner: OWNER, repo: REPO, branch: 'main'
};

let nextId = 1;

interface ReleaseOpts {
  tag: string;
  manifestId?: string;
  version?: string;
  draft?: boolean;
  prerelease?: boolean;
  publishedAt?: string;
  digest?: (sha: string) => string | null;
  files?: Record<string, string>;
}

/**
 * Seed one release (metadata + archive bytes) and return its API shape.
 * @param client - Fake API to seed.
 * @param o - Release options.
 */
function release(client: FakeGitHubApi, o: ReleaseOpts): Record<string, unknown> {
  const id = o.manifestId ?? 'pack';
  const version = o.version ?? '1.0.0';
  const manifest = `id: ${id}\nversion: ${version}\nname: Pack\nprompts:\n  - id: hello\n    file: prompts/hello.prompt.md\n    type: prompt\n`;
  const files = o.files ?? { 'deployment-manifest.yml': manifest, 'prompts/hello.prompt.md': `# Hello ${version}\n` };
  const bytes = buildZip(Object.entries(files).map(([p, c]) => ({ path: p, bytes: enc.encode(c) })));
  const sha = createHash('sha256').update(bytes).digest('hex');
  const zipId = nextId++;
  const manifestAssetId = nextId++;
  client.seedBytes(`/repos/${OWNER}/${REPO}/releases/assets/${String(zipId)}`, bytes);
  client.seedText(`/repos/${OWNER}/${REPO}/releases/assets/${String(manifestAssetId)}`, manifest);
  return {
    id: nextId++,
    tag_name: o.tag,
    draft: o.draft ?? false,
    prerelease: o.prerelease ?? false,
    published_at: o.publishedAt ?? '2026-01-01T00:00:00Z',
    assets: [
      { id: manifestAssetId, name: 'deployment-manifest.yml', size: manifest.length, url: '' },
      {
        id: zipId, name: `${id}.bundle.zip`, size: bytes.byteLength, url: '',
        digest: o.digest === undefined ? `sha256:${sha}` : o.digest(sha), updated_at: '2026-01-01T00:00:00Z'
      }
    ]
  };
}

async function listAll(provider: GitHubReleaseBundleProvider): Promise<{ bundleId: string; bundleVersion: string; provenance?: unknown }[]> {
  const out = [];
  for await (const ref of provider.listBundles()) {
    out.push(ref);
  }
  return out;
}

describe('GitHubReleaseBundleProvider', () => {
  it('selects the latest published release per collection, skipping drafts and prereleases', async () => {
    const client = new FakeGitHubApi();
    client.seedJson(`${RELEASES}&page=1`, [
      release(client, { tag: 'pack-v1.2.0', version: '1.2.0', draft: true }),
      release(client, { tag: 'pack-v1.1.0-rc.1', version: '1.1.0-rc.1', prerelease: true }),
      release(client, { tag: 'pack-v1.0.0', version: '1.0.0' }),
      release(client, { tag: 'pack-v1.0.10', version: '1.0.10' }),
      release(client, { tag: 'other-v0.1.0', manifestId: 'other', version: '0.1.0' })
    ]);

    const refs = await listAll(new GitHubReleaseBundleProvider({ spec, client }));

    expect(refs.map((r) => `${r.bundleId}@${r.bundleVersion}`)).toEqual([
      'acme-skills-other@0.1.0',
      'acme-skills-pack@1.0.10'
    ]);
    expect(refs[1].provenance).toMatchObject({
      kind: 'github-release', repository: 'acme/skills', collectionId: 'pack', tag: 'pack-v1.0.10', prerelease: false
    });

    const withPre = await listAll(new GitHubReleaseBundleProvider({ spec, client, includePrereleases: true }));
    expect(withPre.map((r) => r.bundleVersion)).toEqual(['0.1.0', '1.1.0-rc.1']);
  });

  it('pages through the release list', async () => {
    const client = new FakeGitHubApi();
    const filler = Array.from({ length: 100 }, (_, i) => ({
      id: 10_000 + i, tag_name: `notes-${String(i)}`, draft: false, prerelease: false, published_at: null, assets: []
    }));
    client.seedJson(`${RELEASES}&page=1`, filler);
    client.seedJson(`${RELEASES}&page=2`, [release(client, { tag: 'pack-v2.0.0', version: '2.0.0' })]);

    const provider = new GitHubReleaseBundleProvider({ spec, client });
    const refs = await listAll(provider);

    expect(refs.map((r) => r.bundleVersion)).toEqual(['2.0.0']);
    expect((await provider.getSelection()).ignored).toHaveLength(100);
  });

  it('identifies generic tags from the manifest asset and maps prompts[].file to harvestable items', async () => {
    const client = new FakeGitHubApi();
    client.seedJson(`${RELEASES}&page=1`, [release(client, { tag: 'release-2026-01', version: '3.0.0' })]);
    const provider = new GitHubReleaseBundleProvider({ spec, client });

    const [ref] = await listAll(provider);
    const prims = await harvestBundle(provider, ref as Parameters<typeof harvestBundle>[1]);

    expect(ref.bundleVersion).toBe('3.0.0');
    expect(prims.map((p) => `${p.kind}:${p.path}`)).toEqual(['prompt:prompts/hello.prompt.md']);
    expect(prims[0].bundle.provenance?.archive.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fails when the archive does not match the published digest', async () => {
    const client = new FakeGitHubApi();
    client.seedJson(`${RELEASES}&page=1`, [
      release(client, { tag: 'pack-v1.0.0', digest: () => `sha256:${'0'.repeat(64)}` })
    ]);

    await expect(listAll(new GitHubReleaseBundleProvider({ spec, client }))).rejects.toThrow(/does not match published digest/);
  });

  it('fails when the archive manifest disagrees with the release tag', async () => {
    const client = new FakeGitHubApi();
    client.seedJson(`${RELEASES}&page=1`, [release(client, { tag: 'pack-v1.0.1', version: '1.0.0' })]);

    await expect(listAll(new GitHubReleaseBundleProvider({ spec, client }))).rejects.toThrow(/declares pack@1\.0\.0, expected pack@1\.0\.1/);
  });

  it('enforces archive entry limits before extracting', async () => {
    const client = new FakeGitHubApi();
    client.seedJson(`${RELEASES}&page=1`, [release(client, { tag: 'pack-v1.0.0' })]);

    await expect(listAll(new GitHubReleaseBundleProvider({ spec, client, limits: { maxEntries: 1 } })))
      .rejects.toThrow(/entries exceed the limit of 1/);
  });

  it('reports the actual duplicate entry names of an ambiguous archive', () => {
    const entry = { path: 'prompts/a.prompt.md', bytes: enc.encode('x') };
    const zip = buildZip([{ path: 'deployment-manifest.yml', bytes: enc.encode('id: p') }, entry, entry]);

    expect(duplicateZipEntryNames(zip)).toEqual(['prompts/a.prompt.md']);
  });

  it('derives a revision from release metadata only, stable across instances', async () => {
    const client = new FakeGitHubApi();
    const releases = [release(client, { tag: 'pack-v1.0.0' }), release(client, { tag: 'other-v0.1.0', manifestId: 'other', version: '0.1.0' })];
    client.seedJson(`${RELEASES}&page=1`, releases);
    const first = await new GitHubReleaseBundleProvider({ spec, client }).getRevision();

    client.seedJson(`${RELEASES}&page=1`, releases.toReversed());
    expect(await new GitHubReleaseBundleProvider({ spec, client }).getRevision()).toBe(first);

    client.seedJson(`${RELEASES}&page=1`, [...releases, release(client, { tag: 'pack-v1.0.1', version: '1.0.1' })]);
    expect(await new GitHubReleaseBundleProvider({ spec, client }).getRevision()).not.toBe(first);
  });
});
