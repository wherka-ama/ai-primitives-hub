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
