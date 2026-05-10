/**
 * Phase 6 — Registry-config storage layer.
 *
 * User-level persistence for hubs, profile activations, and the
 * active-hub pointer. Distinct from `lib/src/registry/` (which is
 * a public-API barrel for an unrelated namespace).
 * @module registry-config
 */
export type { UserConfigPaths } from './user-config-paths';
export { resolveUserConfigPaths } from './user-config-paths';
export type { HubMetaSidecar, SavedHub } from '../infra/stores/yaml-hub-store';
export { HubStore } from '../infra/stores/yaml-hub-store';
export { ActiveHubStore } from '../infra/stores/active-hub-store';
export { ProfileActivationStore } from '../infra/stores/profile-activation-store';
export type { HubResolver, ResolvedHub } from './hub-resolver';
export {
  CompositeHubResolver,
  GitHubHubResolver,
  LocalHubResolver,
  UrlHubResolver,
} from './hub-resolver';
export type { HubInfo } from './hub-manager';
export { HubManager } from './hub-manager';
export type { ActivationInput, ActivationOutcome, ProfileActivatorDeps } from './profile-activator';
export { ProfileActivator } from './profile-activator';
