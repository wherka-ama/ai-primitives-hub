/**
 * @prompt-registry/cli
 * 
 * CLI workspace for Prompt Registry - provides CLI framework, application layer,
 * and infrastructure implementations for command-line usage.
 * 
 * Re-exports from legacy @prompt-registry/collection-scripts package.
 * This workspace includes CLI tools, use cases, and infrastructure implementations.
 */

// Re-export application layer (use cases for collection, harvest, install, registry, search)
export * as app from '@prompt-registry/collection-scripts/app';

// Re-export CLI framework and commands
export * as cli from '@prompt-registry/collection-scripts';

// Re-export infrastructure implementations (downloaders, extractors, stores, etc.)
export * as infra from '@prompt-registry/collection-scripts';

// Re-export domain types (needed for CLI operations)
export * as domain from '@prompt-registry/collection-scripts/domain';

// Re-export port interfaces (needed for infrastructure)
export * as ports from '@prompt-registry/collection-scripts/ports';
