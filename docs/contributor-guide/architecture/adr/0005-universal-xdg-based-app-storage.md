# ADR-0005: Universal, XDG-Based Application Storage Port

**Status:** Accepted

## Context

`src/storage/registry-storage.ts` (`RegistryStorage`) and several other
extension services (`BundleInstaller`'s bundle download/staging cache,
`UserScopeService`'s bundle-manifest lookup for unsync, `PromptLoader`,
`ApmRuntimeManager`) resolve their on-disk root directly from
`vscode.ExtensionContext.globalStorageUri.fsPath` (small key/value data, e.g.
update preferences, uses `context.globalState` instead). `RegistryStorage`
specifically owns: the registry config file (sources, profiles, settings),
source/bundle caches, and installed-bundle records for `user`/`workspace`
scope. `HubManager`, `UpdateChecker`/`AutoUpdateService`, and `RegistryManager`
— all still pending strangler-fig extraction (migration plan §7.5, Phase 4
item 2) — sit directly on top of `RegistryStorage`.

`packages/infra` already independently established the right pattern for
CLI-side state, twice, coincidentally without being unified into one port:
`harvest/default-paths.ts`'s `defaultCacheDir()` (respects `XDG_CACHE_HOME`
and an `AI_PRIMITIVES_HUB_CACHE` override, falls back to
`~/.cache/ai-primitives-hub`) and `stores/layout-config-store.ts`'s
`resolveUserConfigDir()` (respects `XDG_CONFIG_HOME`, falls back to
`~/.config/ai-primitives-hub`). Both are pure, env-injectable, and have no
`vscode` dependency — exactly the target shape.

`packages/app/src/install/*` (`InstallPipeline`/`installBundle`) is already
fully agnostic: it takes an explicit `Target` (with `rootPath`) and injected
port implementations, never resolving a storage root itself. That module is
proof the pattern already works end-to-end for the install/write path; the
gap is specifically the registry/bookkeeping storage layer used by the
services Phase 4 has not yet migrated.

The `packages/cli` package has, and must keep, zero dependency on the
`vscode` module. Without an explicit decision here, the path of least
resistance when extracting `HubManager`/`RegistryManager`/`UpdateChecker`
into `app` would be to port their *logic* but leave them taking a concrete,
`vscode`-coupled storage object — silently recreating the "two parallel
domains" problem ADR-0001 exists to fix, one layer deeper (storage instead
of business logic).

## Decision

1. Add a `core` port, `AppStorage` (`packages/core/src/ports/app-storage.ts`),
   modeling the directory/file responsibilities `RegistryStorage` already
   defines (config, cache, installed-bundle records per scope, profiles,
   logs) as an interface — no `vscode`, no direct `fs` calls, matching this
   repo's existing port style (`ports/filesystem.ts`, `ports/target-writer.ts`).
2. `infra` provides the default, universal implementation — an XDG Base
   Directory-compliant `AppStorage` (`XDG_DATA_HOME`/`XDG_CONFIG_HOME`/
   `XDG_CACHE_HOME`, each falling back to `~/.local/share`, `~/.config`,
   `~/.cache` + `ai-primitives-hub` per POSIX convention). This consolidates
   the two existing ad hoc XDG resolvers under one coherent, tested module
   instead of leaving three independent XDG implementations in the codebase
   long-term. This is what the CLI uses by default, and what any future
   non-VS-Code client uses too.
3. The VS Code extension keeps its **own** adapter backed by
   `context.globalStorageUri.fsPath` (either a thin wrapper or
   `RegistryStorage` itself refactored to implement the port). This is a
   deliberate, permanent choice, not a temporary shim: real users' data
   already lives under `globalStorageUri`, and relocating it would be a
   silent, undiscoverable migration for existing installs. This mirrors the
   precedent ADR-0004 already set — don't relocate/rename identifiers real
   users' data already depends on.
4. When `HubManager`, `UpdateChecker`/`AutoUpdateService`, and
   `RegistryManager` are extracted (migration plan §7.5, Phase 4 item 2,
   remaining sub-items), their `app`-layer use-cases depend on the
   `AppStorage` **port**, not on `RegistryStorage`/`vscode.ExtensionContext`
   directly — the same pattern `install-bundle.ts` already uses for
   `BundleDownloader`/`BundleExtractor`/`TargetWriter`.
5. `LockfileManager` is explicitly **out of scope** for this decision: its
   storage (`<repo-root>/prompt-registry.lock.json`) is already
   workspace-relative and portable (constructor takes a plain
   `repositoryPath: string`), and never touches `globalStorageUri`. Likewise
   `app/install/*` is already agnostic via `Target.rootPath` + injected
   ports. Both were verified while investigating this decision and need no
   change.

## Consequences

- **Positive:** the CLI can implement `hub`/`profile`/`source`/`status`
  commands (Phase 5, §7.6 item 3) against the exact same `app`-layer
  orchestration the extension uses, with zero `vscode` dependency — extending
  ADR-0001's "one shared domain" proof from business logic to persisted
  state.
- **Positive:** consolidates two ad hoc XDG resolvers into one coherent,
  fully-tested storage port, and closes a latent inconsistency
  (`XDG_DATA_HOME` was not respected anywhere) before it spreads further.
- **Negative:** the `HubManager`/`RegistryManager`/`UpdateChecker` extraction
  grows by one small, dedicated sub-step (defining the port + its two
  adapters) — accepted, since deferring it would mean redoing the extraction
  once this gap was noticed anyway.
- **Explicitly unaffected:** `LockfileManager` and `app/install/*` — already
  portable/agnostic, confirmed by direct inspection while drafting this ADR.
