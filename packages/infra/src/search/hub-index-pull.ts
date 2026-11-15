/**
 * Install a search index published by a Hub instead of harvesting it locally.
 *
 * A Hub publication is a `manifest.json` plus the index file it describes. The
 * manifest is read first; the index is downloaded only when its digest differs
 * from the installed one and its generation is newer. The download is checked
 * against the manifest (size, SHA-256, identity, profile, embedding model)
 * before it is written atomically into the shared index cache, where
 * `index search` and the extension find it. A pull pins the profile so the
 * published index wins over locally harvested ones until it is unpinned.
 * @module search/hub-index-pull
 */
import {
  createHash,
  randomUUID,
} from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type {
  ProcessExecutor,
} from '@ai-primitives-hub/core';
import type {
  AppStoragePrimitiveIndexStore,
  PublishedIndexEntry,
} from '../storage/primitive-index-store';

export const HUB_INDEX_KIND = 'ai-primitives-hub/hub-index';
export const HUB_INDEX_SCHEMA = 1;
/** Tag prefix of GitHub releases that carry a Hub index publication. */
export const HUB_INDEX_RELEASE_PREFIX = 'hub-index-';
const KNOWN_PROFILES = new Set(['bm25-v1', 'ternlight-single-v1', 'ternlight-dual-v1']);
const SUPPORTED_INDEX_SCHEMAS = new Set([1, 2]);
const MAX_INDEX_BYTES = 256 * 1024 * 1024;
const MANIFEST_FILE = 'manifest.json';

/** Publication manifest written next to a published index. */
export interface HubIndexManifest {
  kind: string;
  schemaVersion: number;
  hubId: string;
  scope?: string;
  generation: string;
  snapshotDigest?: string;
  indexDigest: string;
  sourceRevision: string;
  searchProfileId: string;
  embeddings?: { provider?: string; dim?: number; model?: string | { package: string; version: string } } | null;
  totals?: { primitives: number; bundles: number };
  file: { name: string; size: number; sha256: string };
  harvester?: { repository?: string; commit?: string };
}

export class HubIndexPullError extends Error {
  public constructor(
    public readonly code:
      | 'INVALID_SOURCE'
      | 'FETCH_FAILED'
      | 'INVALID_MANIFEST'
      | 'ATTESTATION_FAILED'
      | 'MODEL_MISMATCH'
      | 'ROLLBACK_REFUSED'
      | 'INTEGRITY_FAILED',
    message: string
  ) {
    super(message);
    this.name = 'HubIndexPullError';
  }
}

export interface HubIndexPullOptions {
  /** Local directory, https base URL, or `github:OWNER/REPO[@TAG]`. */
  from: string;
  /** Canonical hub namespace to install under; defaults to the manifest hubId. */
  hubId?: string;
  store: AppStoragePrimitiveIndexStore;
  token?: string;
  /** Embedding model the local client embeds queries with, e.g. `@ternlight/mini@0.1.1`. */
  localModel?: string;
  /** Verify the manifest's build provenance with `gh attestation verify --repo <repo>`. */
  verifyAttestationRepo?: string;
  processExecutor?: ProcessExecutor;
  allowRollback?: boolean;
  /** Pin the profile so the published index wins over harvested ones (default true). */
  pin?: boolean;
  fetchImpl?: typeof fetch;
  /** GitHub REST API base for `github:` sources. */
  githubApiUrl?: string;
  now?: () => Date;
}

export interface HubIndexPullResult {
  status: 'installed' | 'up-to-date';
  hubId: string;
  path: string;
  manifest: HubIndexManifest;
  /** Resolved location (for `github:` sources, includes the release tag). */
  from: string;
  attestationVerified: boolean;
  pinned: boolean;
  warnings: string[];
}

interface Location {
  label: string;
  read(name: string, maxBytes: number): Promise<Buffer>;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- GitHub REST field
interface GithubRelease { tag_name: string; draft: boolean; assets: { id: number; name: string; size: number }[] }

const sha256 = (value: Buffer | string): string => createHash('sha256').update(value).digest('hex');

/**
 * Normalize a manifest model (string or `{package, version}`) to `package@version`.
 * @param model Manifest embeddings model.
 */
export function manifestModelName(model: unknown): string | undefined {
  if (typeof model === 'string' && model.length > 0) {
    return model;
  }
  if (model && typeof model === 'object') {
    const { package: pkg, version } = model as { package?: unknown; version?: unknown };
    if (typeof pkg === 'string' && typeof version === 'string') {
      return `${pkg}@${version}`;
    }
  }
  return undefined;
}

/**
 * Validate a publication manifest; throws listing every problem.
 * @param manifest Parsed `manifest.json`.
 */
export function validateHubIndexManifest(manifest: unknown): asserts manifest is HubIndexManifest {
  const m = manifest as Partial<HubIndexManifest> | null;
  const problems: string[] = [];
  if (m?.kind !== HUB_INDEX_KIND) {
    problems.push(`kind is not ${HUB_INDEX_KIND}`);
  }
  if (m?.schemaVersion !== HUB_INDEX_SCHEMA) {
    problems.push(`unsupported schemaVersion ${String(m?.schemaVersion)}`);
  }
  if (typeof m?.hubId !== 'string' || m.hubId.length === 0) {
    problems.push('hubId is missing');
  }
  if (typeof m?.generation !== 'string' || Number.isNaN(Date.parse(m.generation))) {
    problems.push('generation is not a timestamp');
  }
  if (!/^sha256:[0-9a-f]{64}$/u.test(m?.indexDigest ?? '')) {
    problems.push('indexDigest is invalid');
  }
  if (typeof m?.sourceRevision !== 'string' || m.sourceRevision.length === 0) {
    problems.push('sourceRevision is missing');
  }
  if (!KNOWN_PROFILES.has(m?.searchProfileId ?? '')) {
    problems.push(`unknown search profile ${String(m?.searchProfileId)}`);
  }
  const file = m?.file;
  if (!file || typeof file.name !== 'string' || !/^[\w.-]+$/u.test(file.name) || file.name === MANIFEST_FILE) {
    problems.push('file name is not a plain file name');
  }
  if (!Number.isInteger(file?.size) || (file?.size ?? 0) <= 0 || (file?.size ?? 0) > MAX_INDEX_BYTES) {
    problems.push('file size is invalid');
  }
  if (!/^[0-9a-f]{64}$/u.test(file?.sha256 ?? '')) {
    problems.push('file sha256 is invalid');
  }
  if (problems.length > 0) {
    throw new HubIndexPullError('INVALID_MANIFEST', `Invalid Hub index manifest: ${problems.join('; ')}`);
  }
}

async function readBody(response: Response, label: string, maxBytes: number): Promise<Buffer> {
  if (!response.ok) {
    throw new HubIndexPullError('FETCH_FAILED', `GET ${label} failed: HTTP ${String(response.status)}`);
  }
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > maxBytes) {
    throw new HubIndexPullError('FETCH_FAILED', `${label} is larger than ${String(maxBytes)} bytes`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) {
    throw new HubIndexPullError('FETCH_FAILED', `${label} is larger than ${String(maxBytes)} bytes`);
  }
  return bytes;
}

async function githubLocation(spec: string, opts: HubIndexPullOptions, fetchImpl: typeof fetch): Promise<Location> {
  const match = /^github:([\w.-]+)\/([\w.-]+)(?:@([\w.-]+))?$/u.exec(spec);
  if (!match) {
    throw new HubIndexPullError('INVALID_SOURCE', `Invalid GitHub source "${spec}"; expected github:OWNER/REPO[@TAG]`);
  }
  const [, owner, repo, tag] = match;
  const api = (opts.githubApiUrl ?? 'https://api.github.com').replace(/\/+$/u, '');
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {})
  };
  let release: GithubRelease | undefined;
  if (tag) {
    const response = await fetchImpl(`${api}/repos/${owner}/${repo}/releases/tags/${tag}`, { headers });
    release = JSON.parse((await readBody(response, `release ${tag}`, 16 * 1024 * 1024)).toString('utf8')) as GithubRelease;
  } else {
    const response = await fetchImpl(`${api}/repos/${owner}/${repo}/releases?per_page=50`, { headers });
    const releases = JSON.parse((await readBody(response, `releases of ${owner}/${repo}`, 16 * 1024 * 1024)).toString('utf8')) as GithubRelease[];
    // The API lists releases newest first.
    release = releases.find((r) => !r.draft && r.tag_name.startsWith(HUB_INDEX_RELEASE_PREFIX)
      && r.assets.some((a) => a.name === MANIFEST_FILE));
  }
  if (!release) {
    throw new HubIndexPullError('FETCH_FAILED', `No ${HUB_INDEX_RELEASE_PREFIX}* release with a ${MANIFEST_FILE} asset in ${owner}/${repo}`);
  }
  const found = release;
  return {
    label: `github:${owner}/${repo}@${found.tag_name}`,
    read: async (name, maxBytes) => {
      const asset = found.assets.find((a) => a.name === name);
      if (!asset) {
        throw new HubIndexPullError('FETCH_FAILED', `Release ${found.tag_name} has no asset ${name}`);
      }
      const response = await fetchImpl(`${api}/repos/${owner}/${repo}/releases/assets/${String(asset.id)}`, {
        headers: { ...headers, accept: 'application/octet-stream' },
        redirect: 'follow'
      });
      return readBody(response, name, maxBytes);
    }
  };
}

async function resolveLocation(opts: HubIndexPullOptions): Promise<Location> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const { from } = opts;
  if (from.startsWith('github:')) {
    return githubLocation(from, opts, fetchImpl);
  }
  if (/^https:\/\//u.test(from)) {
    const base = from.endsWith('/') ? from : `${from}/`;
    return {
      label: from,
      read: async (name, maxBytes) => {
        const url = new URL(name, base);
        const response = await fetchImpl(url, {
          headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
          redirect: 'follow'
        });
        return readBody(response, url.href, maxBytes);
      }
    };
  }
  if (/^[a-z][\w+.-]*:\/\//iu.test(from)) {
    throw new HubIndexPullError('INVALID_SOURCE', 'Only local directories, https URLs and github:OWNER/REPO[@TAG] are supported');
  }
  const dir = path.resolve(from);
  return {
    label: dir,
    read: async (name, maxBytes) => {
      const file = path.join(dir, name);
      try {
        const stat = await fs.stat(file);
        if (stat.size > maxBytes) {
          throw new HubIndexPullError('FETCH_FAILED', `${file} is larger than ${String(maxBytes)} bytes`);
        }
        return await fs.readFile(file);
      } catch (error) {
        if (error instanceof HubIndexPullError) {
          throw error;
        }
        throw new HubIndexPullError('FETCH_FAILED', `Cannot read ${file}: ${(error as Error).message}`);
      }
    }
  };
}

async function writeAtomic(file: string, content: Buffer | string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${String(process.pid)}.${randomUUID()}.tmp`);
  try {
    await fs.writeFile(tmp, content);
    await fs.rename(tmp, file);
  } finally {
    await fs.rm(tmp, { force: true });
  }
}

async function verifyAttestation(bytes: Buffer, repo: string, opts: HubIndexPullOptions): Promise<void> {
  if (!opts.processExecutor) {
    throw new HubIndexPullError('ATTESTATION_FAILED', 'Attestation verification needs a process executor to run gh');
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hub-index-attest-'));
  const file = path.join(dir, MANIFEST_FILE);
  try {
    await fs.writeFile(file, bytes);
    await opts.processExecutor.execFile('gh', ['attestation', 'verify', file, '--repo', repo], {
      env: opts.token ? { GH_TOKEN: opts.token } : {},
      timeoutMs: 120_000
    });
  } catch (error) {
    const detail = (error as { stderr?: string }).stderr?.trim() || (error as Error).message;
    throw new HubIndexPullError('ATTESTATION_FAILED', `The manifest has no valid build provenance from ${repo}: ${detail}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function checkManifestModel(manifest: HubIndexManifest, localModel: string | undefined, warnings: string[]): void {
  if (!manifest.embeddings) {
    return;
  }
  const model = manifestModelName(manifest.embeddings.model);
  if (!model) {
    warnings.push('the manifest does not name its embedding model; query embeddings may not match');
    return;
  }
  if (localModel && model !== localModel) {
    throw new HubIndexPullError('MODEL_MISMATCH', `Embedding model mismatch: the index uses ${model}, this client ${localModel}`);
  }
}

function checkIndex(bytes: Buffer, manifest: HubIndexManifest, localModel: string | undefined): void {
  if (bytes.length !== manifest.file.size) {
    throw new HubIndexPullError('INTEGRITY_FAILED', `Size mismatch: expected ${String(manifest.file.size)}, got ${String(bytes.length)}`);
  }
  if (sha256(bytes) !== manifest.file.sha256) {
    throw new HubIndexPullError('INTEGRITY_FAILED', 'SHA-256 mismatch: the index does not match its manifest');
  }
  let index: {
    schemaVersion?: unknown; primitives?: unknown; hubId?: unknown; sourceRevision?: unknown;
    searchProfileId?: unknown; embeddingsMeta?: { model?: unknown } | null;
  };
  try {
    index = JSON.parse(bytes.toString('utf8')) as typeof index;
  } catch {
    throw new HubIndexPullError('INTEGRITY_FAILED', 'The index is not valid JSON');
  }
  if (!SUPPORTED_INDEX_SCHEMAS.has(index.schemaVersion as number) || !Array.isArray(index.primitives)) {
    throw new HubIndexPullError('INTEGRITY_FAILED', `Not a supported primitive index (schemaVersion ${String(index.schemaVersion)})`);
  }
  const profile = (index.searchProfileId as string | undefined) ?? 'bm25-v1';
  if (index.hubId !== manifest.hubId || index.sourceRevision !== manifest.sourceRevision || profile !== manifest.searchProfileId) {
    throw new HubIndexPullError('INTEGRITY_FAILED', 'The index identity (hubId, sourceRevision, searchProfileId) does not match its manifest');
  }
  const indexModel = index.embeddingsMeta?.model;
  if (typeof indexModel === 'string' && localModel && indexModel !== localModel) {
    throw new HubIndexPullError('MODEL_MISMATCH', `Embedding model mismatch: the index uses ${indexModel}, this client ${localModel}`);
  }
}

/**
 * Install the published index when it is new, and pin it.
 * @param opts Pull options.
 */
export async function pullHubIndex(opts: HubIndexPullOptions): Promise<HubIndexPullResult> {
  const location = await resolveLocation(opts);
  const manifestBytes = await location.read(MANIFEST_FILE, 1024 * 1024);
  let manifest: unknown;
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch {
    throw new HubIndexPullError('INVALID_MANIFEST', 'manifest.json is not valid JSON');
  }
  validateHubIndexManifest(manifest);
  const warnings: string[] = [];
  checkManifestModel(manifest, opts.localModel, warnings);

  let attestationVerified = false;
  if (opts.verifyAttestationRepo) {
    await verifyAttestation(manifestBytes, opts.verifyAttestationRepo, opts);
    attestationVerified = true;
  }

  const hubId = opts.hubId ?? manifest.hubId;
  const pin = opts.pin ?? true;
  const { store } = opts;
  const profileId = manifest.searchProfileId;
  const target = store.getIndexPath({ hubId, sourceRevision: manifest.sourceRevision, searchProfileId: profileId });
  const state = await store.readPublishedState(hubId);
  const installed = state.profiles[profileId];
  const now = (opts.now ?? (() => new Date()))();
  const record = async (entry: PublishedIndexEntry): Promise<void> => {
    state.profiles = { ...state.profiles, [profileId]: entry };
    await writeAtomic(store.getPublishedStatePath(hubId), `${JSON.stringify(state, null, 2)}\n`);
  };

  const installedExists = installed !== undefined
    && await fs.access(store.getIndexPath({ hubId, sourceRevision: installed.sourceRevision, searchProfileId: profileId })).then(() => true, () => false);
  if (installed?.indexDigest === manifest.indexDigest && installedExists) {
    if (installed.pinned !== pin) {
      await record({ ...installed, pinned: pin });
    }
    return { status: 'up-to-date', hubId, path: target, manifest, from: location.label, attestationVerified, pinned: pin, warnings };
  }
  if (installed && installedExists && Date.parse(manifest.generation) <= Date.parse(installed.generation) && opts.allowRollback !== true) {
    throw new HubIndexPullError(
      'ROLLBACK_REFUSED',
      `Refusing to replace generation ${installed.generation} with older or equal ${manifest.generation}; pass --allow-rollback to accept it`
    );
  }

  const bytes = await location.read(manifest.file.name, MAX_INDEX_BYTES);
  checkIndex(bytes, manifest, opts.localModel);

  await writeAtomic(target, bytes);
  await writeAtomic(path.join(path.dirname(target), MANIFEST_FILE), manifestBytes);
  await record({
    indexDigest: manifest.indexDigest,
    generation: manifest.generation,
    sourceRevision: manifest.sourceRevision,
    pinned: pin,
    installedAt: now.toISOString(),
    from: location.label
  });
  return { status: 'installed', hubId, path: target, manifest, from: location.label, attestationVerified, pinned: pin, warnings };
}

/**
 * Unpin published indexes so locally harvested ones are preferred again.
 * @param store Index store.
 * @param hubId Canonical hub identity.
 * @param profileIds Profiles to unpin; all when omitted.
 * @returns The profiles that were unpinned.
 */
export async function unpinHubIndex(
  store: AppStoragePrimitiveIndexStore,
  hubId: string,
  profileIds?: readonly string[]
): Promise<string[]> {
  const state = await store.readPublishedState(hubId);
  const unpinned: string[] = [];
  for (const [profileId, entry] of Object.entries(state.profiles)) {
    if (entry.pinned && (!profileIds || profileIds.includes(profileId))) {
      state.profiles[profileId] = { ...entry, pinned: false };
      unpinned.push(profileId);
    }
  }
  if (unpinned.length > 0) {
    await writeAtomic(store.getPublishedStatePath(hubId), `${JSON.stringify(state, null, 2)}\n`);
  }
  return unpinned;
}
