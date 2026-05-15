# Copilot SDK Integration for Context-Aware Resource Discovery

## Overview

This document describes a comprehensive solution for integrating GitHub Copilot SDK into the prompt-registry CLI to enable context-aware resource discovery. The goal is to allow users to describe their context and intended workflow, and have the system intelligently recommend and prepare the right resources (bundles, profiles, primitives) for their needs.

## Problem Statement

Current workflow for resource discovery is complex and requires deep knowledge:
- Users must know what they're looking for (bundle IDs, profile names)
- Search requires 8+ steps (index build → search → shortlist → export → add to hub → sync → activate)
- No guidance on what resources are appropriate for a given context
- No way to discover resources based on work context (tech stack, domain, activity type)

## Proposed Solution

Integrate Copilot SDK to create an AI-assisted workflow:
1. User describes their context (tech stack, domain, intended activity)
2. Copilot analyzes the context and recommends relevant resources
3. Interactive multi-selection UI for reviewing and confirming selections
4. Generate profile/lockfile for review
5. One-click activation

## Copilot SDK Capabilities

Based on research of copilot-sdk documentation:

### Custom Skills
- Skills are reusable prompt modules that extend Copilot's capabilities
- Loaded from directories containing SKILL.md files
- Injected into session context when loaded
- Can be enabled/disabled per session

### Custom Agents
- Support for custom agents and sub-agent orchestration
- Allows specialized agents for different tasks

### MCP Servers
- Model Context Protocol support for tool integration
- Enables external tool calls from Copilot

### Streaming & Hooks
- Streaming responses for real-time feedback
- Hooks for customizing behavior at key points in conversation lifecycle

## Architecture Design

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Interface (CLI)                          │
│  prompt-registry discover --interactive                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Context Gathering Layer                          │
│  - Tech stack detection (package.json, pom.xml, etc.)            │
│  - Domain inference (project structure, file types)               │
│  - Activity type (user input + optional auto-detection)          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Copilot SDK Integration                         │
│  - Session with custom skills (resource-discovery skill)         │
│  - Context injection (tech stack, domain, activity)              │
│  - Streaming responses for real-time recommendations             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Resource Recommendation Engine                         │
│  - Search across hubs, local bundles, primitive index           │
│  - Rank by relevance (context match, popularity, recency)        │
│  - Categorize by type (profile, bundle, primitive)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Interactive Selection UI                          │
│  - Multi-select with preview                                    │
│  - Category filters (profiles, bundles, primitives)             │
│  - Relevance ranking display                                     │
│  - "Select all" and "Select recommended" shortcuts             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Profile/Lockfile Generation                          │
│  - Generate profile YAML from selections                         │
│  - Generate lockfile with version info                           │
│  - Show preview (dry-run) before applying                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Activation                                  │
│  - Add profile to hub (optional)                                 │
│  - Sync hub                                                       │
│  - Activate profile on target                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Custom Skill Design

### Skill: Resource Discovery

Location: `skills/resource-discovery/SKILL.md`

```markdown
---
title: Resource Discovery Assistant
description: Helps users discover and select prompt-registry resources based on their context
user_invocable: true
disable_model_invocation: false
---

# Resource Discovery Assistant

You are a specialized assistant for discovering prompt-registry resources (profiles, bundles, primitives) based on user context.

## Your Capabilities

You have access to:
- Hub configurations (profiles, bundles from various sources)
- Primitive index (searchable index of prompts, skills, agents)
- User context (tech stack, domain, intended activity)

## Workflow

1. **Understand Context**: Analyze the user's tech stack, domain, and intended activity
2. **Search Resources**: Query the available resources (hubs, index) for relevant matches
3. **Rank Results**: Rank by relevance to the user's context
4. **Present Recommendations**: Present categorized results with explanations
5. **Refine**: Allow user to refine their requirements and re-rank

## Output Format

Return recommendations in the following JSON structure:

```json
{
  "recommendations": [
    {
      "type": "profile|bundle|primitive",
      "id": "resource-id",
      "name": "Resource Name",
      "description": "Brief description",
      "relevance_score": 0.95,
      "reasoning": "Why this is relevant to the user's context",
      "source": "hub-id|local|github-repo"
    }
  ],
  "categories": {
    "profiles": ["profile-id-1", "profile-id-2"],
    "bundles": ["bundle-id-1", "bundle-id-2"],
    "primitives": ["primitive-id-1", "primitive-id-2"]
  },
  "summary": "Brief summary of recommendations"
}
```

## Example Interaction

User: "I'm working on a Java microservice using Spring Boot and need to implement code reviews"

Your response should:
1. Identify tech stack: Java, Spring Boot
2. Identify domain: Microservices
3. Identify activity: Code review
4. Search for relevant resources (e.g., "code-review" profiles, "spring-boot" bundles)
5. Present ranked recommendations with reasoning
```

## MCP Server Design

### Tool: Resource Search

MCP tool for searching prompt-registry resources:

```typescript
{
  "name": "search_resources",
  "description": "Search for prompt-registry resources (profiles, bundles, primitives)",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query"
      },
      "type": {
        "type": "string",
        "enum": ["profile", "bundle", "primitive", "all"],
        "description": "Resource type to search"
      },
      "context": {
        "type": "object",
        "properties": {
          "techStack": {
            "type": "array",
            "items": {"type": "string"}
          },
          "domain": {
            "type": "string"
          },
          "activity": {
            "type": "string"
          }
        }
      }
    }
  }
}
```

## CLI Command Design

### Command: `prompt-registry discover`

```bash
# Interactive mode (default)
prompt-registry discover

# Non-interactive with context
prompt-registry discover \
  --tech-stack java,spring-boot \
  --domain microservices \
  --activity "code review"

# Auto-apply recommendations
prompt-registry discover --auto-apply

# Generate profile only (don't activate)
prompt-registry discover --generate-profile my-custom-profile

# Add to existing hub
prompt-registry discover --hub amadeus-hub
```

### Interactive Flow

```bash
$ prompt-registry discover

? What are you working on today? 
  (1) Backend development
  (2) Frontend development
  (3) DevOps/Infrastructure
  (4) Data engineering
  (5) Custom description

? What's your tech stack? (auto-detected: Java, Spring Boot, Maven)
  [x] Java
  [x] Spring Boot
  [ ] React
  [ ] Python
  [ ] Other: _______

? What's your primary activity?
  (1) New feature development
  (2) Code review
  (3) Debugging
  (4) Documentation
  (5) Testing

Analyzing your context...
[████████████████████████████] 100%

Based on your context (Java, Spring Boot, Code Review), I found 12 relevant resources:

PROFILES (3):
  [★] Backend Developer (amadeus-hub)
      Relevance: 95%
      3 bundles · 12 files
      Ideal for backend development workflows
      [ ] Select

  [★] Code Review Specialist (amadeus-hub)
      Relevance: 92%
      2 bundles · 8 files
      Specialized for code review activities
      [ ] Select

  [ ] Java Developer (community-hub)
      Relevance: 85%
      4 bundles · 15 files
      General Java development
      [ ] Select

BUNDLES (5):
  [★] spring-boot-skills (github:Amadeus-xDLC/spring-boot-skills)
      Relevance: 98%
      5 primitives
      Spring Boot specific prompts and skills
      [ ] Select

  [★] code-review-prompts (github:Amadeus-xDLC/code-review)
      Relevance: 95%
      3 primitives
      Code review focused prompts
      [ ] Select

  [ ] microservice-patterns (github:Amadeus-xDLC/microservice-patterns)
      Relevance: 88%
      7 primitives
      Microservice architecture patterns
      [ ] Select

PRIMITIVES (4):
  [★] spring-boot-architecture-check (primitive-index)
      Relevance: 90%
      Kind: prompt
      Spring Boot architecture validation
      [ ] Select

  [ ] code-review-checklist (primitive-index)
      Relevance: 85%
      Kind: prompt
      Code review checklist
      [ ] Select

Select resources (use arrows, space to toggle, enter to confirm):
  [x] Backend Developer (profile)
  [x] Code Review Specialist (profile)
  [x] spring-boot-skills (bundle)
  [x] code-review-prompts (bundle)
  [ ] spring-boot-architecture-check (primitive)

Actions:
  [A] Select all recommended
  [N] Select none
  [R] Refine search
  [Enter] Confirm and generate profile
```

## Context Detection

### Auto-Detection Strategies

1. **Tech Stack Detection**
   - Read `package.json` (Node.js)
   - Read `pom.xml` (Maven/Java)
   - Read `build.gradle` (Gradle)
   - Read `requirements.txt` (Python)
   - Read `Cargo.toml` (Rust)
   - Read `go.mod` (Go)

2. **Domain Inference**
   - Analyze directory structure
   - Check for common patterns (e.g., `src/main/java` → Java backend)
   - Analyze file extensions (`.java`, `.ts`, `.py`, etc.)

3. **Activity Detection**
   - Git branch name (e.g., `feature/` → new feature, `bugfix/` → debugging)
   - Recent file changes
   - Open files in IDE (if available via extension)

### Context Schema

```typescript
interface UserContext {
  techStack: string[];
  domain: string;
  activity: string;
  projectType: string;
  additionalContext?: string;
}
```

## Profile Generation

### Generated Profile Structure

```yaml
id: ai-discovered-custom-profile
name: Custom Profile (AI-Generated)
description: Profile generated based on your context: Java, Spring Boot, Code Review
icon: 🤖
path:
  - Roles
  - Developer
  - Code Review
bundles:
  - id: Backend-Developer
    version: latest
    source: amadeus-hub
    required: true
  - id: Code-Review-Specialist
    version: latest
    source: amadeus-hub
    required: true
  - id: spring-boot-skills
    version: v1.2.0
    source: github:Amadeus-xDLC/spring-boot-skills
    required: true
  - id: code-review-prompts
    version: v1.0.5
    source: github:Amadeus-xDLC/code-review
    required: true
```

### Lockfile Generation

```json
{
  "schemaVersion": 1,
  "useProfile": {
    "profileId": "ai-discovered-custom-profile",
    "activatedAt": "2026-05-15T18:30:00Z"
  },
  "entries": [
    {
      "target": "my-target",
      "sourceId": "amadeus-hub",
      "bundleId": "Backend-Developer",
      "bundleVersion": "latest",
      "installedAt": "2026-05-15T18:30:00Z",
      "files": [...],
      "fileChecksums": {}
    },
    ...
  ]
}
```

## Implementation Phases

### Phase 1: Foundation (P0)
- Implement context detection layer
- Create resource-discovery custom skill
- Implement basic Copilot SDK integration
- Add `discover` command stub

### Phase 2: Search & Rank (P1)
- Implement resource search across hubs and index
- Implement relevance ranking algorithm
- Add MCP server for resource search tool
- Implement recommendation generation

### Phase 3: Interactive UI (P1)
- Implement multi-selection UI using enquirer
- Add category filters
- Implement preview functionality
- Add "select all" and "select recommended" shortcuts

### Phase 4: Profile Generation (P2)
- Implement profile generation from selections
- Implement lockfile generation
- Add dry-run preview
- Add profile activation flow

### Phase 5: Refinement (P3)
- Add "refine search" feature
- Implement learning from user selections
- Add history of discoveries
- Implement collaborative filtering (if multiple users)

## Industry Patterns Reference

### 1. Vercel CLI (`vercel init`)
- Interactive project setup with context detection
- Multi-select framework selection
- Preview before deployment

### 2. GitHub CLI (`gh repo create`)
- Auto-detects from current directory
- Interactive prompts with smart defaults
- Preview before creation

### 3. AWS CDK (`cdk init`)
- Language detection
- Template selection
- Interactive configuration

### 4. Docker Compose (interactive mode)
- Service selection
- Configuration preview
- One-line apply

## Best Practices

1. **Progressive Disclosure**: Show most relevant results first, allow drill-down
2. **Smart Defaults**: Auto-detect context, provide reasonable defaults
3. **Preview Before Apply**: Always show what will happen before applying changes
4. **Easy Undo**: Allow deactivation/reversion
5. **Explain Recommendations**: Show reasoning for each recommendation
6. **Allow Refinement**: Let users refine their requirements iteratively
7. **Multi-Select**: Support selecting multiple resources at once
8. **Keyboard Navigation**: Full keyboard support for power users

## Technical Considerations

### Copilot SDK Integration

```typescript
import { CopilotClient } from "@github/copilot-sdk";

class ResourceDiscoveryService {
  private client: CopilotClient;
  private skillPath: string;

  constructor() {
    this.client = new CopilotClient();
    this.skillPath = path.join(__dirname, 'skills', 'resource-discovery');
  }

  async discoverResources(context: UserContext): Promise<ResourceRecommendation[]> {
    const session = await this.client.createSession({
      model: "gpt-4.1",
      skillDirectories: [this.skillPath],
      onPermissionRequest: async () => ({ kind: "approved" }),
    });

    const prompt = this.buildDiscoveryPrompt(context);
    const response = await session.sendAndWait({ prompt });
    
    return this.parseRecommendations(response);
  }
}
```

### Performance Considerations

- Cache hub sync results to avoid repeated API calls
- Index search should be fast (BM25 is efficient)
- Copilot API calls are async, show progress indicator
- Stream responses for real-time feedback

### Error Handling

- Graceful fallback if Copilot API is unavailable
- Provide manual search option if AI fails
- Clear error messages with actionable hints
- Retry logic for transient failures

## Success Metrics

1. **Time to First Value**: Reduce from 8+ steps to 1-2 steps
2. **Discovery Accuracy**: Measure relevance of AI recommendations
3. **User Satisfaction**: Survey users on recommendation quality
4. **Adoption Rate**: Track how many users use discover vs manual search
5. **Profile Quality**: Measure how often generated profiles are activated without modification

## Next Steps

1. Implement Phase 1 (Foundation)
2. Create custom skill for resource discovery
3. Implement context detection layer
4. Add basic discover command
5. Test with real users and iterate
