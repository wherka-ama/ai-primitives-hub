/**
 * Domain layer — Primitive types.
 *
 * New in `ai-primitives-hub-next` (no equivalent exists on `main` today):
 * a `Primitive` is a single harvested, searchable unit inside a bundle —
 * one prompt, one instruction file, one agent, etc. Needed by both
 * `infra/search` (Phase 3) and `app/discovery` (Phase 4) per migration plan
 * §8 decision 4. Adapted from the reference branch's design, flattened
 * (no `BundleRef` nesting) since nothing in Phase 2 needs that structure
 * yet — `sourceId`/`bundleId`/`bundleVersion` are plain fields until
 * Phase 3's harvest subsystem shows a real need for something richer.
 *
 * `tags`, `kind`, and `sourceId` together are the facets a search/browse
 * UI filters on — there is no separate "facets" bag; faceting is just
 * grouping/filtering by these existing fields.
 * @module domain/primitive/types
 */

export const PRIMITIVE_KINDS = [
  'prompt',
  'instruction',
  'chat-mode',
  'agent',
  'skill',
  'plugin',
  'hook',
  'mcp-server'
] as const;

export type PrimitiveKind = typeof PRIMITIVE_KINDS[number];

/**
 * Type guard for `PrimitiveKind`.
 * @param value - Candidate value.
 */
export function isPrimitiveKind(value: unknown): value is PrimitiveKind {
  return typeof value === 'string' && (PRIMITIVE_KINDS as readonly string[]).includes(value);
}

/**
 * A single harvested, searchable primitive.
 */
export interface Primitive {
  /** Stable identifier, typically derived from `bundleId` + `path`. */
  id: string;
  kind: PrimitiveKind;
  title: string;
  description: string;
  /** Path relative to the bundle root. */
  path: string;
  tags: string[];
  sourceId: string;
  bundleId: string;
  bundleVersion: string;
  authors?: string[];
  /** Glob the primitive applies to, for instruction-like kinds. */
  applyTo?: string;
  /** Declared tool dependencies, for agent/skill-like kinds. */
  tools?: string[];
  /** Preferred/required model, when declared. */
  model?: string;
  /** Short excerpt of the primitive's body, for search result previews. */
  bodyPreview: string;
  /** Content hash, for change detection between harvests. */
  contentHash: string;
  rating?: number;
  updatedAt?: string;
}
