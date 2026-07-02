/**
 * Domain layer — Bundle ID generation.
 *
 * IMPORTANT: this logic must stay in sync with `src/utils/bundleNameUtils.ts`
 * (`generateBuildScriptBundleId`) and `lib/src/bundle-id.ts`
 * (`generateBundleId`) until those call sites are migrated onto this
 * implementation (migration plan §7.5/§7.7). The format is unchanged:
 * `{owner}-{repo}-{collectionId}-v{version}`.
 * @module domain/bundle/id
 */

/**
 * Generate the canonical bundle ID for a collection.
 * @param repoSlug - Repository slug (`owner/repo` or already-hyphenated `owner-repo`).
 * @param collectionId - Collection identifier.
 * @param version - Version string, without a leading `v`.
 * @returns Canonical bundle ID, e.g. `owner-repo-my-collection-v1.0.0`.
 */
export function generateBundleId(repoSlug: string, collectionId: string, version: string): string {
  const normalizedSlug = repoSlug.replaceAll('/', '-');
  return `${normalizedSlug}-${collectionId}-v${version}`;
}

/**
 * Generate the canonical bundle ID for a GitHub release, as fetched at
 * runtime by the GitHub source adapter.
 *
 * IMPORTANT: this is a *distinct* format from {@link generateBundleId}
 * (ported from `src/utils/bundleNameUtils.ts`'s `generateGitHubBundleId`,
 * not `generateBuildScriptBundleId`) — no `v` prefix before the version,
 * and it falls back to the raw release tag when the manifest doesn't
 * declare its own collection id. Do not consolidate these two: they are
 * used by different producers (build-time collection bundler vs. the
 * runtime GitHub adapter reading whatever a release happens to contain)
 * that must keep matching their own historical ID format for
 * already-published bundles.
 * @param owner - Repository owner.
 * @param repo - Repository name.
 * @param tagName - Git tag name of the release (e.g. `v1.0.0`).
 * @param manifestId - Collection id from the release's deployment manifest, if present.
 * @param manifestVersion - Version from the release's deployment manifest, if present.
 * @returns Canonical bundle ID, e.g. `owner-repo-my-collection-1.0.0` or, lacking
 * a manifest id, `owner-repo-v1.0.0`.
 */
export function generateGitHubReleaseBundleId(
  owner: string,
  repo: string,
  tagName: string,
  manifestId?: string,
  manifestVersion?: string
): string {
  const cleanVersion = manifestVersion ?? tagName.replace(/^v/, '');
  return manifestId ? `${owner}-${repo}-${manifestId}-${cleanVersion}` : `${owner}-${repo}-${tagName}`;
}
