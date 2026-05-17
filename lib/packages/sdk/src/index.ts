/**
 * @prompt-registry/sdk
 * 
 * SDK workspace for Prompt Registry - provides domain types, ports, and public API
 * for programmatic consumption without CLI infrastructure.
 * 
 * Re-exports from legacy @prompt-registry/collection-scripts package.
 * This workspace provides a minimal, focused API for extension developers.
 */

// Re-export domain types (core business entities)
export * as domain from '@prompt-registry/collection-scripts/domain';

// Re-export port interfaces (filesystem, HTTP, GitHub API, etc.)
export * as ports from '@prompt-registry/collection-scripts/ports';

// Re-export public API surface (curated exports for external use)
export * from '@prompt-registry/collection-scripts/public';
