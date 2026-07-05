/**
 * HubManager (app) — CRUD + fetch/validate orchestration for hubs.
 *
 * Stage 1 of the staged strangler-fig port of the extension's
 * `src/services/hub-manager.ts` (migration plan §7.5, HubManager
 * item): import / list / get / getActive / setActive / sync / delete
 * a hub, plus availability probing. Deliberately excludes (ported in
 * later stages):
 *   - source-loading/dedup into `RegistryManager` (Stage 2 — landed, see `load-hub-sources.ts`)
 *   - favorites (Stage 3)
 *   - profile activation/deactivation + conflict detection (Stage 4)
 *   - the sync scheduler (Stage 5)
 *
 * Framework-agnostic by design (no `vscode.*`): the extension's own
 * `HubManager` fires its existing `vscode.EventEmitter`-backed events
 * itself, around calls into this class, rather than this class owning
 * events (unlike the extension, this class has no listeners of its
 * own to serve — it is also usable standalone from a future CLI).
 * @module registry/hub-manager
 */
import type {
  HubConfig,
  HubReference,
  ValidationResult,
} from '@ai-primitives-hub/core';
import {
  sanitizeHubId,
} from '@ai-primitives-hub/core';
import type {
  ActiveHubStore,
  HubResolver,
  HubStore,
  HubStoreMetadata,
  LoadHubResult,
} from '@ai-primitives-hub/infra';

export interface HubInfo {
  id: string;
  config: HubConfig;
  reference: HubReference;
}

export interface HubListItem {
  id: string;
  name: string;
  description: string;
  reference: HubReference;
}

export interface HubDetailInfo extends HubInfo {
  metadata: {
    name: string;
    description: string;
    lastModified: string;
    size: number;
  };
}

/**
 * Dependencies for the app-layer `HubManager`.
 */
export interface HubManagerDeps {
  store: HubStore;
  activeStore: ActiveHubStore;
  resolver: HubResolver;
  /**
   * Fully-composed validator (schema + runtime). Injected rather than
   * built here since schema/AJV validation stays delivery-context
   * code (the extension's `SchemaValidator`) for now.
   */
  validateConfig: (config: HubConfig) => Promise<ValidationResult>;
}

/**
 * Lib-side counterpart of the extension's `HubManager`, covering the
 * CRUD + fetch/validate surface (Stage 1 of the staged port).
 */
export class HubManager {
  /**
   * Construct a HubManager instance.
   * @param deps Store/resolver/validator dependencies.
   */
  public constructor(private readonly deps: HubManagerDeps) {}

  private generateHubId(config: HubConfig): string {
    let id = config.metadata.name
      .toLowerCase()
      .replaceAll(/[^a-z0-9-]/g, '-')
      .replaceAll(/-+/g, '-')
      .replaceAll(/^-|-$/g, '');

    const timestamp = Date.now().toString().slice(-6);
    id = `${id}-${timestamp}`;
    return id;
  }

  private async validateReference(reference: HubReference): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!reference.type) {
      errors.push('Reference type is required');
    }
    if (!reference.location) {
      errors.push('Reference location is required');
    }

    switch (reference.type) {
      case 'github': {
        if (!reference.location.includes('/')) {
          errors.push('Invalid GitHub location format. Expected: owner/repo');
        }
        break;
      }
      case 'url': {
        try {
          new URL(reference.location);
        } catch {
          errors.push('Invalid URL format');
        }
        break;
      }
      case 'local': {
        // Local path validation is done during fetch.
        break;
      }
      default: {
        errors.push(`Unsupported reference type: ${String(reference.type)}`);
      }
    }

    return Promise.resolve({ valid: errors.length === 0, errors, warnings: [] });
  }

  /**
   * Import a hub from its reference. Persists the config; does not
   * touch the active-hub pointer (mirrors the extension, which never
   * auto-activates on import either).
   * @param reference Hub reference (GitHub, URL, or local path).
   * @param hubId Optional explicit id (auto-generated when omitted).
   * @returns The persisted hub id.
   */
  public async importHub(reference: HubReference, hubId?: string): Promise<string> {
    const refValidation = await this.validateReference(reference);
    if (!refValidation.valid) {
      throw new Error(`Invalid reference: ${refValidation.errors.join(', ')}`);
    }

    const resolved = await this.deps.resolver.resolve(reference);

    const validation = await this.deps.validateConfig(resolved.config);
    if (!validation.valid) {
      throw new Error(`Hub validation failed: Validation error: ${validation.errors.join(', ')}`);
    }

    const id = hubId ?? this.generateHubId(resolved.config);
    sanitizeHubId(id);

    await this.deps.store.save(id, resolved.config, resolved.reference);
    return id;
  }

  /**
   * Load a hub from storage, re-validating it on the way out.
   * @param hubId Hub identifier.
   * @returns Loaded hub configuration and reference.
   */
  public async loadHub(hubId: string): Promise<LoadHubResult> {
    const result = await this.deps.store.load(hubId);

    const validation = await this.deps.validateConfig(result.config);
    if (!validation.valid) {
      throw new Error(`Hub validation failed: ${validation.errors.join(', ')}`);
    }

    return result;
  }

  /**
   * Validate a hub configuration via the injected validator.
   * @param config Hub configuration to validate.
   * @returns Validation result.
   */
  public async validateHub(config: HubConfig): Promise<ValidationResult> {
    return this.deps.validateConfig(config);
  }

  /**
   * List every hub on disk (id + name + description + reference).
   * @returns Hub list items; malformed hubs are skipped.
   */
  public async listHubs(): Promise<HubListItem[]> {
    const hubIds = await this.deps.store.list();
    const hubs: HubListItem[] = [];

    for (const id of hubIds) {
      try {
        const result = await this.deps.store.load(id);
        hubs.push({
          id,
          name: result.config.metadata.name,
          description: result.config.metadata.description,
          reference: result.reference
        });
      } catch (error) {
        // eslint-disable-next-line no-console -- matches the extension's pre-existing behavior for this diagnostic
        console.error(`Failed to load hub ${id}:`, error);
      }
    }

    return hubs;
  }

  /**
   * Delete a hub's storage entry. Callers that also need to clean up
   * dependent resources (sources/profiles/favorites tied to the hub)
   * are responsible for doing so themselves before calling this
   * (mirrors the extension's own `cleanupHubResources` split).
   * @param hubId Hub identifier to delete.
   */
  public async deleteHub(hubId: string): Promise<void> {
    await this.deps.store.remove(hubId);
  }

  /**
   * Re-fetch a hub's config from its recorded reference and persist
   * the updated version.
   * @param hubId Hub identifier to sync.
   */
  public async syncHub(hubId: string): Promise<void> {
    const existing = await this.deps.store.load(hubId);
    const resolved = await this.deps.resolver.resolve(existing.reference);

    const validation = await this.deps.validateConfig(resolved.config);
    if (!validation.valid) {
      throw new Error(`Hub validation failed after sync: ${validation.errors.join(', ')}`);
    }

    await this.deps.store.save(hubId, resolved.config, existing.reference);
  }

  /**
   * Get detailed hub information, including sidecar metadata.
   * @param hubId Hub identifier.
   * @returns Hub information.
   */
  public async getHubInfo(hubId: string): Promise<HubDetailInfo> {
    const result = await this.deps.store.load(hubId);
    const metadata: HubStoreMetadata = await this.deps.store.getMetadata(hubId);

    return {
      id: hubId,
      config: result.config,
      reference: result.reference,
      metadata: {
        name: result.config.metadata.name,
        description: result.config.metadata.description,
        lastModified: metadata.lastModified,
        size: metadata.size
      }
    };
  }

  /**
   * Probe whether a hub reference is reachable, without importing it.
   * Never throws.
   * @param reference Hub reference to verify.
   * @returns true iff the reference validates and the config fetch succeeds.
   */
  public async verifyHubAvailability(reference: HubReference): Promise<boolean> {
    try {
      const refValidation = await this.validateReference(reference);
      if (!refValidation.valid) {
        return false;
      }
      await this.deps.resolver.resolve(reference);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the id of the currently active hub.
   * @returns Active hub id, or null if none is active.
   */
  public async getActiveHubId(): Promise<string | null> {
    return this.deps.activeStore.get();
  }

  /**
   * Get the currently active hub. Auto-clears a stale pointer (one
   * referencing a hub that no longer exists) and returns null.
   * @returns Active hub info, or null if none is active.
   */
  public async getActiveHub(): Promise<HubInfo | null> {
    const activeHubId = await this.deps.activeStore.get();
    if (!activeHubId) {
      return null;
    }
    try {
      const result = await this.deps.store.load(activeHubId);
      return { id: activeHubId, config: result.config, reference: result.reference };
    } catch {
      await this.deps.activeStore.set(null);
      return null;
    }
  }

  /**
   * Get a single hub by id.
   * @param hubId Hub identifier.
   * @returns Hub info, or null when not found/malformed.
   */
  public async getHub(hubId: string): Promise<HubInfo | null> {
    try {
      const result = await this.deps.store.load(hubId);
      return { id: hubId, config: result.config, reference: result.reference };
    } catch {
      return null;
    }
  }

  /**
   * Set the active hub. Throws when the hub is not on disk (unless
   * `null` is passed to clear).
   * @param hubId Hub id or null.
   */
  public async setActiveHub(hubId: string | null): Promise<void> {
    if (hubId !== null && !(await this.deps.store.has(hubId))) {
      throw new Error(`Hub not found: ${hubId}`);
    }
    await this.deps.activeStore.set(hubId);
  }
}
