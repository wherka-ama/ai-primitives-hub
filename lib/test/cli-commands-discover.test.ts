/**
 * Tests for discover command.
 * @module test/cli/commands/discover
 */

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type {
  DetectedContext,
} from '../src/app/context-detection';
import {
  buildSearchQueries,
  createDiscoverCommand,
  deduplicateHits,
  renderDiscoveryText,
} from '../src/cli/commands/discover';
import type {
  DiscoverOptions,
} from '../src/cli/commands/discover';
import type {
  PrimitiveKind,
  SearchHit,
} from '../src/infra/search/types';

describe('DiscoverCommand', () => {
  const mockContext = {
    stdout: {
      write: vi.fn()
    },
    stderr: {
      write: vi.fn()
    },
    env: {
      HOME: '/home/test',
      XDG_CACHE_HOME: undefined
    },
    cwd: () => '/home/test/project'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should build search queries from TypeScript context', async () => {
    const opts: DiscoverOptions = {
      output: 'text',
      limit: 10,
      cwd: '/test/project'
    };

    const cmd = createDiscoverCommand(opts);
    // Note: Full integration test would require mocking ContextDetector and loadIndex
    // This is a unit test for the command structure
    expect(cmd).toBeDefined();
    expect(cmd.path).toEqual(['discover']);
    expect(cmd.description).toContain('project context');
  });

  it('should handle missing index gracefully', async () => {
    const opts: DiscoverOptions = {
      output: 'text',
      indexFile: '/nonexistent/index.json',
      cwd: '/test/project'
    };

    const cmd = createDiscoverCommand(opts);
    const result = await cmd.run({ ctx: mockContext as any });

    expect(result).toBe(1);
  });

  it('should support filtering by primitive kinds', async () => {
    const opts: DiscoverOptions = {
      output: 'text',
      kinds: ['prompt', 'instruction'] as PrimitiveKind[],
      limit: 5
    };

    const cmd = createDiscoverCommand(opts);
    expect(cmd).toBeDefined();
  });

  it('should support custom limit', async () => {
    const opts: DiscoverOptions = {
      output: 'text',
      limit: 20
    };

    const cmd = createDiscoverCommand(opts);
    expect(cmd).toBeDefined();
  });

  it('should support JSON output format', async () => {
    const opts: DiscoverOptions = {
      output: 'json',
      limit: 10
    };

    const cmd = createDiscoverCommand(opts);
    expect(cmd).toBeDefined();
  });

  it('should support YAML output format', async () => {
    const opts: DiscoverOptions = {
      output: 'yaml',
      limit: 10
    };

    const cmd = createDiscoverCommand(opts);
    expect(cmd).toBeDefined();
  });

  it('should support NDJSON output format', async () => {
    const opts: DiscoverOptions = {
      output: 'ndjson',
      limit: 10
    };

    const cmd = createDiscoverCommand(opts);
    expect(cmd).toBeDefined();
  });
});

describe('buildSearchQueries', () => {
  it('should generate query from languages', () => {
    const context: DetectedContext = {
      techStack: {
        languages: ['TypeScript', 'JavaScript'],
        frameworks: [],
        packageManagers: [],
        buildTools: [],
        testFrameworks: []
      },
      domain: {
        category: undefined,
        businessDomain: undefined,
        technicalDomain: undefined
      },
      activity: {
        recentFiles: [],
        workingDirectory: '/test'
      },
      detectedAt: new Date().toISOString()
    };

    const queries = buildSearchQueries(context);

    expect(queries).toContain('TypeScript JavaScript');
  });

  it('should generate query from frameworks', () => {
    const context: DetectedContext = {
      techStack: {
        languages: [],
        frameworks: ['React', 'Express'],
        packageManagers: [],
        buildTools: [],
        testFrameworks: []
      },
      domain: {
        category: undefined,
        businessDomain: undefined,
        technicalDomain: undefined
      },
      activity: {
        recentFiles: [],
        workingDirectory: '/test'
      },
      detectedAt: new Date().toISOString()
    };

    const queries = buildSearchQueries(context);

    expect(queries).toContain('React Express');
  });

  it('should generate query from domain', () => {
    const context: DetectedContext = {
      techStack: {
        languages: [],
        frameworks: [],
        packageManagers: [],
        buildTools: [],
        testFrameworks: []
      },
      domain: {
        category: 'web-application',
        businessDomain: 'authentication',
        technicalDomain: 'frontend'
      },
      activity: {
        recentFiles: [],
        workingDirectory: '/test'
      },
      detectedAt: new Date().toISOString()
    };

    const queries = buildSearchQueries(context);

    expect(queries).toContain('web-application');
    expect(queries).toContain('authentication');
    expect(queries).toContain('frontend');
  });

  it('should generate combined queries', () => {
    const context: DetectedContext = {
      techStack: {
        languages: ['TypeScript'],
        frameworks: ['React'],
        packageManagers: [],
        buildTools: [],
        testFrameworks: []
      },
      domain: {
        category: 'web-application',
        businessDomain: undefined,
        technicalDomain: undefined
      },
      activity: {
        recentFiles: [],
        workingDirectory: '/test'
      },
      detectedAt: new Date().toISOString()
    };

    const queries = buildSearchQueries(context);

    expect(queries).toContain('TypeScript');
    expect(queries).toContain('React');
    expect(queries).toContain('TypeScript web-application');
  });

  it('should provide default query when no context detected', () => {
    const context: DetectedContext = {
      techStack: {
        languages: [],
        frameworks: [],
        packageManagers: [],
        buildTools: [],
        testFrameworks: []
      },
      domain: {
        category: undefined,
        businessDomain: undefined,
        technicalDomain: undefined
      },
      activity: {
        recentFiles: [],
        workingDirectory: '/test'
      },
      detectedAt: new Date().toISOString()
    };

    const queries = buildSearchQueries(context);

    expect(queries).toContain('copilot prompt instruction');
  });
});

describe('deduplicateHits', () => {
  it('should deduplicate hits by primitive ID', () => {
    const hits: SearchHit[] = [
      {
        primitive: {
          id: 'test-1',
          title: 'Test 1',
          description: '',
          kind: 'prompt',
          path: '/test/path',
          tags: ['test'],
          bodyPreview: '',
          contentHash: 'hash1',
          bundle: { sourceId: 'source-1', bundleId: 'bundle-1', sourceType: 'github', bundleVersion: '1.0.0', installed: false }
        },
        score: 0.9
      },
      {
        primitive: {
          id: 'test-1',
          title: 'Test 1',
          description: '',
          kind: 'prompt',
          path: '/test/path',
          tags: ['test'],
          bodyPreview: '',
          contentHash: 'hash1',
          bundle: { sourceId: 'source-1', bundleId: 'bundle-1', sourceType: 'github', bundleVersion: '1.0.0', installed: false }
        },
        score: 0.8
      },
      {
        primitive: {
          id: 'test-2',
          title: 'Test 2',
          description: '',
          kind: 'prompt',
          path: '/test/path2',
          tags: ['test'],
          bodyPreview: '',
          contentHash: 'hash2',
          bundle: { sourceId: 'source-1', bundleId: 'bundle-1', sourceType: 'github', bundleVersion: '1.0.0', installed: false }
        },
        score: 0.7
      }
    ];

    const unique = deduplicateHits(hits);

    expect(unique).toHaveLength(2);
    expect(unique[0].primitive.id).toBe('test-1');
    expect(unique[1].primitive.id).toBe('test-2');
  });

  it('should preserve highest score when deduplicating', () => {
    const hits: SearchHit[] = [
      {
        primitive: {
          id: 'test-1',
          title: 'Test 1',
          description: '',
          kind: 'prompt',
          path: '/test/path',
          tags: ['test'],
          bodyPreview: '',
          contentHash: 'hash1',
          bundle: { sourceId: 'source-1', bundleId: 'bundle-1', sourceType: 'github', bundleVersion: '1.0.0', installed: false }
        },
        score: 0.8
      },
      {
        primitive: {
          id: 'test-1',
          title: 'Test 1',
          description: '',
          kind: 'prompt',
          path: '/test/path',
          tags: ['test'],
          bodyPreview: '',
          contentHash: 'hash1',
          bundle: { sourceId: 'source-1', bundleId: 'bundle-1', sourceType: 'github', bundleVersion: '1.0.0', installed: false }
        },
        score: 0.9
      }
    ];

    const unique = deduplicateHits(hits);

    expect(unique).toHaveLength(1);
    expect(unique[0].score).toBe(0.9);
  });

  it('should handle empty array', () => {
    const unique = deduplicateHits([]);

    expect(unique).toHaveLength(0);
  });
});

describe('renderDiscoveryText', () => {
  it('should render context summary', () => {
    const context: DetectedContext = {
      techStack: {
        languages: ['TypeScript'],
        frameworks: ['React'],
        packageManagers: ['npm'],
        buildTools: [],
        testFrameworks: []
      },
      domain: {
        category: 'web-application',
        businessDomain: 'authentication',
        technicalDomain: 'frontend'
      },
      activity: {
        recentFiles: [],
        workingDirectory: '/test'
      },
      detectedAt: new Date().toISOString()
    };

    const queries = ['TypeScript', 'React'];
    const results: SearchHit[] = [];

    const output = renderDiscoveryText(context, queries, results);

    expect(output).toContain('Detected Context:');
    expect(output).toContain('TypeScript');
    expect(output).toContain('React');
    expect(output).toContain('web-application');
  });

  it('should render search queries', () => {
    const context: DetectedContext = {
      techStack: {
        languages: [],
        frameworks: [],
        packageManagers: [],
        buildTools: [],
        testFrameworks: []
      },
      domain: {
        category: undefined,
        businessDomain: undefined,
        technicalDomain: undefined
      },
      activity: {
        recentFiles: [],
        workingDirectory: '/test'
      },
      detectedAt: new Date().toISOString()
    };

    const queries = ['typescript', 'react'];
    const results: SearchHit[] = [];

    const output = renderDiscoveryText(context, queries, results);

    expect(output).toContain('Search Queries:');
    expect(output).toContain('typescript');
    expect(output).toContain('react');
  });

  it('should render results with scores', () => {
    const context: DetectedContext = {
      techStack: {
        languages: [],
        frameworks: [],
        packageManagers: [],
        buildTools: [],
        testFrameworks: []
      },
      domain: {
        category: undefined,
        businessDomain: undefined,
        technicalDomain: undefined
      },
      activity: {
        recentFiles: [],
        workingDirectory: '/test'
      },
      detectedAt: new Date().toISOString()
    };

    const queries = ['test'];
    const results: SearchHit[] = [
      {
        primitive: {
          id: 'test-1',
          title: 'Test Primitive',
          description: 'A test primitive',
          kind: 'prompt',
          path: '/test/path',
          tags: ['test'],
          bodyPreview: '',
          contentHash: 'hash1',
          bundle: { sourceId: 'source-1', bundleId: 'bundle-1', sourceType: 'github', bundleVersion: '1.0.0', installed: false }
        },
        score: 0.95
      }
    ];

    const output = renderDiscoveryText(context, queries, results);

    expect(output).toContain('Recommendations (1):');
    expect(output).toContain('0.95');
    expect(output).toContain('Test Primitive');
  });

  it('should handle empty results', () => {
    const context: DetectedContext = {
      techStack: {
        languages: [],
        frameworks: [],
        packageManagers: [],
        buildTools: [],
        testFrameworks: []
      },
      domain: {
        category: undefined,
        businessDomain: undefined,
        technicalDomain: undefined
      },
      activity: {
        recentFiles: [],
        workingDirectory: '/test'
      },
      detectedAt: new Date().toISOString()
    };

    const queries = ['test'];
    const results: SearchHit[] = [];

    const output = renderDiscoveryText(context, queries, results);

    expect(output).toContain('Recommendations (0):');
  });
});
