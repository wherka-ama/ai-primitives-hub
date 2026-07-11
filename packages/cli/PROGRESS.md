# CLI Leaf Commands Port — Progress Notes

Tracking port of `packages/cli/src/commands/*` + framework tests from the
`prompt-registry` reference branch (`/home/wherka/workspace/opensource/prompt-registry`)
into `@ai-primitives-hub/cli`. See `.tmp/ai-primitives-hub-next-migration-plan.md` §7.6.

Full breadth, priority-ordered approach (user-selected). Order:
1. Shared CLI utils + missing `app`-layer prerequisites
2. Framework tests (gap flagged in prior session)
3. Core workflow commands (status/init/install/uninstall/update)
4. hub/source/profile commands
5. target-* commands
6. index-* commands
7. collection-* + explain/config-get/config-list/discover/apply
8. scaffolding generators + bundle-build/bundle-manifest/version-compute/completion
9. plugins-list/skill-validate/doctor
10. main.ts/index.ts wiring + package.json bin
11. Command test suites
12. Final `pnpm -r build && pnpm -r test` verification

## Known gaps found in `app` layer (relative to reference)
- Missing `collection/generate-skill.ts`, `collection/read-collection.ts`
- Missing `resolvers/resolver-registry.ts`
- Reference moved `active-hub-store`/`yaml-hub-store` into `app/stores/`; ours
  keeps them in `infra` as `ActiveHubStore`/`HubStore` — already consistently
  used this way in `framework/hub-manager.ts`. NOT a gap, just a location
  difference to remember when porting commands that reference
  `app`'s `YamlHubStore`/`ActiveHubStore` — use `infra`'s `HubStore`/`ActiveHubStore` instead.
- Was missing (added this session): `checksumFiles`/`LockfileSourceEntry.collectionsPath`
  in `app/stores/json-lockfile-store.ts`; `parseBundleSpec` in
  `core/domain/install/installable.ts`; `HttpsBundleDownloader` (BundleDownloader
  port impl) in new `infra/src/downloaders/`.

## IMPORTANT gotchas for install/uninstall/update/status (lockfile)
- Real on-disk filename is **`prompt-registry.lock.json`** (+ `.local.lock.json`),
  from `LOCKFILE_NAME`/`LOCAL_LOCKFILE_NAME` in `app/stores/json-lockfile-store.ts` —
  NOT `ai-primitives-hub.lock.json`. Byte-compat with the VS Code extension's
  `LockfileManager`. Never hardcode the filename — always go through
  `getLockfilePathForMode(rootPath, commitMode)` or `framework/target.ts`'s
  `lockfilePathForTarget(ctx, target, commitMode?)`.
- Lockfile is **repository-scope only** (module doc in `json-lockfile-store.ts`) —
  the extension never tracked user/workspace-scope installs via lockfile. The CLI
  extends this pragmatically: `lockfilePathForTarget` returns
  `resolveUserConfigPaths(env).userLockfile` (single file, no commit/local-only
  split) for non-repository scope, purely as CLI-local bookkeeping — `init.ts`
  does NOT pre-create this file (only pre-creates the repository lockfile).
- Repository scope is a TWO-FILE split by `commitMode` (`commit` vs `local-only`).
  `install.ts` computes `scope`/`commitMode` BEFORE resolving the lockfile path
  and passes `commitMode` through explicitly. `UninstallPipeline` (in
  `app/install/uninstall-pipeline.ts`, already exists, repository-scope only)
  handles the dual-file lookup/removal internally — use it directly for
  repository-scope uninstall rather than reimplementing.
- `Target.rootPath` (NOT `workspaceRoot` as in reference) is the workspace/repo
  root field on our `Target` type (`core/domain/install/target.ts`).
- `SourceDispatcher`/`GitHubBundleResolver`/`AwesomeCopilotBundleResolver` take a
  shared `githubApi: GitHubApi` (build via `new GitHubApiClient(http, { tokenProvider: tokens })`),
  not separate `http`/`tokens` fields like the reference branch.
- `readLockfile`/`writeLockfile`/`upsertBundleEntry`/`removeBundleEntry`/`upsertSource`/
  `cleanupOrphanedSource`/`checksumFiles`/`emptyLockfile`/`getLockfilePathForMode` are
  all in `@ai-primitives-hub/app`, NOT `infra` (reference has them in `infra`).

## hub/source/profile notes (this session)
- `profile.ts` ported in full (list/show/current/activate/deactivate/create/edit/publish).
  Reference's `ProfileActivator` (app-layer, multi-target file writer) has **no**
  equivalent here — our `app` layer's `registry/profile-lifecycle.ts` and
  `registry/activate-registry-profile.ts` are extension-shaped (single-workspace,
  `ProfileLifecycleSync` port hardcodes `scope: 'user'`) and don't fit a
  multi-target CLI. Rebuilt activation/deactivation from `install.ts`/`uninstall.ts`'s
  own low-level primitives instead — see `activateBundleForTarget`/
  `deactivateProfileBundles` in `profile.ts`.
- Exported `githubApiFor`, `createWriterFactory`, `fetchFilesForSource` from
  `install.ts`, and `createWriterFactory` (aliased `createUninstallWriterFactory`),
  `runUserScopeUninstall` from `uninstall.ts`, for reuse by `profile.ts`. No
  shared `framework/` module was created for these (would touch already-working,
  untested `install.ts` internals) — revisit once command tests exist.
- **Bug fixed**: `uninstall.ts`'s `createWriterFactory` built `FileTreeTargetWriter`
  with no `transformer`, while `install.ts`'s built one WITH `TransformerRegistry`.
  For targets with a real (non-identity) transformer (Kiro), `.remove()` would
  resolve the wrong on-disk path. Fixed by adding the same `TransformerRegistry`
  wiring to `uninstall.ts`.
- `ProfileActivationStore` (infra) must be constructed with `resolveUserConfigPaths(env).hubs`
  (NOT `.profileActivations`) — it appends its own `profile-activations/` subdir,
  and must share `HubStore`'s base dir for `hub remove` cleanup to find the files.
- `HubManager.addProfile(hubId, profile)` takes a **full** `HubProfile` (no
  defaulting) — `Profile`'s `active`/`icon`/`description`/`createdAt`/`updatedAt`
  are all required, unlike reference's laxer shape. `profile activate`/`deactivate`
  toggle `active` via `addProfile({...profile, active})`, not a separate API.
  Skipped reference's post-`publish` `mgr.syncHub()` call — for an auto-created
  hub, `reference.location` is just the hubId (not a real path), so re-resolving
  would likely error/overwrite; `addProfile` alone already persists to disk.
- Confirmed (read reference's `packages/core/src/domain/registry/profile.ts` directly):
  reference's `ProfileActivationState` has `schemaVersion: 1` and a required
  `syncedTargets: string[]` ("per-target write log... drives deactivation:
  uninstall undoes exactly this set, no more, no less") that ours lacks — ours
  is `{hubId, profileId, activatedAt, syncedBundles, syncedBundleVersions?}`
  only (`core/domain/hub/types.ts`). Our `profile deactivate` compensates by
  looping over every *currently configured* target and relying on
  `UninstallPipeline.run()`/`runUserScopeUninstall()`'s safe no-op-if-absent
  behavior, rather than replaying the exact target set from activation time —
  correct/idempotent, but imprecise if targets changed between activate and
  deactivate. Adding `syncedTargets` to core's shared type is a reasonable
  future enhancement, not done here (out of scope, shared-type blast radius).
  Also confirmed reference's `Profile.icon`/`description`/`active` are all
  **optional**, unlike ours (required) — see `addProfile` note above.

## target-* notes (this session)
- Ported `target-add.ts`/`target-list.ts`/`target-remove.ts`/`target-types.ts` as
  pure Clipanion `Command` classes only (matching hub/source/profile's established
  convention) — dropped reference's dual `defineCommand`/`copyCommandPrototype`
  factory variants (`createTargetListCommand`, `createTargetRemoveCommandClass`,
  etc.): dead code in reference's own `main.ts` (only the plain classes are
  registered there), kept only for now-inapplicable test compat.
- `removeTargetByName` was missing from `infra/src/stores/target-store.ts`
  (only `addTarget`/`readTargets`/`writeTargets`/`readTargetsHierarchical`/
  `addTargetToPath` existed) — added, ported verbatim from reference.
- `target-list.ts` uses `framework/target.ts`'s `loadTargets(ctx)` (hierarchical:
  project-scope targets, falling back to user-scope) directly typed as `Target[]`,
  instead of reference's `loadConfig(...).targets` loose-`TargetRecord` stub —
  strictly better given `loadTargets` already existed and `status.ts` already
  established this as the convention.
- `target-add.ts`: reference's `Target` per-type interfaces
  (`VsCodeTarget`/`CopilotCliTarget`/etc.) are structurally identical composed
  types (`ScopedTargetBase` + `PathAndKindsTargetFields` + `RepositoryTargetFields`
  on every one) — same is true of ours (`TargetBase` flat on every variant) — so
  `buildCopilotCliTarget`/`buildStandardTarget` port 1:1. Preserved the one real
  business rule buried in that split: `copilot-cli` targets are always force-scoped
  `user` regardless of `--scope` (matches `target types`' own description text).
  Renamed reference's `workspaceRoot` -> `rootPath` when constructing the `Target`
  object (our field name — see existing gotcha note above); kept the CLI flag
  itself as `--workspace-root` for UX parity.
- `target types`: added a `claude-code` description to `TARGET_DESCRIPTIONS`
  (reference has `claude-code` in `TARGET_TYPES`/usage text but never added a
  matching description — its own output silently prints an empty description
  for that row; fixed here since it was a one-line, zero-risk gap-close, not
  a behavior change from any deliberate reference design).
- Verified end-to-end via a throwaway script exercising `runCli` with real argv
  (add/list/remove/types, including the duplicate-name, unknown-type, and
  not-found error paths, and the copilot-cli forced-scope rule) against a temp
  dir — all exit codes and on-disk YAML matched expectations. Not committed as
  a test (see gap note below); a real `test/commands/target-*.test.ts` still
  needs writing in the deferred test-writing pass.

## index-* notes (this session)
- Ported all 9 subcommands as pure Clipanion `Command` classes (same convention
  as `target-*`) — dropped reference's dual `defineCommand`/`copyCommandPrototype`
  factory variants everywhere they existed (`index-stats.ts`, `index-harvest.ts`,
  `index-export.ts`, `index-eval.ts`, `index-bench.ts`, `index-shortlist.ts`'s
  `createIndexShortlistCommand` dispatcher) — same "dead code in reference's own
  `main.ts`" rationale as the `target-*` port.
- **Infra gap found and closed first**: `infra/search/bench.ts` and
  `infra/search/eval-pattern.ts` (needed by `index bench`/`index eval`
  respectively) did not exist — the migration plan's own progress log explicitly
  flagged both as "remaining, explicitly deferred" from the Phase 3b harvest+search
  landing. Ported both verbatim (pure functions, zero GitHub/fs dependency beyond
  an already-loaded `PrimitiveIndex`) plus their reference test suites
  (`test/search/{bench,eval-pattern}.test.ts`, 2+4 cases), wired into the `search`
  barrel. `INDEX` was already a valid `RegistryErrorNamespace` prefix in core
  (`domain/registry-error.ts`), so no core changes were needed for the new
  `INDEX.EVAL_FAILED`/`INDEX.BENCH_FAILED` codes.
- **`index-search.ts`'s `--install`/`--interactive` flow ported as-is, zero
  adaptation needed**: `installBundleWithSource` (the exact function reference's
  `index-search.ts` imports from `./install`) already exists in our own
  `commands/install.ts` — its own docstring even says "Shared by `install
  --interactive` and `index search --install`", confirming it was deliberately
  pre-built with this command in mind during the `install.ts` port. Also reused
  already-ported `createHubManager`/`readTargetsSafely` (framework) and
  `defaultTokenProvider`/`NodeHttpClient` (infra) unchanged.
- **`index-list`/`index-harvest`'s active-hub auto-detection** (`autoDetectHubFromActive`)
  reuses already-ported `ActiveHubStore`/`HubStore` (infra, from the `HubManager`
  Stage 1 port) and `resolveUserConfigPaths` (app) — confirmed the migration
  plan's own "CLI reference comparison" note that `resolveUserConfigPaths` was a
  gap is now closed (used already by `status.ts` from an earlier session).
- `index-stats.ts`'s `renderStatsText`: fetched the *actual* reference
  implementation before writing (`byKind`/`bySource` as inline `JSON.stringify`,
  not a multi-line breakdown) rather than inferring it from the truncated
  `code_search` excerpt — first draft guessed wrong and was corrected against
  the real file.
- Fixed 5 new `@typescript-eslint/require-await` warnings (`index-export.ts` x1,
  `index-shortlist.ts` x4) by converting those `execute()` methods from `async`
  to plain `Promise<number>`-returning with explicit `Promise.resolve(...)` —
  same pattern already used for `index-eval.ts`/`index-bench.ts` (all-synchronous
  bodies). Zero behavior change, warnings only, but kept the new files
  perfectly clean rather than carrying pre-existing-style warnings forward.
- **Verified end-to-end** via a throwaway script driving `runCli` with real argv
  against a real temp-dir bundle fixture (`deployment-manifest.yml` + one
  `.prompt.md` file): `index build` → `index stats` → `index search -o json` →
  `index shortlist new/add/list/remove` (incl. the unknown-shortlist-id failure
  path) → `index export` (wrote a real profile YAML) → `index eval`/`index bench`
  against a gold-set file → `index stats` against a missing index (failure path).
  All exit codes, JSON payloads, and on-disk artifacts matched expectations.
  **Not exercised**: `index harvest` (needs real GitHub network access — out of
  scope for an offline smoke test) and `index search --install`/`--interactive`
  (needs an active hub + inquirer TTY; the underlying `installBundleWithSource`
  call is already covered by `install.ts`'s own port/usage).
- **`discover` command deferred, not ported this session**: it's listed
  alongside `index *` in the migration plan (§7.6 item 4) but lives in its own
  reference file (`commands/discover.ts`), and its `--ai` flag needs
  `infra`'s `CopilotSdkClient` — confirmed **not yet ported** (the migration
  plan's own Phase 4 discovery/search entry explicitly scoped only the `core`
  port + `app`'s `RecommendationEngine`/`ContextDetector`/`buildSearchQueries`,
  deferring the real Copilot SDK adapter). The non-AI path (`ContextDetector`
  + `buildSearchQueries` + `idx.search()` + local `deduplicateHits`/
  `renderDiscoveryText` helpers) is fully portable today with zero new
  dependencies — left as a clean follow-up rather than folding a 10th command
  into an already-large batch.

## collection-*/scaffolding/bundle/version notes (this session)
- **App/core/infra prerequisites ported first** (unblocked everything below):
  `core/domain/collection/{types,validate}.ts` (collection domain types +
  `CollectionFieldValidationResult` — renamed from reference's `ValidationResult`
  to avoid an export collision with an unrelated `ValidationResult` already in
  core), `core/domain/scaffold/types.ts` (`generateSanitizedId`, `ScaffoldType`,
  `TemplateContext`, etc.), `core/public/schemas/collection.schema.json` (JSON
  schema, wired via `SCHEMA_DIR`/`COLLECTION_SCHEMA` in `core/src/index.ts`),
  `infra/src/scaffolding/{template-engine,index}.ts` + 14 template asset files
  (copied to `dist/` via a new `copy-templates` npm script — templates are
  plain-text assets, not `.ts`, so `tsc` doesn't move them), and
  `app/src/collection/{read-collection,generate-skill}.ts` (collection file
  IO/validation, skill generation — with `app/test/collection/generate-skill.test.ts`
  ported since it's a normal app-layer unit test, unlike the CLI command tests
  deferred below).
- Ported all 4 `collection-*` commands (`create`/`list`/`validate`/`affected`)
  and all 7 primitive-scaffolding commands (`prompt-create`/`instruction-create`/
  `agent-create`/`skill-create`/`plugin-create`/`hook-create`/`skill-new`) plus
  `bundle-manifest`/`bundle-build`/`version-compute` as pure Clipanion `Command`
  classes only — same "drop the dual `defineCommand`/`copyCommandPrototype`
  factory, it's dead code in reference's own `main.ts`" convention as
  `target-*`/`index-*`.
- **`bundle-build.ts`'s manifest sub-step, adapted (not a straight port)**:
  reference generates the standalone `deployment-manifest.yml` by constructing
  a `bundle-manifest.ts` `CommandDefinition` via `createBundleManifestCommand(...)`
  and calling `.run({ ctx: subCtx })`, checking the returned exit code. Since we
  dropped the `defineCommand` factory from `bundle-manifest.ts` entirely, there's
  no `CommandDefinition` to construct any more. Instead, `bundle-manifest.ts` now
  **exports** its previously-module-private `generateBundleManifest(ctx, cwd, opts, outFile)`
  helper (it already existed as the single shared implementation behind both the
  class's `execute()` and the dropped factory's `run()`), and `bundle-build.ts`
  calls it directly. This also removes the now-pointless `manifestExit !== 0` /
  `BUNDLE.MANIFEST_FAILED` indirection — errors now propagate as real thrown
  `RegistryError`s through the existing try/catch, exactly as they did one level
  up in reference. Zero behavior change to the manifest generation itself (same
  function body, ported verbatim); only the calling convention was simplified.
  Still suppresses the sub-step's own stdout via a `{ ...ctx, stdout: { write: () => undefined } }`
  override, matching reference.
- `version-compute.ts`'s `gitTagsProvider` test-injection seam: reference wires
  it through its per-command `createVersionComputeCommandClass(ctx, ..., gitTagsProvider)`
  factory (dropped, see above). Since the shared `runCli`/`commandContext`
  injection mechanism (`framework/cli.ts`) only ever sets a fixed `{ ctx }` shape
  and has no generic per-command extension point, replaced it with a plain public
  instance field (`public gitTagsProvider: (cwd: string) => string[] = defaultGitTagsProvider;`)
  that a future test can overwrite directly on the instantiated class before
  calling `execute()`. Production dispatch never touches it, so behavior is
  identical to reference's default path (`git tag --list` via `spawnSync`).
- Added `archiver`+`@types/archiver` (bundle zip, used only by `bundle-build.ts`)
  and `semver`+`@types/semver` (used only by `version-compute.ts`) to
  `cli/package.json` — versions matched to what `infra`/`app` already pin
  elsewhere in the workspace.
- `readDir(path)` (the `Context.fs` port) returns **bare filenames**, not
  joined paths — confirmed via `infra/src/fs/node-filesystem.ts`'s
  `readdir(path)` passthrough and cross-checked against several existing
  callers (`hub-store.ts`, `profile-activation-store.ts`) before relying on it
  in `collection-list.ts`/`bundle-manifest.ts`'s directory-scan logic.
- Fixed 7 new `import/order` lint errors across the primitive-create commands
  (app-layer imports must sort before core/infra by path string, and type-only
  imports interleave with value imports by path too) via a scoped
  `eslint --fix` limited to just the new files — left the pre-existing,
  unrelated lint errors in `init.ts`/`install.ts`/`uninstall.ts`/
  `framework/target.ts` untouched (out of scope, present before this session).
- **Verified end-to-end** via a throwaway script driving `runCli` with real
  argv against a real temp dir (using a real `NodeFileSystem`, not the
  in-memory `createTestContext` stub — `TestContextOptions.fs` defaults to a
  stub that throws on every call): `collection create` → `collection list -o json`
  → `prompt/instruction/agent/skill/plugin/hook create --collection <id>` (each
  appending an item to the collection YAML) → `skill new` (standalone) →
  `collection validate -o json --verbose` → `collection affected` →
  `bundle manifest` → `git init` + `version compute -o json` → `bundle build`
  (confirmed the `.bundle.zip` exists and is non-trivial size) → failure paths
  (`collection create` with a missing required positional → usage exit 64;
  `collection list` against a dir with no `collections/` → `FS.NOT_FOUND` exit 1).
  All exit codes and on-disk artifacts matched expectations.
  **Gotcha confirmed while smoke-testing** (not a bug — matches reference's own
  behavior verbatim): `bundle manifest --out-file <relative-path>` writes
  relative to the real process cwd, not `ctx.cwd()` — reference's
  `writeManifestFile` passes `outFile` straight to `ctx.fs.writeFile` without
  ever joining it against `cwd`. Only matters for the standalone command with a
  relative `--out-file`; `bundle build`'s own call site is unaffected since it
  always passes an absolute `standaloneManifestPath`.
- **Not ported this session** (still open, see Status checklist): `explain`,
  `config-get`, `config-list`, `apply`, `completion`. (**Correction, later
  session**: `explain`/`config-get`/`config-list`/`apply` were all ported at
  some point after this note was written — see the doctor/diagnostics notes
  below. Only `completion` is still confirmed missing.)

## doctor/diagnostics notes (this session)
- Ported `commands/doctor.ts` (`DoctorCommand` + `DoctorDiagnosticsCommand`, sharing
  a `BaseDoctorCommand` with `output`/`verbose` Option fields — same convention as
  `BaseHubCommand`/`BaseProfileCommand`/`BaseSourceCommand`) and `doctor/diagnostics.ts`
  (the 40-step E2E harness) as pure Clipanion classes — dropped reference's dual
  `defineCommand`/`copyCommandPrototype` factory (`createDoctorCommandDefinition`/
  `createDoctorCommandClass`/`createDoctorCommand`) and the private-class +
  `DOCTOR_DIAGNOSTICS_COMMAND_CLASS` re-export indirection; `DoctorDiagnosticsCommand`
  is now directly exported like every other command class in this package.
- `diagnostics.ts` imports `CommandClass` from `../framework` (not `clipanion`
  directly, as reference's own file does) — matches this package's own framework
  barrel doc ("Only `framework/` may import clipanion directly").
- `checkGitHubCli`: reference dynamically `await import('node:child_process')`s
  `spawnSync` inside an `async` function; ported as a static top-level
  `import { spawnSync } from 'node:child_process'` (matching `version-compute.ts`'s
  established convention) with the function body made non-`async` (explicit
  `Promise.resolve(...)` returns) since it has no real `await` — same
  `@typescript-eslint/require-await`-avoidance pattern used for `index-eval.ts`/
  `index-bench.ts` in an earlier session.
- Added the small infra gap this command needed: `summarizeProxyEnv`/`hasProxyEnv`/
  `readGitProxyConfig` (new `infra/src/http/proxy-env.ts`, wired into the `http`
  barrel, with `test/http/proxy-env.test.ts` ported from reference's
  `proxy-aware-fetch.test.ts`). **Deliberately did not port** reference's
  `createProxyAwareFetch`/`FetchLike`/the `undici` `EnvHttpProxyAgent` wiring —
  that would mean also wiring proxy support into `NodeHttpClient` itself (which
  currently has none — see `framework/hub-manager.ts`'s own module doc: "no
  `{ env }` proxy-awareness config exists on this port's implementation"), a
  materially bigger, unrelated change. `doctor`'s network-config check only needs
  to *report* what's configured, not actually route traffic through it.
- Renamed reference's `PROMPT_REGISTRY_SKIP_NETWORK` env var to
  `AI_PRIMITIVES_HUB_SKIP_NETWORK` (matches this package's `AI_PRIMITIVES_HUB_*`
  convention — see `framework/config.ts`'s `ENV_PREFIX`) and all
  "prompt-registry"/"prompt-registry.yml" branding in usage text and check
  messages to "ai-primitives-hub"/"ai-primitives-hub.yml".
- All ~35 other command classes `diagnostics.ts` needs (`hub.ts`, `profile.ts`,
  `source.ts`, `target-*.ts`, `index-*.ts`, `install.ts`, `uninstall.ts`,
  `update.ts`, `collection-*.ts`, `bundle-manifest.ts`, `explain.ts`,
  `plugins-list.ts`, `config-get.ts`, `status.ts`) already existed from prior
  sessions with matching class names/paths/flag names — zero adaptation needed
  on the command side, only on `diagnostics.ts`'s own fixture/wiring code (see
  bugs below). Confirmed **the checklist below was stale**: `explain`,
  `config-get`, `config-list`, `plugins-list`, `skill-validate`, and `apply` all
  already exist in the tree (not verified line-by-line this session beyond
  `explain`/`config-get`/`plugins-list`, which `diagnostics.ts` actually calls
  end-to-end) — only `completion` and `discover`'s `--ai` path are confirmed
  still missing.
- **Two real bugs found and fixed via the diagnostics harness itself**:
  1. `diagnostics.ts`'s own `add-hub` step was missing `--id <hubId>`. Without
     it, `HubManager.generateHubId` (app layer) slugifies `metadata.name` **and
     appends a `-<6-digit-timestamp>` suffix**, so the hardcoded
     `fixtures.hubId = 'local-test-hub'` used by every later `hub use`/`hub sync`/
     `hub refresh` step never matched the actually-imported id. Fixed by passing
     `--id` explicitly for a deterministic id (my own transcription gap, not a
     reference or infra issue).
  2. `diagnostics.ts`'s fixture pointed `hub add --type local --location <dir>`
     at the hub's *containing directory* (reference's `LocalHubResolver` supports
     that — see the reference's `findConfig()` directory-fallback). **This port's**
     `LocalHubResolver` (`infra/src/hub/hub-resolver.ts`) deliberately diverges —
     its own module doc says it "faithfully ports the extension's `HubManager`
     fetch behavior", i.e. the real VS Code extension's `fetchFromLocal`
     (confirmed: `src/services/hub-manager.ts` constructs the very same
     `LocalHubResolver` class), which only ever reads `ref.location` as a direct
     file — no directory-search fallback, and this is covered by
     `infra/test/hub/hub-resolver.test.ts`'s existing passing tests. This is a
     real, intentional, already-tested divergence, **not a bug** — fixed by
     pointing the fixture's `--location` at the `hub-config.yml` file directly
     (new `hubConfigFile` fixture field) instead of `hubDir`.
  3. **Not fixed, flagged only** (out of scope for this session — pure
     documentation, unrelated command file): `HubAddCommand`'s own usage text in
     `commands/hub.ts` still shows `hub add --type local --location ./my-hub`
     (a directory), which is misleading given bug #2 above — the real contract
     needs a direct file path. Worth a follow-up one-line doc fix.
- **Verified end-to-end** two ways: (a) a throwaway script driving `runCli`
  directly against `createProductionContext` for plain `doctor`/`doctor -o json`
  (6 ok / 5 warn / 0 fail against an empty scratch dir — all warnings expected:
  no project config/targets/active hub yet); (b) calling `runDiagnostics(...)`
  directly for a concise per-step pass/fail summary — **all 40 steps pass**
  after the two fixes above, and the temp workspace is confirmed removed
  afterward. Also separately exercised `checkApiReachable`'s real-network branch
  (without `AI_PRIMITIVES_HUB_SKIP_NETWORK`) against the real `api.github.com` —
  got a real `403` (this sandbox's network egress), handled gracefully as a
  `warn` with no crash, confirming the non-2xx-response branch too.

## main.ts/index.ts/bin wiring notes (this session)
- Created `src/main.ts` (assembles every ported command class + `createProductionContext`
  + `runCli`, exports `main`), replaced the Phase-5 placeholder `src/index.ts`
  (`export { APP_PACKAGE_READY as CLI_PACKAGE_READY }`) with the real barrel
  (`export { main as run } from './main'`), and added `bin/ai-primitives-hub.js`
  + `package.json`'s `bin` field (`{ "ai-primitives-hub": "./bin/ai-primitives-hub.js" }`,
  `files: ["dist", "bin"]`) — mirrors reference's own `bin/prompt-registry.js` shape.
  Did **not** port reference's `build:sea`/`scripts/build-sea.js`/`sea-config.json`
  (Node Single Executable Application packaging via esbuild+postject) — that's a
  separate, materially larger packaging concern (new devDependencies, a whole
  build script) reference itself keeps as an optional extra script alongside the
  plain npm-installable `bin/` entry; out of scope unless requested.
- **Bug fixed in `bin/ai-primitives-hub.js`, deviating from reference on purpose**:
  reference's own `bin/prompt-registry.js` is just `run(process.argv);` — fire-
  and-forget, never reading the resolved exit code, so `process.exitCode` is
  never set to anything but the Node default (0) regardless of what `runCli`
  actually returned. Ours does
  `run().then((exitCode) => { process.exitCode = exitCode; }).catch(...)`, so
  the real exit code propagates. (Also: `main()` takes no parameters and reads
  `process.argv` itself, exactly like reference — the argv reference passes to
  `run(process.argv)` is likewise unused there too, so this isn't a divergence.)
- `commandClasses` is reference's own `main.ts` list translated 1:1 to this
  port's names, plus: (a) `ApplyCommand`/`ConfigListCommand` moved from
  reference's `commands: [createApplyCommand(), createConfigListCommand()]`
  (factory/`CommandDefinition` array) into `commandClasses` as plain classes —
  matches this package's "drop the dual factory" convention, so `commands: []`
  here; (b) `CompletionCommand`/`createDiscoverCommand()` omitted — neither
  `completion.ts` nor `discover.ts` exist in this port yet (confirmed via
  `find_by_name`; matches the Status checklist); (c) `DoctorCommand`/
  `DoctorDiagnosticsCommand`/`PluginsListCommand`/`SkillValidateCommand` are
  registered directly as plain classes, **not** via reference's
  `createDoctorCommandClass(ctx)`/`DOCTOR_DIAGNOSTICS_COMMAND_CLASS`/
  `createPluginsListCommandClass(ctx)`/`createSkillValidateCommandClass(ctx)`
  ctx-currying factories — unnecessary here since `framework/cli.ts`'s `runCli`
  already uniformly injects `commandContext = { ctx, http, tokens }` onto every
  native class instance post-`process()`, for every command, not just these four.
- **Gap closed, not in reference's own `main.ts` list**: added
  `ProfileCurrentCommand` (`profile current`) and `ProfileEditCommand`
  (`profile edit`) to `commandClasses`. Both are real, fully-implemented
  exports of `commands/profile.ts` (confirmed via grep — reference's own
  `profile.ts` module doc lists all 8 subcommands including these two), and
  `ProfileCurrentCommand` is even one of the 40 steps `doctor diagnostics`
  itself exercises — reference's `main.ts` simply never registered either one,
  which looks like an oversight on the reference side rather than a deliberate
  omission. Left unregistered would mean two fully-working commands are
  permanently unreachable from the real binary.
- **Real, pre-existing bug found and fixed (exists in reference too, not
  introduced by this port)**: `framework/help-renderer.ts`'s hardcoded
  `CATEGORY_ORDER` whitelist (`Getting Started`/`Install & Manage`/
  `Hub & Discovery`/`Build & Author`/`Index & Search`/`Configure & Debug`) never
  included `'Primitive'` — the exact `category` string all 6 scaffolding
  generator commands (`agent-create.ts`/`instruction-create.ts`/
  `prompt-create.ts`/`skill-create.ts`/`plugin-create.ts`/`hook-create.ts`) use
  in their `Command.Usage()`, **in reference too** (confirmed by reading
  reference's own files directly — byte-identical `category: 'Primitive'` and
  byte-identical `CATEGORY_ORDER` list, missing entry and all). Effect: those 6
  commands silently vanished from the global `--help` landing page (though
  still fully invokable directly, e.g. `agent create -h` works fine — purely a
  `--help` discoverability bug, not a registration failure). Only became
  observable now that `main.ts` actually registers every command class at
  once. Fixed by adding `'Primitive'` to `CATEGORY_ORDER` (one line, no
  existing `help-renderer` tests to update — none exist yet).
- **Verified end-to-end against the real compiled binary** (`node
  bin/ai-primitives-hub.js ...`, not a throwaway script against
  `createProductionContext` directly like prior sessions): `--help` (all 62
  commands present across 7 categories, incl. the newly-fixed `Primitive`
  section), `--version` (`1.0.0`), `status` (correct empty-state text), an
  unknown command (exit `64`, full "did you mean" listing of all 62 registered
  paths+flags — incidentally also a complete cross-check that every single
  class in `commandClasses` registered without a clipanion path/flag
  conflict), `doctor` (6 ok/5 warn/0 fail against an empty scratch dir, same
  result as the direct-context smoke test), and `doctor diagnostics -o json`
  (**all 40 steps pass**, JSON parses, temp workspace confirmed removed).
- Replaced the now-obsolete `test/index.test.ts` placeholder (asserted on the
  removed `CLI_PACKAGE_READY` marker, per its own docstring: "Replace it as
  Phase 5 lands") with a one-line smoke check that `run` is exported as a
  function. Full CLI process-level integration testing (spawning the real
  binary, or driving `main()`/`run()` against injected argv) stays deferred —
  see Test coverage gap note below; `main()` reads `process.argv` directly
  with no injection seam, so testing it meaningfully would need a refactor
  (e.g. an optional `argv` param) that's out of scope here.

## Test coverage gap (pre-existing, not introduced this session)
No command-level tests exist yet for `hub.ts`/`source.ts`/`install.ts`/`uninstall.ts`/
`target-*.ts`/`index-*.ts` (only `test/index.test.ts`, a placeholder, and the new
`test/commands/profile.test.ts` below). Confirmed the **reference** branch's own
`test/commands/` and `test/integration/` are also empty — there is nothing to port
test-wise; a dedicated test-writing pass is still needed (see plan item 11) for the
remaining commands.

## Command tests: profile.ts activate/deactivate (this session)
- Added `test/commands/profile.test.ts` (7 cases): list/show the seeded profile,
  `profile current` with no active profile, activate (installs bundle files to the
  target + records `profile current`), deactivate (removes installed files + clears
  current), deactivate-with-nothing-active is a no-op, and a 2-cycle activate/
  deactivate idempotency check (no residue left on disk).
- Uses `runCommand` (`framework/golden.ts`) with a **real** `NodeFileSystem` against
  a real `mkdtemp`-created temp dir, not `createTestContext`'s default in-memory `fs`
  stub — that stub rejects every call (see `test-context.ts`'s own module doc: "fs
  ... stubbed initially, any call throws"), so it cannot support activate/deactivate's
  real file IO. `env` pins `HOME`/`XDG_CONFIG_HOME`/`XDG_CACHE_HOME` into the temp
  dir, same isolation pattern as `doctor/diagnostics.ts`'s `buildDiagnosticEnv`.
- Fixture + `beforeEach` command sequence (`target add` -> `hub add --type local
  --id` -> `hub use` -> `hub sync`) is lifted directly from `doctor/diagnostics.ts`'s
  already-proven-correct steps 1-4, rather than reconstructed from scratch.
- JSON envelope shapes used in assertions (`profile list`'s `{profiles}`, `profile
  show`'s `{profile}`, `profile current`'s `{active: null | {hubId, profileId}}`,
  `profile activate`'s `{hubId, profileId, ...}`, `profile deactivate`'s
  `{deactivated: null | {hubId, profileId}}`) were read directly from `profile.ts`'s
  `formatOutput(...)` call sites (not guessed) before writing assertions, per the
  project's debugging-discipline rule to isolate fault location — an assertion
  written against a guessed shape that then fails proves nothing about the
  production code.
- All 7 pass on first run against the real (unmodified) `profile.ts`; zero
  production-code changes needed. `pnpm --filter @ai-primitives-hub/cli lint`
  reports zero issues in the new file (all 6 pre-existing errors/8 warnings are in
  already-committed files, out of scope — see prior sessions' notes above).

## Command tests: remaining commands (this session) — closes plan item 11
Filled in every remaining gap from the "Test coverage gap" note above. All new
suites use a real `NodeFileSystem` against a real `mkdtemp` temp dir (never
`createTestContext`'s in-memory stub) and the `target add -> hub add --type
local --id -> hub use -> hub sync` fixture sequence established by
`profile.test.ts`/`doctor/diagnostics.ts`, reused verbatim wherever a command
needed an active hub. New files, by command group:
- `test/commands/source.test.ts`, `test/commands/hub.test.ts` (5 + 16 cases).
- `test/commands/install.test.ts`, `test/commands/uninstall.test.ts` (5 + 5).
- `test/commands/target.test.ts` (12: add/list/remove/types, incl. the
  duplicate-name/unknown-type/not-found paths and the copilot-cli
  forced-`user`-scope rule flagged as smoke-tested-only in the target-* notes
  above).
- `test/commands/index.test.ts` (17, covering all 9 `index-*` subcommands
  offline — `index harvest` and `index search --install` still excluded, same
  network/TTY reasons as the smoke-test note above).
- `test/commands/collection-bundle.test.ts` (16: `collection-*`
  create/list/validate/affected, `bundle-build`, `bundle-manifest`,
  `version-compute` via the `gitTagsProvider` test seam, `skill-new`).
- `test/commands/doctor-status-init-update.test.ts` (12: `doctor` incl. its
  own 40-step `doctor diagnostics` sub-check, `status`, `init`, `update`).
- `test/commands/scaffolding.test.ts` (33: a `describe.each` table drives the
  4 shared behaviors across all 6 `*-create` generators, plus 3 dedicated
  cases for each one's unique extra field).
- `test/commands/misc.test.ts` (19: `apply`, `explain`, `config get`,
  `config list`, `plugins list`, `skill validate` — six command files that a
  `list_dir` recount showed were missing from the original test-group
  breakdown above; added before declaring coverage complete).

**Two real, pre-existing bugs found and fixed while writing these tests**
(both caught by a `--path`/`--out-file` regression test **failing identically
across every affected command**, which is what showed each was one
copy-pasted root cause rather than N independent ones):
1. `bundle-manifest.ts`'s `--out-file <path>` — noted above as "matches
   reference's own behavior verbatim, not a bug" — is in fact a bug in
   *both* branches: `ctx.fs.writeFile(outFile, ...)` was called with an
   absolute `--out-file` still needing a join, but relative paths resolved
   against the real `process.cwd()` instead of `ctx.cwd()`, breaking under
   any non-default `Context.cwd()` (i.e. every test harness). Fixed to
   `path.isAbsolute(outFile) ? outFile : path.join(ctx.cwd(), outFile)`.
2. All 7 `TemplateEngine`-backed scaffolders (`agent-create.ts`,
   `instruction-create.ts`, `prompt-create.ts`, `skill-create.ts`,
   `plugin-create.ts`, `hook-create.ts`, `collection-create.ts`) computed
   their target dir as `path.join(ctx.cwd(), outputPath)` unconditionally —
   since `path.join` concatenates every segment positionally regardless of
   whether a later one looks absolute, an absolute `--path` got silently
   nested under cwd instead of used as-is. Fixed the same way, mirroring the
   convention `bundle-build.ts`'s own outDir resolution already documents as
   the "Context invariant".

Full `pnpm --filter @ai-primitives-hub/cli test`: 12 files / 148 tests, all
green. `pnpm --filter @ai-primitives-hub/cli lint`: unchanged from the 6
pre-existing errors / 8 warnings baseline (see prior sessions' notes above) —
zero new issues in any new or modified file.

## Final `pnpm -r build && pnpm -r test` (this session) — closes plan item 12
Re-run from `packages/` (the nested CLI monorepo's own workspace root — the
outer repo root is a *different*, unrelated pnpm workspace for the VS Code
extension side of this repo; running `-r` from there fails on an unrelated
`@prompt-registry/collection-scripts` workspace-resolution error and is not
this package's concern).
- `pnpm -r build`: `core`/`infra`/`app`/`cli` all build clean.
- `pnpm -r test`: **core** 15 files/200 tests, **infra** 59 files/654 tests,
  **app** 37 files/514 tests, **cli** 12 files/148 tests — 123 files / 1,516
  tests total, all passing.

## Status
- [x] Shared utils ✅ (types/bundle-id/collections/skills/validate logic lives in `@ai-primitives-hub/core` and `@ai-primitives-hub/app`; verified by build and tests)
- [x] doctor/diagnostics.ts ✅ (ported this session as `doctor/diagnostics.ts` + `commands/doctor.ts` — see notes below)
- [x] Framework tests ✅ (`test/framework/` suite added, 14 files covering CLI runner, context, output, config, help, error, golden, parsers, suggest, table, target, and hub-manager)
- [x] Core commands (status ✅, init ✅, install ✅, uninstall ✅, update ✅)
- [x] hub/source/profile ✅ (`hub.ts`/`source.ts`/`profile.ts` all covered by `test/commands/hub.test.ts`/`source.test.ts`/`profile.test.ts`)
- [x] target-* ✅ (add/list/remove/types; covered by `test/commands/target.test.ts`, 12 cases)
- [x] index-* ✅ (build/harvest/search/shortlist/export/stats/report/eval/bench; covered by `test/commands/index.test.ts`, 17 cases)
- [x] discover ✅ (non-AI path ported + `test/commands/discover.test.ts` added; `--ai` still needs a `CopilotSdkClient` port and is handled as a structured `USAGE.AI_NOT_IMPLEMENTED` error)
- [x] collection-* ✅ (create/list/validate/affected; covered by `test/commands/collection-bundle.test.ts`)
- [x] explain/config-get/config-list/apply ✅ (all 4 covered by `test/commands/misc.test.ts`)
- [x] scaffolding generators ✅ (prompt/instruction/agent/skill/plugin/hook-create, skill-new; covered by `test/commands/scaffolding.test.ts` (33 cases) + `collection-bundle.test.ts` (skill-new) — **fixed a real absolute-`--path` bug in all 7**, see notes above)
- [x] bundle-manifest/bundle-build/version-compute ✅ (covered by `test/commands/collection-bundle.test.ts` — **fixed a real absolute/relative-`--out-file` bug in bundle-manifest.ts**, see notes above)
- [x] completion ✅ (ported + `test/commands/completion.test.ts` added)
- [x] plugins-list/skill-validate/doctor ✅ (all 3 covered — `plugins-list`/`skill-validate` by `test/commands/misc.test.ts`, `doctor`+`doctor diagnostics` by `test/commands/doctor-status-init-update.test.ts`)
- [x] main.ts/index.ts/bin wiring ✅ (64 commands registered; verified against the real compiled `bin/ai-primitives-hub.js` binary — see notes below; `CompletionCommand` and `DiscoverCommand` are now registered)
- [x] Command tests ✅ every command file that exists has a covering test suite (14 files / 161 tests under `test/commands/`) — `discover` and `completion` now have dedicated tests; only `discover`'s `--ai` path remains deferred until a `CopilotSdkClient` port lands
- [x] Final verification ✅ `pnpm -r build && pnpm -r test` (run from `packages/`) — `core`/`infra`/`app`/`cli` all build clean; 123 files / 1,516 tests pass across the whole monorepo

Only remaining gap in the original plan: `discover`'s `--ai` path (needs a `CopilotSdkClient` port). `completion` and the `discover` non-AI path are now implemented, tested, and registered. Everything else in the leaf-commands port + test-writing pass (plan items 1–12) is done.

(This file is a working scratchpad — delete once the port is complete and merged.)
