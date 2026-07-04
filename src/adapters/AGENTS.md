# Adapter Implementation Guide

## Purpose

Adapters provide a unified interface for prompt bundle sources (GitHub, Local, Awesome Copilot, APM, Skills, and their local variants).

## Adding a New Adapter

1. Copy an existing adapter (e.g., `github-adapter.ts`)
2. Extend `RepositoryAdapter` (see `repository-adapter.ts`) — it implements shared auth/header logic
3. Register in `RegistryManager` via `RepositoryAdapterFactory.register('type', AdapterClass)`

## Interface

`IRepositoryAdapter` (defined in `src/adapters/repository-adapter.ts`):

```typescript
interface IRepositoryAdapter {
  readonly type: string;
  readonly source: RegistrySource;

  fetchBundles(): Promise<Bundle[]>;
  downloadBundle(bundle: Bundle): Promise<Buffer>;
  fetchMetadata(): Promise<SourceMetadata>;
  validate(): Promise<ValidationResult>;
  requiresAuthentication(): boolean;
  getManifestUrl(bundleId: string, version?: string): string;
  getDownloadUrl(bundleId: string, version?: string): string;
  forceAuthentication?(): Promise<void>;   // optional
}
```

- `downloadBundle` always returns a `Buffer` — whether the source provides pre-packaged ZIPs (GitHub) or builds them dynamically (Awesome Copilot, Local).
- `getDownloadUrl` / `getManifestUrl` return `string` URLs — used for UI display and debug links, not for the actual download (which goes through `downloadBundle`).
- `validate` returns a `ValidationResult` (not a boolean) — contains error details for user-facing diagnostics.

## Authentication Chain (GitHub)

Resolved in order:
1. Explicit `token` on `RegistrySource`
2. VS Code GitHub authentication session (`vscode.authentication.getSession('github', ...)`)
3. GitHub CLI (`gh auth token`)
4. No auth (public repos only)

Each of `github-adapter.ts`/`awesome-copilot-adapter.ts`/`apm-adapter.ts`/`skills-adapter.ts` still hand-rolls this exact chain inline today. `@ai-primitives-hub/core`'s `TokenProvider` port (`getToken(host): Promise<string | undefined>`) plus `@ai-primitives-hub/infra`'s `GhCliTokenProvider`/`StaticTokenProvider`/`CompositeTokenProvider` and this extension's own `vscode-session-token-provider.ts` (`VsCodeSessionTokenProvider`, wrapping step 2 - only the extension host may import `vscode`) now exist as the reusable building blocks for collapsing all four copies onto one `CompositeTokenProvider([explicit, vsCodeSession, ghCli])` chain, but no adapter has been switched over yet - that's part of the larger adapter-unification cutover (migration plan §7.5, Phase 4 item 3).

## Existing Adapters

| File | Type |
|------|------|
| `github-adapter.ts` | Remote GitHub repo releases |
| `awesome-copilot-adapter.ts` | Awesome Copilot repo (dynamic bundle assembly) |
| `apm-adapter.ts` | Remote APM registry |
| `skills-adapter.ts` | Remote Skills source |
| `local-adapter.ts` | Local filesystem bundles |
| `local-apm-adapter.ts` | Local APM registry |
| `local-awesome-copilot-adapter.ts` | Local Awesome Copilot clone |
| `local-skills-adapter.ts` | Local Skills source |

## Checklist

- [ ] Extends `RepositoryAdapter`
- [ ] Implements all required `IRepositoryAdapter` methods
- [ ] Returns `Buffer` from `downloadBundle`
- [ ] Returns `ValidationResult` from `validate` with actionable error messages
- [ ] Handles authentication via inherited helpers where possible
- [ ] Registered in `RepositoryAdapterFactory`
- [ ] Has corresponding test file in `test/adapters/`
