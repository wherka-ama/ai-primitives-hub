/**
 * The `@ai-primitives-hub/app` package — placeholder entry point.
 *
 * Use-case orchestration (install/uninstall, registry, discovery/search,
 * multi-target transforms) lands here across Phase 4 of the migration plan
 * (see .tmp/ai-primitives-hub-next-migration-plan.md §7.5). Planned module
 * boundaries: install/, registry/, discovery/, search/, transform/
 * (transform/transformers/ for per-target content transforms). Also serves
 * as the public SDK surface (§8 decision 2) until a standalone
 * `@ai-primitives-hub/sdk` package has a real consumer.
 *
 * This placeholder exists only to prove the package/build/test wiring
 * (TypeScript project references, pnpm workspace resolution, Vitest)
 * end-to-end before any real orchestration code is written. Replace it as
 * Phase 4 lands.
 */
export {
  INFRA_PACKAGE_READY as APP_PACKAGE_READY,
} from '@ai-primitives-hub/infra';
