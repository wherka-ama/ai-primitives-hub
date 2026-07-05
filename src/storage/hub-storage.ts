/**
 * HubStorage - File-based storage for hub configurations
 * Handles persistence, caching, and file operations for hub configs
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ActiveHubStore,
  HubStore,
  NodeFileSystem,
} from '@ai-primitives-hub/infra';
import {
  HubConfig,
  HubReference,
  ProfileActivationState,
  sanitizeHubId,
} from '../types/hub';

/**
 * Hub metadata stored alongside configuration
 */
export interface HubMetadata {
  reference: HubReference;
  lastModified: Date;
  size: number;
}

/**
 * Result of loading a hub from storage
 */
export interface LoadHubResult {
  config: HubConfig;
  reference: HubReference;
}

/**
 * HubStorage manages persistent storage of hub configurations.
 *
 * Thin facade over `@ai-primitives-hub/infra`'s `HubStore` +
 * `ActiveHubStore` (migration plan §7.5, HubManager Stage 1): those
 * own the actual on-disk CRUD, this class layers an in-memory cache
 * on top (for fidelity with pre-existing behavior) plus the
 * favorites/profile-activation-state responsibilities that haven't
 * been ported yet (Stages 3/4).
 */
export class HubStorage {
  private readonly storagePath: string;
  private readonly cache: Map<string, LoadHubResult>;
  private readonly hubStore: HubStore;
  private readonly activeHubStore: ActiveHubStore;

  /**
   * Initialize hub storage
   * @param storagePath Directory path for storing hub configurations
   */
  constructor(storagePath: string) {
    if (!storagePath || storagePath.trim() === '') {
      throw new Error('Invalid storage path');
    }

    this.storagePath = path.resolve(storagePath);
    this.cache = new Map();

    // Create storage directory if it doesn't exist
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }

    const nodeFs = new NodeFileSystem();
    this.hubStore = new HubStore(this.storagePath, nodeFs);
    this.activeHubStore = new ActiveHubStore(path.join(this.storagePath, 'activeHubId.json'), nodeFs);
  }

  /**
   * Expose the underlying infra `HubStore`, e.g. for `HubManager`'s
   * app-layer delegate wiring.
   * @returns The infra HubStore backing this facade.
   */
  public getHubStore(): HubStore {
    return this.hubStore;
  }

  /**
   * Expose the underlying infra `ActiveHubStore`, e.g. for
   * `HubManager`'s app-layer delegate wiring.
   * @returns The infra ActiveHubStore backing this facade.
   */
  public getActiveHubStore(): ActiveHubStore {
    return this.activeHubStore;
  }

  /**
   * Save hub configuration to storage
   * @param hubId Unique identifier for the hub
   * @param config Hub configuration to save
   * @param reference Hub reference information
   */
  public async saveHub(hubId: string, config: HubConfig, reference: HubReference): Promise<void> {
    await this.hubStore.save(hubId, config, reference);
    this.cache.set(hubId, { config, reference });
  }

  /**
   * Load hub configuration from storage
   * @param hubId Hub identifier to load
   * @param forceReload Bypass cache and reload from disk
   * @returns Loaded hub configuration and reference
   */
  public async loadHub(hubId: string, forceReload = false): Promise<LoadHubResult> {
    if (!forceReload && this.cache.has(hubId)) {
      return this.cache.get(hubId)!;
    }

    const result = await this.hubStore.load(hubId);
    this.cache.set(hubId, result);
    return result;
  }

  /**
   * Delete hub from storage
   * @param hubId Hub identifier to delete
   */
  public async deleteHub(hubId: string): Promise<void> {
    await this.hubStore.remove(hubId);
    this.cache.delete(hubId);
  }

  /**
   * List all stored hubs
   * @returns Array of hub IDs
   */
  public async listHubs(): Promise<string[]> {
    return this.hubStore.list();
  }

  /**
   * Get hub metadata without loading full configuration
   * @param hubId Hub identifier
   * @returns Hub metadata
   */
  public async getHubMetadata(hubId: string): Promise<HubMetadata> {
    const metadata = await this.hubStore.getMetadata(hubId);
    return {
      reference: metadata.reference,
      // `lastModified` is persisted as an ISO string; kept typed as `Date`
      // here for backward compatibility with this method's pre-existing
      // (mis-typed, but never runtime-checked) public signature.
      lastModified: metadata.lastModified as unknown as Date,
      size: metadata.size
    };
  }

  /**
   * Save profile activation state
   * @param hubId
   * @param profileId
   * @param state
   */
  public async saveProfileActivationState(
    hubId: string,
    profileId: string,
    state: ProfileActivationState
  ): Promise<void> {
    const stateDir = path.join(this.storagePath, 'profile-activations');
    await fs.promises.mkdir(stateDir, { recursive: true });

    const statePath = path.join(stateDir, `${hubId}_${profileId}.json`);
    await fs.promises.writeFile(statePath, JSON.stringify(state, null, 2));
  }

  /**
   * Get profile activation state
   * @param hubId
   * @param profileId
   */
  public async getProfileActivationState(
    hubId: string,
    profileId: string
  ): Promise<ProfileActivationState | null> {
    const statePath = path.join(
      this.storagePath,
      'profile-activations',
      `${hubId}_${profileId}.json`
    );

    if (!fs.existsSync(statePath)) {
      return null;
    }

    const content = await fs.promises.readFile(statePath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Delete profile activation state
   * @param hubId
   * @param profileId
   */
  public async deleteProfileActivationState(
    hubId: string,
    profileId: string
  ): Promise<void> {
    const statePath = path.join(
      this.storagePath,
      'profile-activations',
      `${hubId}_${profileId}.json`
    );

    if (fs.existsSync(statePath)) {
      await fs.promises.unlink(statePath);
    }
  }

  /**
   * List all active profiles
   */
  public async listActiveProfiles(): Promise<ProfileActivationState[]> {
    const stateDir = path.join(this.storagePath, 'profile-activations');

    if (!fs.existsSync(stateDir)) {
      return [];
    }

    const files = await fs.promises.readdir(stateDir);
    const states: ProfileActivationState[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.promises.readFile(
          path.join(stateDir, file),
          'utf8'
        );
        states.push(JSON.parse(content));
      }
    }

    return states;
  }

  /**
   * Get active profile for a specific hub
   * @param hubId
   */
  public async getActiveProfileForHub(hubId: string): Promise<ProfileActivationState | null> {
    const allActive = await this.listActiveProfiles();
    return allActive.find((state) => state.hubId === hubId) || null;
  }

  /**
   * Set profile active flag in hub config
   * @param hubId
   * @param profileId
   * @param active
   */
  public async setProfileActiveFlag(
    hubId: string,
    profileId: string,
    active: boolean
  ): Promise<void> {
    const hubData = await this.loadHub(hubId);

    const profile = hubData.config.profiles.find((p) => p.id === profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId} in hub ${hubId}`);
    }

    profile.active = active;

    await this.saveHub(hubId, hubData.config, hubData.reference);
  }

  /**
   * Get the ID of the currently active hub
   * @returns Active hub ID or null if none set
   */
  public async getActiveHubId(): Promise<string | null> {
    return this.activeHubStore.get();
  }

  /**
   * Set the currently active hub
   * @param hubId Hub identifier to set as active (or null to clear)
   */
  public async setActiveHubId(hubId: string | null): Promise<void> {
    if (hubId === null) {
      await this.activeHubStore.set(null);
      return;
    }

    // Validate the hub exists
    sanitizeHubId(hubId);
    const hubs = await this.listHubs();
    if (!hubs.includes(hubId)) {
      throw new Error(`Cannot set active hub: hub '${hubId}' does not exist`);
    }

    await this.activeHubStore.set(hubId);
  }

  /**
   * Get favorite profiles
   * @returns Record<hubId, profileIds[]>
   */
  public async getFavoriteProfiles(): Promise<Record<string, string[]>> {
    const favoritesPath = path.join(this.storagePath, 'favorites.json');
    if (!fs.existsSync(favoritesPath)) {
      return {};
    }
    try {
      const content = await fs.promises.readFile(favoritesPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  /**
   * Save favorite profiles
   * @param favorites
   */
  public async saveFavoriteProfiles(favorites: Record<string, string[]>): Promise<void> {
    const favoritesPath = path.join(this.storagePath, 'favorites.json');
    await fs.promises.writeFile(favoritesPath, JSON.stringify(favorites, null, 2), 'utf8');
  }
}
