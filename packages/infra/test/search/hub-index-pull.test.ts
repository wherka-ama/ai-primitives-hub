import {
  createHash,
} from 'node:crypto';
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
  pullHubIndex,
  unpinHubIndex,
} from '../../src/search/hub-index-pull';
import {
  AppStoragePrimitiveIndexStore,
  XdgAppStorage,
} from '../../src/storage';

const MODEL = '@ternlight/mini@0.1.1';
const sha = (v: Buffer | string): string => createHash('sha256').update(v).digest('hex');

async function publish(dir: string, generation: string, title = 'Hello', model = MODEL): Promise<{ manifest: Record<string, unknown>; bytes: Buffer }> {
  const digest = `sha256:${sha(`${title}|${model}`)}`;
  const sourceRevision = `hub-index-${digest}`;
  const index = {
    schemaVersion: 2,
    vectorEncoding: 'i8-base64',
    hubId: 'Owner/hub',
    sourceRevision,
    searchProfileId: 'ternlight-dual-v1',
    embeddingsMeta: { provider: 'ternlight', dim: 384, model },
    primitives: [{ id: 'p1', title }]
  };
  const bytes = Buffer.from(JSON.stringify(index));
  const manifest = {
    kind: 'ai-primitives-hub/hub-index',
    schemaVersion: 1,
    hubId: 'Owner/hub',
    generation,
    indexDigest: digest,
    sourceRevision,
    searchProfileId: 'ternlight-dual-v1',
    embeddings: { provider: 'ternlight', dim: 384, model },
    totals: { primitives: 1, bundles: 1 },
    file: { name: 'hub-index.json', size: bytes.length, sha256: sha(bytes) }
  };
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'hub-index.json'), bytes);
  await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  return { manifest, bytes };
}

describe('pullHubIndex', () => {
  let tmp: string;
  let store: AppStoragePrimitiveIndexStore;
  let pub: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hub-index-pull-'));
    store = new AppStoragePrimitiveIndexStore(new XdgAppStorage({ AI_PRIMITIVES_HUB_CACHE: path.join(tmp, 'cache') }));
    pub = path.join(tmp, 'pub');
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('installs and pins a publication, then reports it up to date', async () => {
    await publish(pub, '2026-01-01T00:00:00Z');
    const first = await pullHubIndex({ from: pub, hubId: 'hub', store, localModel: MODEL });
    expect(first).toMatchObject({ status: 'installed', pinned: true, attestationVerified: false });
    expect(JSON.parse(await fs.readFile(first.path, 'utf8')).primitives[0].title).toBe('Hello');
    expect(await store.findLatestIndexPath('hub', 'ternlight-dual-v1')).toBe(first.path);

    const second = await pullHubIndex({ from: pub, hubId: 'hub', store, localModel: MODEL });
    expect(second.status).toBe('up-to-date');
  });

  it('prefers the pinned index over a newer harvested one until it is unpinned', async () => {
    const { path: pinned } = await pullHubIndex({ from: (await publish(pub, '2026-01-01T00:00:00Z'), pub), hubId: 'hub', store, localModel: MODEL });
    const harvested = store.getIndexPath({ hubId: 'hub', sourceRevision: 'local', searchProfileId: 'ternlight-dual-v1' });
    await fs.mkdir(path.dirname(harvested), { recursive: true });
    await fs.writeFile(harvested, JSON.stringify({ primitives: [{ bundle: { sourceId: 's' } }], sourceRevisions: { s: 'x' } }));
    expect(await store.findLatestIndexPath('hub', 'ternlight-dual-v1')).toBe(pinned);

    expect(await unpinHubIndex(store, 'hub')).toEqual(['ternlight-dual-v1']);
    expect(await store.findLatestIndexPath('hub', 'ternlight-dual-v1')).toBe(harvested);
  });

  it('refuses a tampered index and leaves nothing installed', async () => {
    await publish(pub, '2026-01-01T00:00:00Z');
    const file = path.join(pub, 'hub-index.json');
    await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replace('Hello', 'Hellp'));
    await expect(pullHubIndex({ from: pub, hubId: 'hub', store, localModel: MODEL })).rejects.toMatchObject({ code: 'INTEGRITY_FAILED' });
    expect(await store.findLatestIndexPath('hub', 'ternlight-dual-v1')).toBeUndefined();
  });

  it('refuses a rollback unless allowed', async () => {
    await publish(pub, '2026-02-01T00:00:00Z');
    await pullHubIndex({ from: pub, hubId: 'hub', store, localModel: MODEL });
    await publish(pub, '2026-01-01T00:00:00Z', 'Older');
    await expect(pullHubIndex({ from: pub, hubId: 'hub', store, localModel: MODEL })).rejects.toMatchObject({ code: 'ROLLBACK_REFUSED' });
    expect((await pullHubIndex({ from: pub, hubId: 'hub', store, localModel: MODEL, allowRollback: true })).status).toBe('installed');
  });

  it('refuses an index embedded with another model', async () => {
    await publish(pub, '2026-01-01T00:00:00Z', 'Hello', '@ternlight/mini@9.9.9');
    await expect(pullHubIndex({ from: pub, hubId: 'hub', store, localModel: MODEL })).rejects.toMatchObject({ code: 'MODEL_MISMATCH' });
  });

  it('refuses a manifest that names a path instead of a file', async () => {
    const { manifest } = await publish(pub, '2026-01-01T00:00:00Z');
    await fs.writeFile(path.join(pub, 'manifest.json'), JSON.stringify({ ...manifest, file: { ...(manifest.file as object), name: '../x.json' } }));
    await expect(pullHubIndex({ from: pub, hubId: 'hub', store })).rejects.toMatchObject({ code: 'INVALID_MANIFEST' });
  });

  it('pulls the newest hub-index release from GitHub and fails when attestation fails', async () => {
    const { manifest, bytes } = await publish(pub, '2026-01-01T00:00:00Z');
    const requests: string[] = [];
    const respond = (url: string | URL): Response => {
      requests.push(String(url));
      const u = String(url);
      if (u.endsWith('/releases?per_page=50')) {
        return Response.json([
          { tag_name: 'v1.0.0', draft: false, assets: [] },
          { tag_name: 'hub-index-new', draft: true, assets: [{ id: 9, name: 'manifest.json', size: 1 }] },
          { tag_name: 'hub-index-abc', draft: false, assets: [{ id: 1, name: 'manifest.json', size: 1 }, { id: 2, name: 'hub-index.json', size: 1 }] }
        ]);
      }
      if (u.endsWith('/assets/1')) {
        return Response.json(manifest);
      }
      if (u.endsWith('/assets/2')) {
        return new Response(bytes);
      }
      return new Response('not found', { status: 404 });
    };
    const fetchImpl = ((url: string | URL) => Promise.resolve(respond(url))) as typeof fetch;
    const result = await pullHubIndex({ from: 'github:Owner/hub', hubId: 'hub', store, localModel: MODEL, fetchImpl, token: 't' });
    expect(result).toMatchObject({ status: 'installed', from: 'github:Owner/hub@hub-index-abc' });

    const failing = { execFile: () => Promise.reject(Object.assign(new Error('exit 1'), { stderr: 'no attestations found' })) };
    await expect(pullHubIndex({
      from: 'github:Owner/hub', hubId: 'hub2', store, fetchImpl, verifyAttestationRepo: 'Owner/hub', processExecutor: failing
    })).rejects.toMatchObject({ code: 'ATTESTATION_FAILED' });
    expect(await store.findLatestIndexPath('hub2', 'ternlight-dual-v1')).toBeUndefined();
  });
});
