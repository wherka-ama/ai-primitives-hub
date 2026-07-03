import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  AwesomeCopilotBundleResolver,
} from '../../src/resolvers/awesome-copilot-resolver';
import {
  FakeHttpClient,
} from '../helpers/fake-http-client';

const mockTokenProvider = {
  getToken: async (): Promise<string | undefined> => undefined
};

describe('AwesomeCopilotBundleResolver', () => {
  it('returns null when collection file not found', async () => {
    const http = new FakeHttpClient().addRoute({
      url: 'https://raw.githubusercontent.com/test/repo/main/collections/test.collection.yml',
      status: 404
    });
    const resolver = new AwesomeCopilotBundleResolver({
      repoSlug: 'test/repo',
      http,
      tokens: mockTokenProvider
    });

    const result = await resolver.resolve({ bundleId: 'test', bundleVersion: 'latest' });
    expect(result).toBeNull();
  });

  it('returns null when collection has no items', async () => {
    const http = new FakeHttpClient().addRoute({
      url: 'https://raw.githubusercontent.com/test/repo/main/collections/test.collection.yml',
      status: 200,
      body: 'id: test\nname: Test\nitems: []'
    });
    const resolver = new AwesomeCopilotBundleResolver({
      repoSlug: 'test/repo',
      http,
      tokens: mockTokenProvider
    });

    const result = await resolver.resolve({ bundleId: 'test', bundleVersion: 'latest' });
    expect(result).toBeNull();
  });

  it('returns null when collection YAML is invalid', async () => {
    const http = new FakeHttpClient().addRoute({
      url: 'https://raw.githubusercontent.com/test/repo/main/collections/test.collection.yml',
      status: 200,
      body: 'invalid: yaml: [unclosed'
    });
    const resolver = new AwesomeCopilotBundleResolver({
      repoSlug: 'test/repo',
      http,
      tokens: mockTokenProvider
    });

    const result = await resolver.resolve({ bundleId: 'test', bundleVersion: 'latest' });
    expect(result).toBeNull();
  });

  it('builds zip bundle with collection items', async () => {
    const http = new FakeHttpClient()
      .addRoute({
        url: 'https://raw.githubusercontent.com/test/repo/main/collections/test.collection.yml',
        status: 200,
        body: 'id: test\nname: Test\nitems:\n  - path: prompts/test.md\n    kind: prompt'
      })
      .addRoute({
        url: 'https://raw.githubusercontent.com/test/repo/main/prompts/test.md',
        status: 200,
        body: '# Test Prompt'
      });
    const resolver = new AwesomeCopilotBundleResolver({
      repoSlug: 'test/repo',
      http,
      tokens: mockTokenProvider
    });

    const result = await resolver.resolve({ bundleId: 'test', bundleVersion: 'latest' });
    expect(result).not.toBeNull();
    expect(result?.inlineBytes).toBeDefined();
    if (result?.inlineBytes) {
      expect(result.inlineBytes.length).toBeGreaterThan(0);
    }
    expect(result?.ref.bundleId).toBe('test');
    expect(result?.ref.sourceType).toBe('awesome-copilot');
  });

  it('skips missing items', async () => {
    const http = new FakeHttpClient()
      .addRoute({
        url: 'https://raw.githubusercontent.com/test/repo/main/collections/test.collection.yml',
        status: 200,
        body: 'id: test\nname: Test\nitems:\n  - path: prompts/test.md\n    kind: prompt\n  - path: prompts/missing.md\n    kind: prompt'
      })
      .addRoute({
        url: 'https://raw.githubusercontent.com/test/repo/main/prompts/test.md',
        status: 200,
        body: '# Test Prompt'
      })
      .addRoute({
        url: 'https://raw.githubusercontent.com/test/repo/main/prompts/missing.md',
        status: 404
      });
    const resolver = new AwesomeCopilotBundleResolver({
      repoSlug: 'test/repo',
      http,
      tokens: mockTokenProvider
    });

    const result = await resolver.resolve({ bundleId: 'test', bundleVersion: 'latest' });
    expect(result).not.toBeNull();
    expect(result?.inlineBytes).toBeDefined();
    if (result?.inlineBytes) {
      expect(result.inlineBytes.length).toBeGreaterThan(0);
    }
  });

  it('uses custom branch', async () => {
    const http = new FakeHttpClient()
      .addRoute({
        url: 'https://raw.githubusercontent.com/test/repo/develop/collections/test.collection.yml',
        status: 200,
        body: 'id: test\nname: Test\nitems:\n  - path: prompts/test.md\n    kind: prompt'
      })
      .addRoute({
        url: 'https://raw.githubusercontent.com/test/repo/develop/prompts/test.md',
        status: 200,
        body: '# Test Prompt'
      });
    const resolver = new AwesomeCopilotBundleResolver({
      repoSlug: 'test/repo',
      branch: 'develop',
      http,
      tokens: mockTokenProvider
    });

    const result = await resolver.resolve({ bundleId: 'test', bundleVersion: 'latest' });
    expect(result).not.toBeNull();
  });

  it('uses custom collections path', async () => {
    const http = new FakeHttpClient()
      .addRoute({
        url: 'https://raw.githubusercontent.com/test/repo/main/custom-collections/test.collection.yml',
        status: 200,
        body: 'id: test\nname: Test\nitems:\n  - path: prompts/test.md\n    kind: prompt'
      })
      .addRoute({
        url: 'https://raw.githubusercontent.com/test/repo/main/prompts/test.md',
        status: 200,
        body: '# Test Prompt'
      });
    const resolver = new AwesomeCopilotBundleResolver({
      repoSlug: 'test/repo',
      collectionsPath: 'custom-collections',
      http,
      tokens: mockTokenProvider
    });

    const result = await resolver.resolve({ bundleId: 'test', bundleVersion: 'latest' });
    expect(result).not.toBeNull();
  });

  it('quotes manifest name with special characters', async () => {
    const http = new FakeHttpClient()
      .addRoute({
        url: 'https://raw.githubusercontent.com/test/repo/main/collections/test.collection.yml',
        status: 200,
        body: 'id: test\nname: Test\'s Collection\nitems:\n  - path: prompts/test.md\n    kind: prompt'
      })
      .addRoute({
        url: 'https://raw.githubusercontent.com/test/repo/main/prompts/test.md',
        status: 200,
        body: '# Test Prompt'
      });
    const resolver = new AwesomeCopilotBundleResolver({
      repoSlug: 'test/repo',
      http,
      tokens: mockTokenProvider
    });

    const result = await resolver.resolve({ bundleId: 'test', bundleVersion: 'latest' });
    expect(result).not.toBeNull();
  });

  it('uses collection id when present', async () => {
    const http = new FakeHttpClient()
      .addRoute({
        url: 'https://raw.githubusercontent.com/test/repo/main/collections/test.collection.yml',
        status: 200,
        body: 'id: custom-id\nname: Test\nitems:\n  - path: prompts/test.md\n    kind: prompt'
      })
      .addRoute({
        url: 'https://raw.githubusercontent.com/test/repo/main/prompts/test.md',
        status: 200,
        body: '# Test Prompt'
      });
    const resolver = new AwesomeCopilotBundleResolver({
      repoSlug: 'test/repo',
      http,
      tokens: mockTokenProvider
    });

    const result = await resolver.resolve({ bundleId: 'test', bundleVersion: 'latest' });
    expect(result).not.toBeNull();
    expect(result?.ref.bundleId).toBe('test'); // bundleId from spec
  });

  it('throws on HTTP errors other than 404', async () => {
    const http = new FakeHttpClient().addRoute({
      url: 'https://raw.githubusercontent.com/test/repo/main/collections/test.collection.yml',
      status: 500
    });
    const resolver = new AwesomeCopilotBundleResolver({
      repoSlug: 'test/repo',
      http,
      tokens: mockTokenProvider
    });

    await expect(resolver.resolve({ bundleId: 'test', bundleVersion: 'latest' }))
      .rejects.toThrow('raw fetch 500');
  });

  it('uses token from token provider', async () => {
    const tokenProvider = {
      getToken: async (): Promise<string | undefined> => 'test-token'
    };
    const http = new FakeHttpClient()
      .addRoute({
        url: 'https://raw.githubusercontent.com/test/repo/main/collections/test.collection.yml',
        status: 200,
        body: 'id: test\nname: Test\nitems:\n  - path: prompts/test.md\n    kind: prompt'
      })
      .addRoute({
        url: 'https://raw.githubusercontent.com/test/repo/main/prompts/test.md',
        status: 200,
        body: '# Test Prompt'
      });

    const resolver = new AwesomeCopilotBundleResolver({
      repoSlug: 'test/repo',
      http,
      tokens: tokenProvider
    });

    const result = await resolver.resolve({ bundleId: 'test', bundleVersion: 'latest' });
    expect(result).not.toBeNull();
    for (const call of http.calls) {
      expect(call.headers?.Authorization).toBe('Bearer test-token');
    }
  });
});
