/**
 * `@prompt-registry/collection-scripts`
 *
 * Shared scripts for building, validating, and publishing Copilot prompt collections.
 * @module @prompt-registry/collection-scripts
 */

// Public API - curated exports for external consumers
export * from './public';

// Legacy exports for backward compatibility (Phase 1 Step 1.9: will be phased out)
export type {
  ValidationResult,
  ObjectValidationResult,
  FileValidationResult,
  AllCollectionsResult,
  CollectionItem,
  Collection,
  ValidationRules,
  VersionInfo,
  BundleInfo,
} from './types';

export {
  VALIDATION_RULES,
  loadItemKindsFromSchema,
  validateCollectionId,
  validateVersion,
  validateItemKind,
  normalizeRepoRelativePath,
  isSafeRepoRelativePath,
  validateCollectionObject,
  validateCollectionFile,
  validateAllCollections,
  generateMarkdown,
} from './validate';

export {
  listCollectionFiles,
  readCollection,
  resolveCollectionItemPaths,
} from './collections';

export { generateBundleId } from './bundle-id';

export type {
  SkillMetadata,
  SkillValidationResult,
  AllSkillsValidationResult,
} from './skills';

export {
  SKILL_NAME_MAX_LENGTH,
  SKILL_DESCRIPTION_MIN_LENGTH,
  SKILL_DESCRIPTION_MAX_LENGTH,
  MAX_ASSET_SIZE,
  parseFrontmatter,
  validateSkillName,
  validateSkillDescription,
  validateSkillFolder,
  validateAllSkills,
  generateSkillContent,
  createSkill,
} from './skills';

// Phase 3: Domain layer exports (already exported via public API and namespace exports)
export * as domain from './domain';
export { PrimitiveIndex } from './infra/search/primitive-index';
export { tokenize, stem } from './infra/search/tokenizer';
export {
  Bm25Engine,
  type Bm25Doc,
  type Bm25Stats,
  type FieldTokens,
} from './infra/search/bm25-engine';
export type {
  SearchHit,
  SearchResult,
  SearchQuery,
  MatchExplanation,
} from './infra/search/types';

// Hub harvester public API — lets the extension (or any other caller)
// run the same harvest pipeline the CLI does, with an injected token.
export {
  BlobCache,
  computeGitBlobSha,
} from './infra/github/blob-cache';
export { AssetFetcher } from './infra/github/asset-fetcher';
export { EtagStore } from './infra/github/etag-store';
export {
  GitHubClient,
  type FetchLike as GitHubFetchLike,
  GitHubApiError,
} from './infra/github/client';
export { GitHubSingleBundleProvider } from './infra/harvest/bundle-providers/github-bundle-provider';
export { AwesomeCopilotPluginBundleProvider } from './infra/harvest/bundle-providers/plugin-bundle-provider';
export {
  derivePluginItems,
  extractPluginMcpServers,
  parsePluginManifest,
  resolvePluginItemEntryPath,
} from './infra/harvest/plugin-manifest';
export type {
  PluginItem,
  PluginItemKind,
  PluginManifest,
} from './domain';
export {
  enumeratePluginRepo,
  type EnumeratePluginRepoResult,
  type PluginDiscovery,
} from './infra/harvest/plugin-tree-enumerator';
export { parseExtraSource } from './infra/harvest/extra-source';
export {
  defaultCacheDir,
  defaultHubCacheDir,
  defaultIndexFile,
  defaultProgressFile,
  type DefaultPathEnv,
} from './infra/harvest/default-paths';

// Quality tooling: pattern-based relevance eval + search microbench.
export {
  matchPattern,
  runPatternEval,
  renderPatternReportMarkdown,
  type PatternCase,
  type PatternReport,
  type PatternCaseReport,
  type RelevancePattern,
} from './infra/search/eval-pattern';
export {
  runBench,
  renderBenchReportMarkdown,
  type BenchCase,
  type BenchCaseResult,
  type BenchReport,
} from './infra/search/bench';
export {
  parseHubConfig,
  normalizeRepoFromUrl,
} from './infra/harvest/hub-config-parser';
export type { HubSourceSpec } from './domain';
export {
  HubHarvester,
  type HubHarvesterOptions,
  type HubHarvestResult,
  type HubHarvestEvent,
} from './infra/harvest/hub-harvester';
export {
  computeIndexHmac,
  saveIndexWithIntegrity,
  verifyIndexIntegrity,
  type IntegritySecret,
} from './infra/harvest/integrity';
export {
  HarvestProgressLog,
  type ProgressSummary,
} from './infra/harvest/progress-log';
export {
  redactToken,
  resolveGithubToken,
  type ResolvedToken,
} from './infra/harvest/token-provider';
export {
  enumerateRepoTree,
  isPrimitiveCandidatePath,
  resolveCommitSha,
} from './infra/harvest/tree-enumerator';
export { harvest, harvestBundle } from './infra/harvest/harvester';
export {
  harvestHub,
  type HubHarvestPipelineOptions,
  type HubHarvestPipelineResult,
} from './infra/harvest/hub-harvester';
export {
  parseFrontmatter as parsePrimitiveFrontmatter,
  extractFromFile,
  extractMcpPrimitives,
  computePrimitiveId,
  detectKindFromPath,
} from './infra/harvest/extractor';
export { saveIndex, loadIndex, tryLoadIndex } from './infra/stores/json-index-store';
export {
  exportShortlistAsProfile,
} from './app/search/export-profile';
export type {
  HubProfile,
  HubProfileBundleRef,
  Collection as PrimitiveIndexCollection,
  CollectionItem as PrimitiveIndexCollectionItem,
  ExportProfileOptions,
  ProfileExport,
} from './app/search/export-profile';
export { LocalFolderBundleProvider } from './infra/harvest/bundle-providers/local-folder';
