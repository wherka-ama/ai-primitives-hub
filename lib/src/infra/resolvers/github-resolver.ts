/**
 * Phase 5 spillover / Iter 19-20 — GitHubBundleResolver.
 *
 * Resolves a `BundleSpec` against a GitHub repository's releases,
 * mirroring `GitHubAdapter.fetchBundles + getDownloadUrl` from the
 * VS Code extension. Produces an `Installable` whose `downloadUrl`
 * points at the release asset that `BundleDownloader` will fetch.
 *
 * Design: D14 (resolver = non-VS-Code slice of adapter), D17 (uses
 * a `TokenProvider` rather than reading env directly).
 */
import {
  type BundleSpec,
  type Installable,
} from '../../domain/install';
import {
  generateSourceId,
} from '../../domain/source-id';
import {
  type HttpClient,
  type TokenProvider,
} from '../../ports/http';
import {
  type BundleResolver,
} from '../../ports/source-resolver';

/**
 * Minimal shape of GitHub's `/releases` API response (subset we use).
 */
/* eslint-disable @typescript-eslint/naming-convention -- GitHub REST API field names are fixed external identifiers */
interface GitHubRelease {
  tag_name: string;
  name?: string;
  assets: { name: string; browser_download_url: string; url?: string }[];
  draft?: boolean;
  prerelease?: boolean;
}
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Options for GitHubBundleResolver.
 */
export interface GitHubResolverOptions {
  /** GitHub repo slug, e.g. `owner/repo`. */
  repoSlug: string;
  /** Asset filename within each release; defaults to `bundle.zip`. */
  assetName?: string;
  /** API base URL; override for GHES. Defaults to `https://api.github.com`. */
  apiBase?: string;
  /** Required HttpClient for the network calls. */
  http: HttpClient;
  /** Required TokenProvider for auth headers. */
  tokens: TokenProvider;
}

/**
 * Resolver that lists releases of a GitHub repo and matches them
 * against a `BundleSpec`. Returns a single `Installable` whose
 * `downloadUrl` is the release-asset URL.
 *
 * Caches the release list per instance to avoid repeated API calls
 * when `resolve` is invoked multiple times in one process.
 */
/* eslint-disable @typescript-eslint/member-ordering -- public surface first, private helpers below */
export class GitHubBundleResolver implements BundleResolver {
  private cachedReleases: GitHubRelease[] | null = null;

  /**
   * Create a GitHubBundleResolver.
   * @param opts Options for the resolver.
   */
  constructor(private readonly opts: GitHubResolverOptions) {
    // Intentionally empty
  }

  /**
   * Find an Installable for the given spec.
   * @param spec Parsed BundleSpec.
   * @returns Installable, or `null` when the bundle is not present.
   */
  public async resolve(spec: BundleSpec): Promise<Installable | null> {
    const releases = await this.listReleases();
    if (releases.length === 0) {
      return null;
    }
    // Extract the bundle name (collection) from the bundle ID to match against release tags.
    // This makes the mechanism resilient to repository renames by separating the collection name
    // from the repository name.
    // For example, "Amadeus-xDLC-genai.clean-code-in-the-cloud-skills-collection-amadeus-microservice-coding-guidebook"
    // should match release tags starting with "amadeus-microservice-coding-guidebook-".
    const { collection: bundleName } = decomposeBundleId(spec.bundleId, this.opts.repoSlug);
    // I-004: real-world hubs use a variety of tag conventions:
    //   "vX.Y.Z"          (canonical semver tag)
    //   "X.Y.Z"           (semver without v)
    //   "<prefix>-vX.Y.Z" (Amadeus convention: bundle id + v + semver)
    //   "<prefix>-X.Y.Z"  (same without v)
    // Match all four when the caller asks for a specific version,
    // and extract the bare semver from the tag for `bundleVersion`.
    const wantVersion = spec.bundleVersion;
    let release: GitHubRelease | undefined;
    if (wantVersion === undefined || wantVersion === 'latest') {
      // For multi-collection repositories, we need to find the highest semantic version
      // for the specific collection, not just the first matching release.
      // Filter releases by bundle name prefix and extract versions
      const matchingReleases = releases.filter((r) =>
        r.draft !== true && r.prerelease !== true && (bundleName === null || r.tag_name.startsWith(bundleName))
      );
      if (matchingReleases.length === 0) {
        // If no matching releases found, try without the bundle name filter
        // This is a fallback for cases where the bundle name extraction might not work
        const allReleases = releases.filter((r) => r.draft !== true && r.prerelease !== true);
        if (allReleases.length === 0) {
          return null;
        }
        // Use the first non-draft, non-prerelease release
        release = allReleases[0];
      } else {
        // Extract versions and sort by semantic version
        const withVersions = matchingReleases
          .map((r) => ({ release: r, version: extractSemver(r.tag_name) }))
          .filter((item) => item.version !== null) as { release: GitHubRelease; version: string }[];
        if (withVersions.length === 0) {
          // Fallback to first matching release if no versions found
          release = matchingReleases[0];
        } else {
          // Sort by semantic version (descending)
          withVersions.sort((a, b) => {
            const partsA = a.version.split('.').map(Number);
            const partsB = b.version.split('.').map(Number);
            for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
              const partA = partsA[i] ?? 0;
              const partB = partsB[i] ?? 0;
              if (partA !== partB) {
                return partB - partA; // Descending order
              }
            }
            return 0;
          });
          release = withVersions[0].release;
        }
      }
    } else {
      release = releases.find((r) => (bundleName === null || r.tag_name.startsWith(bundleName)) && extractSemver(r.tag_name) === wantVersion);
    }
    if (release === undefined) {
      return null;
    }
    // I-003: asset names also follow multiple conventions:
    //   "bundle.zip"             (extension default)
    //   "<bundle-id>.bundle.zip" (Amadeus convention)
    //   "*.bundle.zip"           (any *.bundle.zip — final fallback)
    // The caller may override via opts.assetName; otherwise we
    // attempt the conventions in order.
    const candidates = this.assetCandidates(spec.bundleId);
    // eslint-disable-next-line @typescript-eslint/naming-convention -- browser_download_url is from GitHub API
    let asset: { name: string; browser_download_url: string; url?: string } | undefined;
    for (const candidate of candidates) {
      asset = candidate === '*.bundle.zip' ? release.assets.find((a) => a.name.endsWith('.bundle.zip')) : release.assets.find((a) => a.name === candidate);
      if (asset !== undefined) {
        break;
      }
    }
    if (asset === undefined) {
      return null;
    }
    const sourceId = generateSourceId('github', `https://github.com/${this.opts.repoSlug}`);
    const tag = extractSemver(release.tag_name) ?? release.tag_name.replace(/^v/, '');
    return {
      ref: {
        sourceId,
        sourceType: 'github',
        bundleId: spec.bundleId,
        bundleVersion: tag,
        installed: false
      },
      // Prefer the API URL when available — it accepts Bearer
      // tokens for private repos (the browser_download_url at
      // github.com 404s on private assets even with a token).
      // Falls back to browser_download_url for public assets and
      // for tests using mock fixtures without `url`.
      downloadUrl: asset.url ?? asset.browser_download_url
    };
  }

  /**
   * Build the asset-name candidate list per I-003.
   * @param bundleId
   */
  private assetCandidates(bundleId: string): string[] {
    if (this.opts.assetName !== undefined) {
      return [this.opts.assetName];
    }
    return ['bundle.zip', `${bundleId}.bundle.zip`, '*.bundle.zip'];
  }

  /**
   * GET /repos/{owner}/{repo}/releases. Cached per resolver instance.
   * Handles GitHub repository redirects (e.g., renames) by following
   * the redirect and updating the repoSlug to the final resolved name.
   * @returns Releases array (newest first per GitHub default ordering).
   */
  private async listReleases(): Promise<GitHubRelease[]> {
    if (this.cachedReleases !== null) {
      return this.cachedReleases;
    }
    const url = `${this.apiBase()}/repos/${this.opts.repoSlug}/releases`;
    const headers = await this.authHeaders();
    headers.Accept = 'application/vnd.github+json';
    headers['X-GitHub-Api-Version'] = '2022-11-28';
    const res = await this.opts.http.fetch({ url, headers });
    if (res.statusCode === 404) {
      this.cachedReleases = [];
      return [];
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(
        `GitHub API ${String(res.statusCode)} for ${url}; body: ${truncate(decode(res.body), 200)}`
      );
    }
    // If the request was redirected, update the repoSlug to match the final repository name
    // This handles repository renames (e.g., "collect" -> "collection")
    if (res.finalUrl && res.finalUrl !== url) {
      const finalRepoSlug = res.finalUrl.match(/\/repos\/([^/]+\/[^/]+)\/releases/)?.[1];
      if (finalRepoSlug && finalRepoSlug !== this.opts.repoSlug) {
        // Update the repoSlug to the final resolved name
        (this.opts as any).repoSlug = finalRepoSlug;
      }
    }
    const text = decode(res.body);
    const parsed = JSON.parse(text) as GitHubRelease[];
    this.cachedReleases = parsed;
    return parsed;
  }

  /** Build the Authorization header set, deferring to the token provider. */
  private async authHeaders(): Promise<Record<string, string>> {
    const host = new URL(this.apiBase()).hostname;
    const token = await this.opts.tokens.getToken(host);
    return token === null ? {} : { Authorization: `Bearer ${token}` };
  }

  /** Resolve the API base for this resolver. */
  private apiBase(): string {
    return this.opts.apiBase ?? 'https://api.github.com';
  }
}

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

const truncate = (s: string, n: number): string =>
  s.length > n ? `${s.slice(0, n)}…` : s;

/**
 * Extract the semver portion from a release tag, handling all four
 * conventions documented in I-004. Returns `null` when no semver
 * pattern is found (caller decides whether to fall back).
 *
 * Examples:
 *   "v1.2.3"                   -> "1.2.3"
 *   "1.2.3"                    -> "1.2.3"
 *   "1.2.3-rc.1"               -> "1.2.3-rc.1"
 *   "dsre-git-skillset-v0.1.0" -> "0.1.0"
 *   "my-bundle-1.0.0"          -> "1.0.0"
 *   "release"                  -> null
 * @param tag Release tag.
 * @returns Bare semver or null.
 */
export const extractSemver = (tag: string): string | null => {
  const m = /(?:^|-)v?(\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?)$/.exec(tag);
  return m === null ? null : m[1];
};

/**
 * Decompose a bundle ID into its components: source (owner-repo), collection, and version.
 * This makes the mechanism resilient to repository renames by separating the collection name
 * from the repository name.
 * @param bundleId Bundle ID to decompose.
 * @param repoSlug Repository slug (e.g., "Amadeus-xDLC/genai.clean-code-in-the-cloud-skills-collection").
 * @returns Object with source, collection, and version components.
 */
const decomposeBundleId = (bundleId: string, repoSlug: string): { source: string | null; collection: string | null; version: string | null } => {
  // Amadeus convention: the bundle ID format is {owner}-{repo}-{collection}-{version}
  // The repo may contain dots (e.g., "genai.clean-code-in-the-cloud-skills-collection")
  // We need to extract the collection name by removing the repo prefix from the bundle ID
  // Examples:
  //   "Amadeus-xDLC-genai.clean-code-in-the-cloud-skills-collection-amadeus-microservice-coding-guidebook-v1.0.1" -> collection: "amadeus-microservice-coding-guidebook", version: "v1.0.1"
  //   "Amadeus-xDLC-genai.clean-code-in-the-cloud-skills-collection-amadeus-microservice-coding-guidebook" -> collection: "amadeus-microservice-coding-guidebook", version: null
  //   "Amadeus-xDLC-genai.clean-code-in-the-cloud-skills-collection-skubedocs" -> collection: "skubedocs", version: null

  // First, extract the version suffix if present
  const versionPattern = /-v?\d{1,3}\.\d{1,3}\.\d{1,3}(?:-[a-zA-Z0-9._-]{1,50})?$/;
  const versionMatch = bundleId.match(versionPattern);
  const version = versionMatch ? versionMatch[0] : null;
  const withoutVersion = bundleId.replace(versionPattern, '');

  // Convert repoSlug to bundle ID format (replace '/' with '-')
  const repoPrefix = repoSlug.replace('/', '-');

  // The bundle ID format is {owner}-{repo}-{collection}
  // Remove the repo prefix from the bundle ID to get the collection
  if (withoutVersion.startsWith(repoPrefix + '-')) {
    const collection = withoutVersion.slice(repoPrefix.length + 1);
    const source = withoutVersion.slice(0, repoPrefix.length);
    return { source, collection, version };
  }

  // Fallback: if the bundle ID doesn't start with the repo prefix,
  // try to extract the collection by finding the last segment after the last hyphen
  const lastHyphenIndex = withoutVersion.lastIndexOf('-');
  if (lastHyphenIndex !== -1) {
    const collection = withoutVersion.slice(lastHyphenIndex + 1);
    const source = withoutVersion.slice(0, lastHyphenIndex);
    return { source, collection, version };
  }

  // Last resort: return null
  return { source: null, collection: null, version };
};
