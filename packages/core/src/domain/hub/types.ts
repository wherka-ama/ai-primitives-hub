/**
 * Domain layer — Hub types.
 *
 * Mirrors the production shape at `src/types/hub.ts` so the extension's
 * `HubManager` can eventually delegate here with zero field-mapping
 * (migration plan §7.5).
 * @module domain/hub/types
 */
import type {
  Profile,
} from '../registry/types';
import type {
  RegistrySource,
} from '../source/types';

/**
 * Reference to a hub's location.
 */
export interface HubReference {
  type: 'github' | 'local' | 'url';
  location: string;
  /** Git ref for GitHub sources (branch, tag, or commit). */
  ref?: string;
  autoSync?: boolean;
}

/**
 * Elastic Search telemetry configuration for a hub. Authentication is
 * handled by the es-telemetry-proxy — no credentials configured here.
 */
export interface ElasticSearchConfig {
  /** Elastic Search proxy URL, e.g. `https://es-proxy.internal:8080`. */
  node: string;
  /** Custom index prefix (default: `ai-primitives-hub-telemetry`). */
  indexPrefix?: string;
}

/**
 * A source, as provisioned by a hub.
 */
export interface HubSource extends RegistrySource {
  enabled: boolean;
  /** Higher priority wins on conflict. */
  priority: number;
}

/**
 * A bundle reference within a hub-provided profile.
 */
export interface HubProfileBundle {
  id: string;
  version: string;
  source: string;
  required: boolean;
}

/**
 * A profile, as provisioned by a hub.
 */
export interface HubProfile extends Profile {
  bundles: HubProfileBundle[];
  /** Path segments for nested profile organization in UI trees. */
  path?: string[];
}

export interface HubMetadata {
  name: string;
  description: string;
  maintainer: string;
  updatedAt: string;
  /** `sha256:<hash>` or `sha512:<hash>`. */
  checksum?: string;
}

export interface RegistryConfiguration {
  autoSync?: boolean;
  syncInterval?: number;
  /** Enforce profile bundles strictly (no ad-hoc extras). */
  strictMode?: boolean;
}

/**
 * Parsed hub configuration.
 */
export interface HubConfig {
  version: string;
  metadata: HubMetadata;
  sources: HubSource[];
  profiles: HubProfile[];
  configuration?: RegistryConfiguration;
  telemetry?: {
    elasticSearch?: ElasticSearchConfig;
  };
}

export interface ProfileActivationState {
  hubId: string;
  profileId: string;
  activatedAt: string;
  /** @deprecated Kept for backward compatibility; prefer `syncedBundleVersions`. */
  syncedBundles: string[];
  syncedBundleVersions?: Record<string, string>;
}

export interface ProfileActivationOptions {
  installBundles: boolean;
}

export interface ProfileActivationResult {
  success: boolean;
  hubId: string;
  profileId: string;
  resolvedBundles: { bundle: HubProfileBundle; url: string }[];
  error?: string;
}

export interface ProfileDeactivationResult {
  success: boolean;
  hubId: string;
  profileId: string;
  removedBundles?: string[];
  error?: string;
}

export interface ProfileChanges {
  bundlesAdded?: HubProfileBundle[];
  bundlesRemoved?: string[];
  bundlesUpdated?: {
    id: string;
    oldVersion: string;
    newVersion: string;
  }[];
  metadataChanged?: {
    name?: boolean;
    description?: boolean;
    icon?: boolean;
  };
}

export interface DialogOption {
  label: string;
  description?: string;
  action: 'sync' | 'review' | 'cancel';
}

export interface ConflictResolutionDialog {
  title: string;
  message?: string;
  options: DialogOption[];
}
