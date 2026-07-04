/**
 * Narrow, interface-segregated slices of a registry orchestrator's
 * (the extension's `RegistryManager`, eventually `app`'s own registry
 * use-cases) surface — just enough for the update-checking/auto-update
 * use cases to depend on, without depending on the full orchestrator
 * (which also owns discovery, install, profile management, ...) or
 * risking a circular dependency with it.
 *
 * Ported from `src/services/auto-update-service.ts`'s local
 * `BundleOperations`/`SourceOperations` interfaces (kept field-for-field
 * identical — the extension's production wiring in `extension.ts`
 * already constructs plain object literals satisfying exactly this
 * shape) plus a new `UpdateRegistryReader` for `UpdateChecker`'s
 * slightly different, read-only needs.
 * @module ports/registry-operations
 */
import type {
  Bundle,
  BundleUpdate,
} from '../domain/bundle/types';
import type {
  InstallationScope,
  InstalledBundle,
} from '../domain/install/types';
import type {
  RegistrySource,
} from '../domain/source/types';

/**
 * Bundle-level mutation/query operations needed to perform and verify an
 * update (and roll it back on failure).
 */
export interface BundleOperations {
  updateBundle(bundleId: string, version?: string): Promise<void>;
  listInstalledBundles(): Promise<InstalledBundle[]>;
  getBundleDetails(bundleId: string): Promise<Bundle>;
}

/**
 * Source synchronization operations needed before trusting a source's
 * cached bundle data for an update.
 */
export interface SourceOperations {
  listSources(): Promise<RegistrySource[]>;
  syncSource(sourceId: string): Promise<void>;
}

/**
 * The read-only registry surface `UpdateChecker` needs: sync sources,
 * compare installed vs. latest versions, and enrich the result with
 * per-bundle metadata.
 */
export interface UpdateRegistryReader extends SourceOperations {
  getBundleDetails(bundleId: string): Promise<Bundle>;
  checkUpdates(): Promise<BundleUpdate[]>;
}

/**
 * The read-only registry surface needed to detect raw version
 * differences between each installed bundle and its source: resolve a
 * bundle's latest details, list sources for cross-referencing, and read
 * installation records (a single scope, or across scopes).
 *
 * Deliberately NOT `extends UpdateRegistryReader`/`SourceOperations`:
 * `UpdateRegistryReader.checkUpdates` is exactly the method this port's
 * consumer (`app`'s `detectBundleUpdates`) computes, so requiring it
 * here would be self-referential, and raw update-detection never calls
 * `syncSource`. The overlap with `getBundleDetails`/`listSources` is
 * intentional, narrow, per-consumer duplication (interface segregation)
 * rather than inheritance.
 */
export interface UpdateDetectionReader {
  getBundleDetails(bundleId: string): Promise<Bundle>;
  listSources(): Promise<RegistrySource[]>;
  getInstalledBundles(scope?: InstallationScope): Promise<InstalledBundle[]>;
  getInstalledBundle(bundleId: string, scope: InstallationScope): Promise<InstalledBundle | undefined>;
}
