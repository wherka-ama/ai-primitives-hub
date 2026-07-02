/**
 * The `@ai-primitives-hub/infra` package — placeholder entry point.
 *
 * Adapters, harvest, search, and per-target writers land here across
 * Phase 3 of the migration plan (see
 * .tmp/ai-primitives-hub-next-migration-plan.md §7.4). Planned module
 * boundaries: adapters/, harvest/, search/, writers/, stores/, scaffolding/,
 * fs/, http/.
 *
 * This placeholder exists only to prove the package/build/test wiring
 * (TypeScript project references, pnpm workspace resolution, Vitest)
 * end-to-end before any real adapter code is written. Replace it as
 * Phase 3 lands.
 */
export {
  CORE_PACKAGE_READY as INFRA_PACKAGE_READY,
} from '@ai-primitives-hub/core';
