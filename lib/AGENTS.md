# Copilot Instructions for lib/ Contributors

Library: `@prompt-registry/collection-scripts` — Shared scripts for building, validating, and publishing Copilot prompt collections.

**🚨 MANDATORY FIRST STEP: Read Folder-Specific Guidance BEFORE Writing Code 🚨**

Before working in any folder, **MUST READ** the corresponding AGENTS.md file:

| Working in... | Read first |
|---------------|------------|
| `src/cli/` | `src/cli/AGENTS.md` — CLI framework, command patterns, argument parsing |
| `src/domain/` | `src/domain/AGENTS.md` — Domain layer invariants, type definitions |
| `src/app/` | `src/app/AGENTS.md` — Application layer use cases |
| `src/infra/` | `src/infra/AGENTS.md` — Infrastructure layer implementations |
| `test/` | `test/AGENTS.md` — Test patterns, fixtures, mocking strategies |
| `test/cli/` | `test/cli/AGENTS.md` — CLI testing patterns, framework testing |

---

## Quick Context

### What is this library?

A Node.js/TypeScript library providing:
- **CLI tools** for collection validation, bundle building, and publishing
- **Primitive Index** — LLM-free search engine over agentic primitives (prompts, skills, agents, etc.)
- **Installation system** — Local bundle installation with target management
- **GitHub integration** — Hub harvesting, release analysis

### Key Architecture Layers (Clean Architecture)

```
src/
├── app/              → Application layer (use cases)
│   ├── collection/   → Collection management use cases
│   ├── harvest/      → Harvesting use cases
│   ├── install/      → Installation pipeline use cases
│   ├── registry/     → Registry management use cases
│   └── search/       → Search use cases
├── cli/              → CLI framework + commands (commands/, framework/)
├── domain/           → Core types: bundles, primitives, hubs, registry config
│   ├── bundle/       → Bundle types and validation
│   ├── collection/   → Collection types and validation
│   ├── hub/          → Hub configuration types
│   ├── install/      → Installation types
│   ├── primitive/    → Primitive index types
│   ├── registry/     → Registry configuration types
│   ├── skill/        → Skill types and validation
│   └── source/       → Source reference types
├── infra/            → Infrastructure implementations
│   ├── checksum/     → Checksum utilities
│   ├── downloaders/  → Bundle downloaders
│   ├── extractors/   → Bundle extractors
│   ├── fs/           → Filesystem adapter
│   ├── github/       → GitHub API client, asset fetching
│   ├── harvest/      → Harvesting infrastructure
│   ├── http/         → HTTP client adapter
│   ├── resolvers/    → Bundle resolvers
│   ├── search/       → Search infrastructure
│   ├── stores/       → Storage implementations
│   └── writers/      → Target writers
├── ports/            → Port interfaces
│   ├── bundle-downloader.ts
│   ├── bundle-extractor.ts
│   ├── clock.ts
│   ├── filesystem.ts
│   ├── github-api.ts
│   ├── http.ts
│   ├── index-store.ts
│   ├── index.ts
│   ├── source-resolver.ts
│   └── target-writer.ts
└── public/           → Public API surface
```

### Build & Test Commands

```bash
cd lib
npm install                    # Install dependencies
npm run build                  # Compile to dist/
npm test                       # Run vitest tests
npm run lint                   # ESLint (v9 flat config)
npm run lint:report            # Generate eslint-report.json
```

---

## Development Methodology

### Bug Fixes: Test First

1. **Reproduce first**: Create a failing test in `test/`
2. **Confirm failure**: Run `npm test`, verify it fails
3. **Fix the code**: Make minimal change in `src/`
4. **Confirm fix**: Run `npm test`, verify it passes
5. **No regression**: Run related tests

### Testing Conventions

- Tests use vitest (no compilation step required)
- Use `expect` assertions from vitest
- HTTP mocking with `nock`
- File system with temporary directories
- See `test/AGENTS.md` for detailed patterns

### Code Style

- **Strict TypeScript**: Enable all strict flags
- **Naming**: camelCase for variables/functions, PascalCase for types/classes
- **CLI flags**: kebab-case (`--collection-file`)
- **Comments**: JSDoc for public APIs, inline for complex logic
- **ESLint**: v9 flat config, zero warnings policy for errors

---

## Project Conventions

### Domain Layer Invariants

**CRITICAL**: Domain layer (`src/domain/`) cannot import from feature layers (app/, infra/, cli/).

```typescript
// ✅ OK: domain imports domain
import { BundleManifest } from '../bundle/types';

// ❌ FORBIDDEN: domain importing from infra
import { FileSystem } from '../../infra/fs';
```

Enforced by custom ESLint rule `no-feature-imports-in-domain`.

### CLI Framework Invariants

CLI commands in `src/cli/commands/` cannot import VS Code or other framework-specific modules:

```typescript
// ❌ FORBIDDEN in cli/commands/
import * as vscode from 'vscode';
```

Use the framework abstraction in `src/cli/framework/` instead.

### Type Exports

Public API is curated through `src/public/` and re-exported via `src/index.ts`:

```typescript
// Public API surface
export type { BundleManifest, Primitive } from './public';

// Namespace exports for organization
export * as domain from './domain';
export * as app from './app';
export * as infra from './infra';
export * as ports from './ports';
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/cli/main.ts` | CLI composition root, command registration |
| `src/cli/framework/` | CLI framework (Context, OutputStream, errors) |
| `src/app/install/pipeline.ts` | Installation pipeline use case |
| `src/infra/search/primitive-index.ts` | PrimitiveIndex class — main search API |
| `src/infra/stores/` | Storage implementations (YAML stores, lockfile, etc.) |
| `src/domain/bundle/types.ts` | Core bundle type definitions |
| `src/infra/github/` | GitHub API client, asset fetching |
| `src/domain/collection/validate.ts` | Collection validation logic |

---

## Documentation

- **README.md** — Usage guide, CLI reference, API examples
- **PRIMITIVE_INDEX_DESIGN.md** — Full design of the search engine
- **AGENTS.md** (this file) — AI assistant guidance
- **Nested AGENTS.md** — Folder-specific patterns (see table above)

---

## What to Avoid

- Don't add dependencies without justification — keep library lightweight
- Don't use `any` — use `unknown` with type guards
- Don't duplicate validation logic — use `src/validate.ts`
- Don't break domain layer invariants — no feature imports in domain
- Don't use sync file operations in async contexts

---

## Integration Points

| Integration | Pattern |
|-------------|---------|
| **GitHub API** | `GitHubClient` class with rate limit handling |
| **File System** | `Context.fs` abstraction for testability |
| **HTTP** | `axios` with retry logic via `p-limit` |
| **ZIP** | `adm-zip` for bundle extraction |
| **YAML** | `js-yaml` for manifest parsing |

---

## Migration Notes

- Legacy `bin/*.js` scripts are deprecated in favor of unified `prompt-registry` CLI
- See Phase 4/5 documentation for migration paths
- Maintain backward compatibility during deprecation period
