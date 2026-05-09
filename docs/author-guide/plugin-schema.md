# Plugin Schema Reference

Plugin manifests (`.github/plugin/plugin.json`) define a Copilot plugin — a bundle of prompts, instructions, chat modes, agents, and skills — in the format introduced by [`github/awesome-copilot` PR #717](https://github.com/github/awesome-copilot/pull/717). Prompt Registry consumes this format alongside the older `.collection.yml` format, and extends it with MCP server support and display preferences.

Source of truth: [`schemas/plugin.schema.json`](../../schemas/plugin.schema.json).

## Directory Structure

```
my-plugin/
├── .github/plugin/
│   └── plugin.json                 # Manifest (required)
├── agents/
│   └── *.md                        # Agent markdown files
├── skills/
│   └── <skill-name>/
│       ├── SKILL.md                # Skill entry point (required per skill)
│       └── ...                     # Optional assets
└── prompts/                        # Optional
    └── *.prompt.md
```

## Annotated Example

```json
{
  "id": "azure-cloud-development",        // Optional. Lowercase, numbers, hyphens only
  "name": "Azure Cloud Development",      // Required. Human-readable (max 100 chars)
  "description": "Azure cloud dev tools", // Optional. What the plugin does (max 500 chars)
  "version": "1.0.0",                     // Optional. Semantic version
  "author": {                             // Optional. String ("Jane Doe") or object
    "name": "Cloud Team",
    "url": "https://example.com",
    "email": "cloud@example.com"
  },
  "license": "MIT",                       // Optional. License identifier
  "repository": "https://github.com/org/repo",  // Optional
  "homepage": "https://example.com/docs", // Optional
  "tags": ["azure", "cloud"],             // Optional. For discoverability
  "keywords": ["azure", "cloud"],         // Optional. Alias for tags (upstream format)

  // Two ways to list content — pick one:

  // A) Explicit items (Prompt Registry native format)
  "items": [
    { "kind": "skill",       "path": "./skills/resource-health" },
    { "kind": "agent",       "path": "./agents/architect.md" },
    { "kind": "prompt",      "path": "./prompts/review.prompt.md" },
    { "kind": "instruction", "path": "./instructions/style.instructions.md" },
    { "kind": "chat-mode",   "path": "./chatmodes/debug.chatmode.md" }
  ],

  // B) Upstream awesome-copilot arrays (directory-based)
  "agents": ["./agents"],                 // Directory with flat .md files, one agent per file
  "skills": [                             // Each path is a directory containing SKILL.md
    "./skills/resource-health",
    "./skills/diagnose-failure"
  ],

  // MCP server configurations — two equivalent formats, pick one:

  // Format A) Top-level mcpServers (compatible with collection format)
  "mcpServers": {
    "azure-tools": {
      "type": "stdio",
      "command": "node",
      "args": ["${bundlePath}/server.js"]
    }
  },

  // Format B) Nested under mcp.items (Prompt Registry native format)
  "mcp": {
    "items": {
      "azure-tools": {
        "type": "stdio",
        "command": "node",
        "args": ["${bundlePath}/server.js"]
      }
    }
  },

  "display": {                            // Optional. UI preferences
    "ordering": "alphabetical",           // manual | alphabetical
    "show_badge": true
  },

  "external": false,                      // Optional. true = content hosted elsewhere; skipped by adapters
  "featured": false                       // Optional
}
```

## Item Kinds

| `kind` | Mapped to `type` in deployment manifest | Typical path |
|--------|-----------------------------------------|--------------|
| `prompt` | `prompt` | `./prompts/*.prompt.md` |
| `instruction` | `instructions` | `./instructions/*.instructions.md` |
| `chat-mode` | `chatmode` | `./chatmodes/*.chatmode.md` |
| `agent` | `agent` | `./agents/*.md` or `./agents/<name>/AGENT.md` |
| `skill` | `skill` | `./skills/<name>/SKILL.md` |

## Upstream Format: Directory Resolution

When you use the `agents` / `skills` arrays instead of `items`, the adapter resolves directory references as follows:

- **Skill refs** (`./skills/<name>`) — always treated as a directory whose `SKILL.md` is the entry file. Every file inside the directory (including `assets/`, `references/`) is archived.
- **Agent refs** — three patterns:
  1. **Specific file** (`./agents/code-reviewer.md`) — one agent, id derived from filename.
  2. **Directory with `AGENT.md`** (`./agents/advisor/` containing `AGENT.md`) — one agent, all files archived, id = directory name.
  3. **Flat directory** (`./agents/` containing multiple `.md` files, no `AGENT.md`) — one agent per `.md` file (`README.md` is skipped).

## MCP Server Support

Both `mcpServers` (top-level, collection-format compatible) and `mcp.items` (nested, Prompt Registry native) are supported. If both are present, `mcpServers` takes precedence. The adapter stores MCP server configurations in the `deployment-manifest.yml` under the `mcpServers` key, where `McpServerManager` picks them up at install time.

MCP servers declared under either format follow the same identity + duplicate-detection rules as collections. See the [MCP section of Collection Schema](./collection-schema.md#mcp-server-duplicate-detection).

## Validation

Run `Ctrl+Shift+P` → "Prompt Registry: Validate Plugins" — validates every `plugins/<id>/.github/plugin/plugin.json` in the open workspace against [`schemas/plugin.schema.json`](../../schemas/plugin.schema.json), checks that referenced paths exist, and flags duplicate plugin ids.

Run `Ctrl+Shift+P` → "Prompt Registry: List All Plugins" — prints a summary of every discovered plugin without running validation.

## Testing Locally

1. Add a local source: `Ctrl+Shift+P` → "Add Source" → `local-awesome-copilot-plugin`
2. Enter the path to the directory that contains `plugins/<id>/.github/plugin/plugin.json`
3. Plugins appear in Registry Explorer; install them like any other bundle

## See Also

- [Collection Schema](./collection-schema.md) — The older YAML-based format
- [Creating Collections](./creating-source-bundle.md) — Parallel guide for the collection format
- [Publishing](./publishing.md) — Distribute your plugins
