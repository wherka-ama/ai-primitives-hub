/**
 * Domain layer — Bundle types.
 *
 * `Bundle` is the catalog/runtime entry as fetched from a source adapter and
 * shown to users (Marketplace, `cli index search`, etc.). It is distinct
 * from `Collection` (`../collection/types.ts`), which is the pre-build,
 * author-facing shape of a `deployment-manifest.yml`.
 *
 * Mirrors the shape already in production at
 * `src/types/registry.ts` (`Bundle`, `BundleDependency`, `BundleUpdate`) so
 * that the extension's `RegistryManager`/`BundleInstaller` can eventually
 * delegate to this type with zero field-mapping (see migration plan §7.5).
 * @module domain/bundle/types
 */

/**
 * Bundle metadata as surfaced by a source adapter.
 */
export interface Bundle {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  sourceId: string;
  environments: string[];
  tags: string[];
  downloads?: number;
  rating?: number;
  lastUpdated: string;
  size: string;
  dependencies: BundleDependency[];
  homepage?: string;
  repository?: string;
  license: string;
  manifestUrl: string;
  downloadUrl: string;
  /** True if the bundle was surfaced via a curated hub rather than a raw source. */
  isCurated?: boolean;
  /** Name of the curated hub, when `isCurated` is true. */
  hubName?: string;
  checksum?: {
    algorithm: string;
    hash: string;
  };
}

/**
 * A dependency a bundle declares on another bundle.
 */
export interface BundleDependency {
  bundleId: string;
  versionRange: string;
  optional: boolean;
}

/**
 * Result of comparing an installed bundle's version against its source.
 */
export interface BundleUpdate {
  bundleId: string;
  currentVersion: string;
  latestVersion: string;
  changelog?: string;
}
