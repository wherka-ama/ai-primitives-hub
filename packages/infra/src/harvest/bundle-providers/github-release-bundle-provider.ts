/**
 * GitHubReleaseBundleProvider — harvests the **published** state of a
 * `type=github` source: the latest released archive of every collection,
 * rather than whatever is on the default branch.
 *
 * Each bundle is identified the way hub profiles reference it
 * (`{owner}-{repo}-{collectionId}`) with the manifest version as
 * `bundleVersion`, so primitive ids stay stable across releases while the
 * version and {@link BundleReleaseProvenance} pin the exact archive bytes.
 *
 * Fail-closed rules, so the index never silently mixes in unverified content:
 *   - drafts are never considered; prereleases only when requested;
 *   - a selected archive must match GitHub's published asset digest (when
 *     GitHub supplies one) and stay within size/entry limits;
 *   - the manifest inside the archive must declare the selected id/version.
 * @module harvest/bundle-providers/github-release-bundle-provider
 */
import {
  createHash,
} from 'node:crypto';
import type {
  BundleExtractor,
  BundleManifest,
  BundleProvider,
  BundleRef,
  BundleReleaseProvenance,
  GitHubApi,
  HubSourceSpec,
} from '@ai-primitives-hub/core';
import {
  compareSemverIfValid,
} from '@ai-primitives-hub/core';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CJS-only package, same style as ZipBundleExtractor
import AdmZip = require('adm-zip');
import {
  load as parseYaml,
} from 'js-yaml';
import {
  ZipBundleExtractor,
} from '../../extractors/zip-bundle-extractor';

export interface ReleaseArchiveLimits {
  maxArchiveBytes: number;
  maxEntries: number;
  maxUnpackedBytes: number;
}

export const DEFAULT_RELEASE_ARCHIVE_LIMITS: ReleaseArchiveLimits = {
  maxArchiveBytes: 100 * 1024 * 1024,
  maxEntries: 10_000,
  maxUnpackedBytes: 200 * 1024 * 1024
};

export interface GitHubReleaseBundleProviderOpts {
  spec: HubSourceSpec;
  client: GitHubApi;
  /** Consider prereleases when selecting the latest version. Default false. */
  includePrereleases?: boolean;
  limits?: Partial<ReleaseArchiveLimits>;
  extractor?: BundleExtractor;
}

interface ReleaseAsset {
  id: number;
  name: string;
  size: number;
  url: string;
  digest?: string | null;
  // eslint-disable-next-line @typescript-eslint/naming-convention -- GitHub API shape
  updated_at?: string;
}

interface Release {
  id: number;
  // eslint-disable-next-line @typescript-eslint/naming-convention -- GitHub API shape
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  // eslint-disable-next-line @typescript-eslint/naming-convention -- GitHub API shape
  published_at: string | null;
  assets: ReleaseAsset[];
}

/** One selected (latest) release of one collection. */
export interface SelectedRelease {
  collectionId: string;
  version: string;
  release: Release;
  manifestAsset: ReleaseAsset;
  archiveAsset: ReleaseAsset;
}

/** Release that could not be considered, kept for coverage reporting. */
export interface IgnoredRelease {
  tag: string;
  reason: string;
}

interface LoadedBundle {
  manifest: BundleManifest;
  files: ReadonlyMap<string, Uint8Array>;
}

const MANIFEST_NAMES = new Set(['deployment-manifest.yml', 'deployment-manifest.yaml', 'deployment-manifest.json']);
const TAG_PATTERN = /^([A-Za-z0-9._-]+)-v(\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?(?:\+[A-Za-z0-9.-]+)?)$/;
const PAGE_SIZE = 100;
const MAX_PAGES = 50;
const DOWNLOAD_CONCURRENCY = 4;

function isArchiveName(name: string): boolean {
  return name.toLowerCase().endsWith('.zip');
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function publishedDigest(asset: ReleaseAsset): string | undefined {
  const digest = asset.digest ?? undefined;
  if (digest === undefined || digest.length === 0) {
    return undefined;
  }
  const match = /^sha256:([0-9a-f]{64})$/i.exec(digest);
  if (!match) {
    throw new Error(`Unsupported digest format on asset ${asset.name}: ${digest}`);
  }
  return match[1].toLowerCase();
}

function parseManifestText(text: string, name: string): BundleManifest {
  const parsed = name.endsWith('.json') ? JSON.parse(text) as unknown : parseYaml(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${name} must contain an object`);
  }
  return parsed as BundleManifest;
}

/**
 * Deployment manifests list primitives under `prompts[].file` and MCP
 * servers under `mcpServers`; the harvester reads `items[].path` and
 * `mcp.items`. Translate without dropping the original fields.
 * @param manifest - Manifest parsed from the archive.
 */
export function toHarvestManifest(manifest: BundleManifest): BundleManifest {
  const raw = manifest as BundleManifest & {
    prompts?: { file?: unknown; type?: unknown; name?: unknown; description?: unknown; tags?: unknown }[];
    mcpServers?: Record<string, unknown>;
  };
  const items = Array.isArray(raw.items) && raw.items.length > 0
    ? raw.items
    : (Array.isArray(raw.prompts) ? raw.prompts : [])
      .filter((p) => p && typeof p.file === 'string' && p.file.length > 0)
      .map((p) => ({
        path: p.file as string,
        kind: typeof p.type === 'string' ? p.type : '',
        description: typeof p.description === 'string' && p.description.length > 0 ? p.description : undefined,
        tags: Array.isArray(p.tags) ? p.tags.filter((t): t is string => typeof t === 'string') : undefined
      }));
  const mcp = raw.mcp ?? (raw.mcpServers && typeof raw.mcpServers === 'object'
    ? { items: raw.mcpServers as NonNullable<BundleManifest['mcp']>['items'] }
    : undefined);
  return { ...manifest, items, ...(mcp === undefined ? {} : { mcp }) };
}

function normalizeRelativePath(value: string): string | undefined {
  const segments: string[] = [];
  const normalized = value.replaceAll('\\', '/');
  if (normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) {
    return undefined;
  }
  for (const segment of normalized.split('/')) {
    if (segment === '' || segment === '.') {
      continue;
    }
    if (segment === '..') {
      return undefined;
    }
    segments.push(segment);
  }
  return segments.length > 0 ? segments.join('/') : undefined;
}

/**
 * Entry names that occur more than once in the ZIP central directory.
 * adm-zip rejects such archives but its error template keeps the name from
 * the first duplicate it ever reported, so the names are read here instead.
 * Returns an empty list when the directory cannot be walked (e.g. ZIP64).
 * @param bytes - Archive bytes.
 */
export function duplicateZipEntryNames(bytes: Uint8Array): string[] {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minEocd = 22;
  let eocd = -1;
  for (let i = buf.length - minEocd; i >= Math.max(0, buf.length - minEocd - 0xFF_FF); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06_05_4B_50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    return [];
  }
  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (let n = 0; n < count && offset + 46 <= buf.length; n += 1) {
    if (buf.readUInt32LE(offset) !== 0x02_01_4B_50) {
      return [];
    }
    const nameLength = buf.readUInt16LE(offset + 28);
    const extraLength = buf.readUInt16LE(offset + 30);
    const commentLength = buf.readUInt16LE(offset + 32);
    const name = buf.toString('utf8', offset + 46, offset + 46 + nameLength);
    if (seen.has(name)) {
      duplicates.add(name);
    }
    seen.add(name);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return [...duplicates].toSorted();
}

/**
 * Reject archives whose declared shape exceeds limits before inflating them.
 * @param bytes - Archive bytes.
 * @param limits - Effective limits.
 * @param label - Archive label used in errors.
 */
function assertArchiveWithinLimits(bytes: Uint8Array, limits: ReleaseArchiveLimits, label: string): void {
  let entries: AdmZip.IZipEntry[];
  try {
    entries = new AdmZip(Buffer.from(bytes)).getEntries();
  } catch (error) {
    const duplicates = duplicateZipEntryNames(bytes);
    if (duplicates.length > 0) {
      throw new Error(`${label}: duplicate ZIP entry names are ambiguous and not allowed (${duplicates.join(', ')})`);
    }
    throw new Error(`${label}: unreadable ZIP archive (${(error as Error).message})`);
  }
  if (entries.length > limits.maxEntries) {
    throw new Error(`${label}: ${String(entries.length)} entries exceed the limit of ${String(limits.maxEntries)}`);
  }
  let unpacked = 0;
  for (const entry of entries) {
    unpacked += entry.header.size;
    // eslint-disable-next-line no-bitwise -- ZIP external attributes carry the Unix file type
    const fileType = (entry.attr >>> 16) & 0o17_0000;
    if (fileType === 0o12_0000) {
      throw new Error(`${label}: symbolic link entries are not allowed (${entry.entryName})`);
    }
  }
  if (unpacked > limits.maxUnpackedBytes) {
    throw new Error(`${label}: declared unpacked size exceeds ${String(limits.maxUnpackedBytes)} bytes`);
  }
}

/* eslint-disable @typescript-eslint/member-ordering -- public API kept at top. */
export class GitHubReleaseBundleProvider implements BundleProvider {
  private readonly limits: ReleaseArchiveLimits;
  private readonly extractor: BundleExtractor;
  private selection: Promise<{ selected: SelectedRelease[]; ignored: IgnoredRelease[] }> | undefined;
  private readonly loaded = new Map<string, Promise<LoadedBundle>>();
  private readonly refs = new Map<string, BundleRef>();

  public constructor(private readonly opts: GitHubReleaseBundleProviderOpts) {
    this.limits = { ...DEFAULT_RELEASE_ARCHIVE_LIMITS, ...opts.limits };
    this.extractor = opts.extractor ?? new ZipBundleExtractor();
  }

  /** Releases considered for selection, with ignored ones and their reasons. */
  public async getSelection(): Promise<{ selected: SelectedRelease[]; ignored: IgnoredRelease[] }> {
    this.selection ??= this.selectReleases();
    return this.selection;
  }

  /**
   * Stable revision of the released state: changes only when a selected
   * release, its archive asset, or its published digest changes. Requires
   * no archive downloads, so it is cheap enough for skip decisions.
   */
  public async getRevision(): Promise<string> {
    const { selected } = await this.getSelection();
    const entries = selected
      .map((s) => [
        s.collectionId,
        s.version,
        s.release.tag_name,
        s.archiveAsset.id,
        s.archiveAsset.digest ?? s.archiveAsset.updated_at ?? '',
        s.manifestAsset.id
      ])
      .toSorted((a, b) => String(a[0]).localeCompare(String(b[0])));
    return `releases-sha256:${createHash('sha256').update(JSON.stringify(entries)).digest('hex')}`;
  }

  public async* listBundles(): AsyncIterable<BundleRef> {
    const { selected } = await this.getSelection();
    // Download and verify up front: provenance carries the verified digest.
    for (let i = 0; i < selected.length; i += DOWNLOAD_CONCURRENCY) {
      const batch = selected.slice(i, i + DOWNLOAD_CONCURRENCY);
      const refs = await Promise.all(batch.map((s) => this.refFor(s)));
      for (const ref of refs) {
        yield ref;
      }
    }
  }

  public async readManifest(ref: BundleRef): Promise<BundleManifest> {
    return (await this.loadedFor(ref)).manifest;
  }

  public async readFile(ref: BundleRef, relPath: string): Promise<string> {
    const normalized = normalizeRelativePath(relPath);
    if (normalized === undefined) {
      throw new Error(`Refusing to read unsafe bundle path: ${relPath}`);
    }
    const bytes = (await this.loadedFor(ref)).files.get(normalized);
    if (bytes === undefined) {
      throw new Error(`Bundle ${ref.bundleId}@${ref.bundleVersion} has no file ${relPath}`);
    }
    return new TextDecoder().decode(bytes);
  }

  private bundleIdFor(collectionId: string): string {
    return `${this.opts.spec.owner}-${this.opts.spec.repo}-${collectionId}`;
  }

  private async loadedFor(ref: BundleRef): Promise<LoadedBundle> {
    const pending = this.loaded.get(`${ref.bundleId}\u0000${ref.bundleVersion}`);
    if (pending === undefined) {
      throw new Error(`Bundle ${ref.bundleId}@${ref.bundleVersion} was not listed by source ${this.opts.spec.id}`);
    }
    return pending;
  }

  private async refFor(selected: SelectedRelease): Promise<BundleRef> {
    const bundleId = this.bundleIdFor(selected.collectionId);
    const key = `${bundleId}\u0000${selected.version}`;
    const existing = this.refs.get(key);
    if (existing) {
      return existing;
    }
    const download = this.download(selected);
    const loaded = download.then((d) => d.loaded);
    // Failures surface through `await download` below; avoid a second unhandled rejection.
    loaded.catch(() => undefined);
    this.loaded.set(key, loaded);
    const { sha256 } = await download;
    const provenance: BundleReleaseProvenance = {
      kind: 'github-release',
      repository: `${this.opts.spec.owner}/${this.opts.spec.repo}`,
      collectionId: selected.collectionId,
      tag: selected.release.tag_name,
      releaseId: selected.release.id,
      publishedAt: selected.release.published_at ?? '',
      prerelease: selected.release.prerelease,
      archive: {
        assetId: selected.archiveAsset.id,
        name: selected.archiveAsset.name,
        size: selected.archiveAsset.size,
        sha256
      },
      manifestAssetId: selected.manifestAsset.id
    };
    const ref: BundleRef = {
      sourceId: this.opts.spec.id,
      sourceType: this.opts.spec.type,
      bundleId,
      bundleVersion: selected.version,
      installed: false,
      provenance
    };
    this.refs.set(key, ref);
    return ref;
  }

  private async download(selected: SelectedRelease): Promise<{ sha256: string; loaded: LoadedBundle }> {
    const label = `${this.opts.spec.id}:${selected.release.tag_name}/${selected.archiveAsset.name}`;
    if (selected.archiveAsset.size > this.limits.maxArchiveBytes) {
      throw new Error(`${label}: archive exceeds ${String(this.limits.maxArchiveBytes)} bytes`);
    }
    const bytes = await this.opts.client.download(this.assetPath(selected.archiveAsset));
    if (bytes.byteLength > this.limits.maxArchiveBytes) {
      throw new Error(`${label}: downloaded archive exceeds ${String(this.limits.maxArchiveBytes)} bytes`);
    }
    const sha256 = sha256Hex(bytes);
    const expected = publishedDigest(selected.archiveAsset);
    if (expected !== undefined && expected !== sha256) {
      throw new Error(`${label}: archive digest ${sha256} does not match published digest ${expected}`);
    }
    assertArchiveWithinLimits(bytes, this.limits, label);
    const files = await this.extractor.extract(bytes);
    const manifestEntries = [...files.keys()].filter((name) => MANIFEST_NAMES.has(name));
    if (manifestEntries.length !== 1) {
      throw new Error(`${label}: expected exactly one root deployment manifest, found ${String(manifestEntries.length)}`);
    }
    const manifestName = manifestEntries[0];
    const manifest = parseManifestText(new TextDecoder().decode(files.get(manifestName)), manifestName);
    if (manifest.id !== selected.collectionId || String(manifest.version) !== selected.version) {
      throw new Error(
        `${label}: archive manifest declares ${String(manifest.id)}@${String(manifest.version)}, `
        + `expected ${selected.collectionId}@${selected.version}`
      );
    }
    return { sha256, loaded: { manifest: toHarvestManifest(manifest), files } };
  }

  private assetPath(asset: ReleaseAsset): string {
    if (!Number.isSafeInteger(asset.id) || asset.id <= 0) {
      throw new Error(`Invalid release asset id in ${this.opts.spec.owner}/${this.opts.spec.repo}`);
    }
    return `/repos/${this.opts.spec.owner}/${this.opts.spec.repo}/releases/assets/${String(asset.id)}`;
  }

  private async listReleases(): Promise<Release[]> {
    const releases: Release[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const batch = await this.opts.client.getJson<Release[]>(
        `/repos/${this.opts.spec.owner}/${this.opts.spec.repo}/releases?per_page=${String(PAGE_SIZE)}&page=${String(page)}`
      );
      if (!Array.isArray(batch)) {
        throw new TypeError(`Invalid release list for ${this.opts.spec.owner}/${this.opts.spec.repo}`);
      }
      releases.push(...batch);
      if (batch.length < PAGE_SIZE) {
        return releases;
      }
    }
    throw new Error(`Release list for ${this.opts.spec.owner}/${this.opts.spec.repo} exceeds ${String(MAX_PAGES * PAGE_SIZE)} releases`);
  }

  private async identify(release: Release, manifestAsset: ReleaseAsset): Promise<{ collectionId: string; version: string }> {
    const match = TAG_PATTERN.exec(release.tag_name);
    if (match) {
      return { collectionId: match[1], version: match[2] };
    }
    const manifest = parseManifestText(await this.opts.client.getText(this.assetPath(manifestAsset)), manifestAsset.name);
    if (typeof manifest.id !== 'string' || manifest.id.length === 0 || manifest.version === undefined) {
      throw new Error('deployment manifest has no id/version');
    }
    return { collectionId: manifest.id, version: String(manifest.version) };
  }

  private async selectReleases(): Promise<{ selected: SelectedRelease[]; ignored: IgnoredRelease[] }> {
    const ignored: IgnoredRelease[] = [];
    const latest = new Map<string, SelectedRelease>();
    for (const release of await this.listReleases()) {
      if (release.draft) {
        continue;
      }
      if (release.prerelease && this.opts.includePrereleases !== true) {
        ignored.push({ tag: release.tag_name, reason: 'prerelease' });
        continue;
      }
      const manifests = release.assets.filter((a) => MANIFEST_NAMES.has(a.name));
      const archives = release.assets.filter((a) => isArchiveName(a.name));
      if (manifests.length !== 1 || archives.length !== 1) {
        ignored.push({
          tag: release.tag_name,
          reason: `expected one deployment manifest and one ZIP asset, found ${String(manifests.length)} and ${String(archives.length)}`
        });
        continue;
      }
      let identity: { collectionId: string; version: string };
      try {
        identity = await this.identify(release, manifests[0]);
      } catch (error) {
        ignored.push({ tag: release.tag_name, reason: error instanceof Error ? error.message : String(error) });
        continue;
      }
      const candidate: SelectedRelease = { ...identity, release, manifestAsset: manifests[0], archiveAsset: archives[0] };
      const current = latest.get(identity.collectionId);
      if (current === undefined || isNewer(candidate, current)) {
        if (current !== undefined) {
          ignored.push({ tag: current.release.tag_name, reason: 'superseded' });
        }
        latest.set(identity.collectionId, candidate);
      } else {
        ignored.push({ tag: release.tag_name, reason: 'superseded' });
      }
    }
    const selected = [...latest.values()].toSorted((a, b) => a.collectionId.localeCompare(b.collectionId));
    return { selected, ignored };
  }
}

function isNewer(candidate: SelectedRelease, current: SelectedRelease): boolean {
  const bySemver = compareSemverIfValid(candidate.version, current.version);
  if (bySemver !== undefined && bySemver !== 0) {
    return bySemver > 0;
  }
  return Date.parse(candidate.release.published_at ?? '') > Date.parse(current.release.published_at ?? '');
}
