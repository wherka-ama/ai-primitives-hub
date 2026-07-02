/**
 * Clock port — time abstraction for deterministic testing.
 *
 * Code that needs "now" (timestamps on `InstalledBundle.installedAt`,
 * lockfile `generatedAt`, cache TTLs, ...) depends on this interface
 * instead of calling `Date.now()`/`new Date()` directly, so tests can
 * inject a fixed or controllable clock. The production adapter
 * (`@ai-primitives-hub/infra`, Phase 3) simply wraps the real `Date`.
 * @module ports/clock
 */

/**
 * Minimal clock surface.
 */
export interface Clock {
  /** Current time, as epoch milliseconds. */
  now(): number;
  /** Current time, as an ISO-8601 string — the format persisted throughout `core`'s domain types. */
  nowIso(): string;
}
