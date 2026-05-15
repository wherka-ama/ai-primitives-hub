# Bundle Search & Install UX Redesign

## Current State Analysis

### Current Workflow (from e2e-user-flow.sh)

**Primitive Index Search → Install Flow (8 steps):**
```bash
index build --root ./bundles --out ~/.cache/primitive-index.json
index search --query "hello" --index ~/.cache/primitive-index.json
index shortlist new --name custom --index ~/.cache/primitive-index.json
index shortlist add --id <id> --primitive <primitive-id> --index ~/.cache/primitive-index.json
index export --shortlist <id> --profile-id custom --out-dir ./exports --index ~/.cache/primitive-index.json
# Manually edit hub-config.yml to add profile
hub sync <hub-id>
profile activate custom --target <target>
```

**Direct Install (1 step but requires explicit bundle ID):**
```bash
install <bundle-id> --from <directory> --target <target>
```

**Uninstall (requires explicit lockfile path):**
```bash
uninstall --lockfile ./prompt-registry.lock.json --target <target>
```

### Pain Points

1. **Search requires 8 steps** - Too complex for quick resource discovery
2. **--index flag required everywhere** - Repetitive and error-prone (F-04 in ux-improvement-proposals.md)
3. **Search buried under `index` group** - Not discoverable (F-07)
4. **Direct install requires knowing bundle ID** - No discovery, just installation
5. **Uninstall requires explicit lockfile path** - Should auto-detect (F-13)
6. **No way to search and install in one flow** - Users want: search → select → install

## Proposed Simplified UX

### 1. Unified Search Command

**Goal:** One command to search across all available resources (bundles + primitives)

```bash
# Search across all sources (hubs + local)
search "code review"

# Search in specific source
search "code review" --source amadeus-hub

# Search by kind
search "code review" --kinds prompt skill

# Search and install in one flow (interactive)
search "code review" --install
```

**Implementation:**
- Top-level `search` command (already proposed in F-07)
- Searches across:
  - Hub profiles (via hub sync)
  - Local bundles (via index build)
  - GitHub repositories (via GitHub API)
- Returns unified results with type indicators:
  - `[PROFILE] Backend Developer` - from hub
  - `[BUNDLE] local-foo` - from local directory
  - `[PRIMITIVE] code-review-prompt` - from index
- `--install` flag enters interactive selection mode

### 2. Interactive Selection with Multi-Select

**Goal:** Easy selection of resources with preview and confirmation

```bash
$ search "code review" --install

Found 12 results:

  [PROFILE] Backend Developer (3 bundles · 12 files)
    Description: Profile for backend developers
    Source: amadeus-hub
    [ ] Select

  [BUNDLE] code-review-skills (5 primitives)
    Description: Code review skills and prompts
    Source: github:Amadeus-xDLC/code-review
    [ ] Select

  [PRIMITIVE] code-review-prompt (prompt)
    Description: A prompt for code review
    Source: local index
    [ ] Select

Select resources (use arrows, space to toggle, enter to confirm):
```

**Key Features:**
- Arrow keys to navigate
- Space to toggle selection
- Enter to confirm and install
- `--all` flag to select all
- `--confirm` flag to skip confirmation
- Preview of what will be installed (dry-run)

### 3. Direct Bundle Installation with Auto-Detection

**Goal:** Install bundles without knowing bundle ID upfront

```bash
# Search and install in one flow
search "code review" --install --target my-target

# Install from specific source
install --source amadeus-hub --target my-target
# Interactive selection of bundles from the source

# Install from local directory
install --from ./my-bundle --target my-target
# Auto-detects bundle ID from deployment-manifest.yml
```

**Implementation:**
- `install` command without bundle ID enters selection mode
- Auto-detects bundle ID from `deployment-manifest.yml` when using `--from`
- Supports `--source` to list bundles from a hub source
- Shows preview before installing (dry-run by default)

### 4. Lockfile Auto-Detection

**Goal:** Remove `--lockfile` requirement

```bash
# Auto-detects ./prompt-registry.lock.json in current directory
uninstall --target my-target

# Or uninstall specific bundle by ID
uninstall <bundle-id> --target my-target
```

**Implementation:**
- Auto-search for lockfile in current directory (and parent directories)
- Search order: `./prompt-registry.lock.json` → `../prompt-registry.lock.json` → etc.
- `--lockfile` remains available for explicit override
- Error with hint if no lockfile found

### 5. Apply Command for Idempotent Setup

**Goal:** One command to set up environment from config (F-11 in ux-improvement-proposals.md)

```bash
# Reads prompt-registry.yml + lockfile, syncs hub, activates profile
apply

# Force refresh
apply --force

# Watch mode for development
apply --watch
```

**Implementation:**
- Reads `prompt-registry.yml` to get target and hub
- Reads `prompt-registry.lock.json` to get active profile
- Syncs hub if stale (>1h or `--force`)
- Activates profile from lockfile
- Idempotent: no side effects if already up to date
- Enables CI pattern: `prompt-registry apply` in workflows

### 6. Index Auto-Discovery

**Goal:** Remove `--index` flag requirement (F-04 in ux-improvement-proposals.md)

```bash
# Uses XDG default: ~/.cache/prompt-registry/index.json
search "code review"
index stats
index shortlist new --name foo

# Override with --index
search "code review" --index /custom/path/index.json
```

**Implementation:**
- Default index path: `$XDG_CACHE_HOME/prompt-registry/index.json`
- Auto-create if doesn't exist (with hint to run `index build`)
- `--index` remains for override

## Implementation Priority

| Priority | Feature | Impact | Effort |
|----------|---------|--------|--------|
| **P0** | Lockfile auto-detection (F-13) | High | Low |
| **P0** | Index auto-discovery (F-04) | High | Low |
| **P0** | Top-level search alias (F-07) | High | Low |
| **P1** | Interactive selection with multi-select | High | Medium |
| **P1** | Direct install without bundle ID | High | Medium |
| **P1** | Apply command (F-11) | High | Medium |
| **P2** | Search across sources (hubs + local) | Medium | High |
| **P2** | Watch mode for apply (F-12) | Low | Medium |

## Technical Design

### Search Architecture

```
SearchCommand
├── HubSearcher (search profiles in synced hubs)
├── LocalBundleSearcher (search local bundles)
├── PrimitiveIndexSearcher (search built index)
└── GitHubRepositorySearcher (search GitHub repos)
```

### Selection UI (CLI)

Using `enquirer` or similar library for interactive CLI:
- Multi-select checkboxes
- Preview of selected items
- Confirmation prompt
- Progress indicator during installation

### Lockfile Auto-Detection

```typescript
function findLockfile(startDir: string): string | null {
  let currentDir = startDir;
  while (true) {
    const lockfile = path.join(currentDir, 'prompt-registry.lock.json');
    if (await fs.exists(lockfile)) {
      return lockfile;
    }
    const parent = path.dirname(currentDir);
    if (parent === currentDir) {
      break; // Reached root
    }
    currentDir = parent;
  }
  return null;
}
```

### Apply Command

```typescript
async function apply(options: ApplyOptions): Promise<void> {
  const config = await loadConfig('prompt-registry.yml');
  const lockfile = await findLockfile(config.cwd);
  
  if (lockfile) {
    const lock = await loadLockfile(lockfile);
    // Sync hub if stale
    await syncHubIfStale(lock.hubId, lock.lastSyncedAt);
    // Activate profile
    await activateProfile(lock.useProfile.profileId, config.target);
  } else {
    // No lockfile, just sync hubs
    await syncAllHubs(config.hubs);
  }
}
```

## Next Steps

1. Implement P0 features (lockfile auto-detection, index auto-discovery, search alias)
2. Implement interactive selection UI
3. Implement direct install without bundle ID
4. Implement apply command
5. Add tests for new flows
6. Update documentation
