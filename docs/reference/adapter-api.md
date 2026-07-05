# Adapter API Reference

This document describes how to create adapters for the AI Primitives Hub extension.

## Overview

Adapters provide a unified interface for fetching bundles from different sources. The AI Primitives Hub uses the adapter pattern to support multiple source types (GitHub, local files, and curated collections).

**Adapters live in `packages/infra/src/adapters/` (the `@ai-primitives-hub/infra` package), not in the extension's own `src/adapters/`.** The extension, and eventually `packages/cli`, both consume them through `@ai-primitives-hub/app`'s `createSourceAdapter` factory — see [Architecture](../contributor-guide/architecture/adapters.md) for the full picture and why the split exists.

## SourceAdapter Interface

All adapters must implement `@ai-primitives-hub/core`'s `SourceAdapter` port (`packages/core/src/ports/source-adapter.ts`):

```typescript
interface SourceAdapter {
    // The type of repository this adapter handles
    readonly type: string;
    
    // The source configuration
    readonly source: RegistrySource;
    
    // Fetch all bundles from this source
    fetchBundles(): Promise<Bundle[]>;
    
    // Download a specific bundle (returns zip Buffer)
    downloadBundle(bundle: Bundle): Promise<Buffer>;
    
    // Get metadata about the source
    fetchMetadata(): Promise<SourceMetadata>;
    
    // Validate source configuration
    validate(): Promise<ValidationResult>;
    
    // Check if source requires authentication
    requiresAuthentication(): boolean;
    
    // Get URLs for bundles
    getManifestUrl(bundleId: string, version?: string): string;
    getDownloadUrl(bundleId: string, version?: string): string;
    
    // Force re-authentication (optional)
    forceAuthentication?(): Promise<void>;
}
```

The extension's own `src/adapters/repository-adapter.ts` re-declares this same shape as `IRepositoryAdapter` purely as the return type of its adapter factory (`createRegistryAdapter`) at the VS Code boundary — the two interfaces are structurally identical, not two different contracts to implement.

## Installation Paths

Adapters can use one of two installation paths:

### URL-Based Installation

For pre-packaged zip bundles on remote servers. The adapter returns a download URL, and `BundleInstaller.install()` handles the download.

**Used by:** GitHub, AwesomeCopilot adapters

```typescript
// Adapter returns URL string
getDownloadUrl(bundleId: string, version: string): string {
    return `https://example.com/bundles/${bundleId}/${version}.zip`;
}
```

### Buffer-Based Installation

For dynamically created bundles. The adapter builds the zip in memory and returns a Buffer. `BundleInstaller.installFromBuffer()` handles extraction.

**Used by:** AwesomeCopilot, Local adapters

```typescript
// Adapter returns Buffer
async downloadBundle(bundle: Bundle): Promise<Buffer> {
    const archive = archiver('zip');
    // ... build zip contents
    return archive.finalize();
}
```

## Creating a New Adapter

### Step 1: Implement the Interface

Add your adapter to `packages/infra/src/adapters/`:

```typescript
// packages/infra/src/adapters/my-custom-adapter.ts
import { Bundle, HttpClient, RegistrySource, SourceAdapter, SourceMetadata, ValidationResult } from '@ai-primitives-hub/core';

export class MyCustomAdapter implements SourceAdapter {
    public readonly type = 'my-custom';

    constructor(public readonly source: RegistrySource, private readonly httpClient: HttpClient) {}

    async fetchBundles(): Promise<Bundle[]> {
        // Fetch bundle list from your source
        const response = await this.httpClient.fetch({ url: this.source.url });
        const data = JSON.parse(Buffer.from(response.body).toString('utf8'));

        return data.bundles.map((item: { id: string; name: string; version: string; description: string }) => ({
            id: item.id,
            name: item.name,
            version: item.version,
            description: item.description,
            // ... other bundle properties
        }));
    }
    
    async downloadBundle(bundle: Bundle): Promise<Buffer> {
        // For buffer-based adapters
        const response = await this.httpClient.fetch({ url: bundle.downloadUrl });
        return Buffer.from(response.body);
    }
    
    async fetchMetadata(): Promise<SourceMetadata> {
        return {
            name: this.source.name,
            type: 'my-custom',
            url: this.source.url,
        };
    }
    
    async validate(): Promise<ValidationResult> {
        try {
            await this.fetchBundles();
            return { valid: true, errors: [], warnings: [] };
        } catch (error) {
            return { valid: false, errors: [error instanceof Error ? error.message : String(error)], warnings: [] };
        }
    }

    requiresAuthentication(): boolean {
        return this.source.private === true;
    }

    getManifestUrl(bundleId: string, version?: string): string {
        return `${this.source.url}/manifests/${bundleId}/${version ?? 'latest'}`;
    }
    
    getDownloadUrl(bundleId: string, version?: string): string {
        return `${this.source.url}/download/${bundleId}/${version ?? 'latest'}`;
    }
}
```

Only depend on `@ai-primitives-hub/core` ports (`HttpClient`, `FileSystem`, `Clock`, `TokenProvider`, ...) for I/O, never `node:fs`/`node:child_process`/`vscode` directly — see [Architecture](../contributor-guide/architecture/adapters.md) for why, and `packages/infra/src/fs/node-filesystem.ts` for the reference Node implementation of a port. If your source is GitHub-flavored, reuse `@ai-primitives-hub/core`'s `GitHubApi` port and `packages/infra`'s `GitHubApiClient` implementation (a thin wrapper over `HttpClient` adding `getJson<T>(path)`/`download(url)` convenience methods plus GitHub auth headers) instead of calling `HttpClient.fetch` directly — see `packages/infra/src/adapters/github-adapter.ts` or `skills-adapter.ts` for real examples.

### Step 2: Wire It Into the Factory

Add your `SourceType` to the union in `packages/core/src/domain/source/types.ts`, then add a case to `createSourceAdapter`'s switch statement:

```typescript
// packages/app/src/registry/create-source-adapter.ts
case 'my-custom':
    return new MyCustomAdapter(source, deps.httpClient);
```

That single factory is shared by every delivery context (the VS Code extension today, `packages/cli` later) — you do not register or wire the adapter again anywhere else.

### Step 3: Add Tests

Add a unit test file next to the adapter, `packages/infra/test/adapters/my-custom-adapter.test.ts` (Vitest), and a case in `packages/app/test/registry/create-source-adapter.test.ts` covering the new switch branch.

## Built-in Adapters

All implemented in `packages/infra/src/adapters/`:

| Adapter | Source Type | Description | Status |
|---------|-------------|-------------|--------|
| `GitHubAdapter` | `github` | Fetches releases and assets from GitHub repositories | Active |
| `LocalAdapter` | `local` | Installs from local file system directories | Active |
| `AwesomeCopilotAdapter` | `awesome-copilot` | Fetches YAML collections from GitHub, builds zips on-the-fly | Active |
| `LocalAwesomeCopilotAdapter` | `local-awesome-copilot` | Local YAML collections for development | Active |
| `ApmAdapter` | `apm` | APM package repositories | Active |
| `LocalApmAdapter` | `local-apm` | Local APM packages | Active |
| `SkillsAdapter` | `skills` | Fetches skills from a GitHub repository's `skills/` directory | Active |
| `LocalSkillsAdapter` | `local-skills` | Local filesystem skills directory | Active |

## Authentication

Adapters that access private repositories don't implement authentication themselves — they take an injected `TokenProvider` (`@ai-primitives-hub/core`'s port: `getToken(host): Promise<string | undefined>`) and call it when building request headers. `createSourceAdapter` builds a `CompositeTokenProvider` per source, trying each of the following in order and using the first one that resolves a token:

1. **Explicit token** — `StaticTokenProvider`, wrapping a token set directly on `RegistrySource.token`
2. **VS Code GitHub authentication** — the extension's own `VsCodeSessionTokenProvider` (`vscode.authentication.getSession('github', ...)`), supplied as one of `createSourceAdapter`'s `fallbackTokenProviders`
3. **GitHub CLI** — `@ai-primitives-hub/infra`'s `GhCliTokenProvider` (`gh auth token`), the other `fallbackTokenProviders` entry
4. **No authentication** — public repositories only

This keeps every adapter's own code free of any auth-chain logic; a new adapter that needs GitHub auth just takes a `TokenProvider` in its constructor and calls `getToken('github.com')`. Use `token`-scheme headers for authenticated GitHub API requests, matching `packages/infra/src/adapters/github-adapter.ts`:

```typescript
headers['Authorization'] = `token ${token}`;
```

## Bundle Manifest Format

Bundles must include a `deployment-manifest.yml` file:

```yaml
version: "1.0"
id: "my-bundle"
name: "My Custom Bundle"
prompts:
  - id: "my-prompt"
    name: "My Prompt"
    type: "prompt"
    file: "prompts/my-prompt.prompt.md"
    tags: ["custom", "example"]
```

## Error Handling

`packages/infra` adapters have no logger dependency — they wrap the underlying error in a new `Error` with a descriptive, adapter-specific message and let it propagate; the caller (`RegistryManager`/`app`'s orchestration functions) is responsible for logging:

```typescript
async fetchBundles(): Promise<Bundle[]> {
    try {
        const response = await this.httpClient.fetch({ url: this.source.url });
        return parseBundles(response.body);
    } catch (error) {
        throw new Error(`Failed to fetch bundles from my-custom source: ${error instanceof Error ? error.message : error}`);
    }
}
```

## See Also

- [Architecture](../contributor-guide/architecture.md) — System architecture overview
- [Development Setup](../contributor-guide/development-setup.md) — Setting up the development environment
- [Testing](../contributor-guide/testing.md) — Testing strategies and patterns
