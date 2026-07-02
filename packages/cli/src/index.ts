/**
 * The `@ai-primitives-hub/cli` package — placeholder entry point.
 *
 * Clipanion-based commands land here across Phase 5 of the migration plan
 * (see .tmp/ai-primitives-hub-next-migration-plan.md §7.6). This package
 * must stay a thin delivery adapter: argument parsing + calling into `app`
 * + formatting output, never business logic. Planned module boundaries:
 * commands/, framework/, doctor/.
 *
 * This placeholder exists only to prove the package/build/test wiring
 * (TypeScript project references, pnpm workspace resolution, Vitest)
 * end-to-end before any real CLI code is written. Replace it as Phase 5
 * lands.
 */
export {
  APP_PACKAGE_READY as CLI_PACKAGE_READY,
} from '@ai-primitives-hub/app';
