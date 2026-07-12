/**
 * Repository adapter interface for different source types.
 *
 * This interface is the only survivor of the adapter-unification cutover
 * (migration plan §7.5, Phase 4 item 3, decision #10): `RegistryManager`
 * now builds adapters via `infra-adapter-factory.ts`'s `createRegistryAdapter`
 * (backed by `@ai-primitives-hub/infra`'s adapters), which still needs to
 * return something typed as this shape at the extension boundary. See
 * `src/adapters/AGENTS.md` for the full picture.
 */

import {
  Bundle,
  RegistrySource,
  SourceMetadata,
  ValidationResult,
} from '../types/registry';

/**
 * Base interface for repository adapters
 * Each source type (GitHub, Local) implements this interface
 */
export interface IRepositoryAdapter {
  /**
   * The type of repository this adapter handles
   */
  readonly type: string;

  /**
   * The source configuration
   */
  readonly source: RegistrySource;

  /**
   * Fetch list of available bundles from the source
   * @returns Promise with array of bundles
   */
  fetchBundles(): Promise<Bundle[]>;

  /**
   * Download a specific bundle
   * @param bundle Bundle to download
   * @returns Promise with buffer containing bundle data
   */
  downloadBundle(bundle: Bundle): Promise<Buffer>;

  /**
   * Fetch metadata about the source
   * @returns Promise with source metadata
   */
  fetchMetadata(): Promise<SourceMetadata>;

  /**
   * Validate that the repository is accessible
   * @returns Promise with validation result
   */
  validate(): Promise<ValidationResult>;

  /**
   * Check if source requires authentication
   * @returns True if authentication is required
   */
  requiresAuthentication(): boolean;

  /**
   * Get the raw manifest URL for a bundle
   * @param bundleId Bundle identifier
   * @param version Optional version (defaults to latest)
   * @returns Manifest URL
   */
  getManifestUrl(bundleId: string, version?: string): string;

  /**
   * Get the download URL for a bundle
   * @param bundleId Bundle identifier
   * @param version Optional version (defaults to latest)
   * @returns Download URL
   */
  getDownloadUrl(bundleId: string, version?: string): string;

  /**
   * Force re-authentication for the source
   * Useful when token expires or user wants to switch accounts
   */
  forceAuthentication?(): Promise<void>;
}
