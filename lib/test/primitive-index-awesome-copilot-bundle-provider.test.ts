import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import type {
  HubSourceSpec,
} from '../src/domain';
import {
  BlobCache,
  computeGitBlobSha,
} from '../src/infra/github/blob-cache';
import {
  type FetchLike,
  GitHubClient,
} from '../src/infra/github/client';
import {
  staticTokenProvider,
} from '../src/infra/github/token';
import {
  AwesomeCopilotBundleProvider,
} from '../src/infra/harvest/bundle-providers/awesome-copilot-bundle-provider';

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-acprov-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function jsonResp(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function makeSpec(): HubSourceSpec {
  return {
    id: 'src-a',
    name: 'Src A',
    type: 'awesome-copilot',
    url: 'https://github.com/o/r',
    owner: 'o',
    repo: 'r',
    branch: 'main',
    collectionsPath: 'collections'
  };
}

function fakeGithubFetch(opts: {
  commitSha: string;
  collectionFiles: { name: string; content: string }[];
  tree: { path: string; sha: string; size: number }[];
  blobs: Map<string, Buffer>;
}): FetchLike {
  return async (req) => {
    const url = new URL(req.url);
    if (/\/commits\/[^/]+$/.test(url.pathname)) {
      return jsonResp({ sha: opts.commitSha });
    }
    if (url.pathname.endsWith(`/git/trees/${opts.commitSha}`) && url.searchParams.get('recursive') === '1') {
      return jsonResp({
        sha: opts.commitSha,
        truncated: false,
        tree: opts.tree.map((t) => ({ path: t.path, type: 'blob', sha: t.sha, size: t.size }))
      });
    }
    const blobMatch = url.pathname.match(/\/git\/blobs\/([a-f0-9]+)$/);
    if (blobMatch) {
      const sha = blobMatch[1];
      const bytes = opts.blobs.get(sha);
      if (!bytes) {
        return jsonResp({ message: 'not found' }, 404);
      }
      return jsonResp({ sha, size: bytes.length, content: bytes.toString('base64'), encoding: 'base64' });
    }
    if (url.hostname === 'raw.githubusercontent.com') {
      const pathMatch = url.pathname.match(/\/o\/r\/main\/(.+)$/);
      if (pathMatch) {
        const relPath = pathMatch[1];
        const collectionFile = opts.collectionFiles.find((c) => c.name === relPath);
        if (collectionFile) {
          return new Response(collectionFile.content, { status: 200, headers: { 'content-type': 'text/plain' } });
        }
        const treeEntry = opts.tree.find((t) => t.path === relPath);
        if (treeEntry) {
          const bytes = opts.blobs.get(treeEntry.sha);
          if (bytes) {
            return new Response(new Uint8Array(bytes), { status: 200, headers: { 'content-type': 'text/plain' } });
          }
        }
      }
      return jsonResp({ message: 'not found' }, 404);
    }
    if (url.hostname === 'api.github.com' && url.pathname.includes('/contents/')) {
      const pathMatch = url.pathname.match(/\/contents\/collections$/);
      if (pathMatch) {
        const files = opts.collectionFiles.map((c) => ({ name: c.name, type: 'file', size: c.content.length }));
        return jsonResp(files);
      }
      const fileMatch = url.pathname.match(/\/contents\/collections\/(.+)$/);
      if (fileMatch) {
        const fileName = fileMatch[1];
        const collectionFile = opts.collectionFiles.find((c) => c.name === fileName);
        if (collectionFile) {
          return jsonResp({ content: Buffer.from(collectionFile.content).toString('base64'), encoding: 'base64' });
        }
      }
      return jsonResp({ message: 'not found' }, 404);
    }
    return jsonResp({ message: `unexpected ${url.pathname}` }, 500);
  };
}

describe('AwesomeCopilotBundleProvider', () => {
  it('lists one bundle per collection file with collection.id as bundleId', async () => {
    const collection1Content = `id: collection-1
name: Collection 1
description: Test collection
version: 1.0.0
items:
  - path: prompts/hello.prompt.md
    kind: prompt
`;
    const collection2Content = `id: collection-2
name: Collection 2
description: Another test collection
version: 1.0.0
items:
  - path: skills/test/SKILL.md
    kind: skill
`;
    const collection1Bytes = Buffer.from(collection1Content, 'utf8');
    const collection2Bytes = Buffer.from(collection2Content, 'utf8');
    const collection1Sha = computeGitBlobSha(collection1Bytes);
    const collection2Sha = computeGitBlobSha(collection2Bytes);

    const fetch = fakeGithubFetch({
      commitSha: 'abc123',
      collectionFiles: [
        { name: 'collections/collection-1.collection.yml', content: collection1Content },
        { name: 'collections/collection-2.collection.yml', content: collection2Content }
      ],
      tree: [
        { path: 'collections/collection-1.collection.yml', sha: collection1Sha, size: collection1Bytes.length },
        { path: 'collections/collection-2.collection.yml', sha: collection2Sha, size: collection2Bytes.length }
      ],
      blobs: new Map([
        [collection1Sha, collection1Bytes],
        [collection2Sha, collection2Bytes]
      ])
    });

    const client = new GitHubClient({ tokens: staticTokenProvider('t'), fetch });
    const cache = new BlobCache(tmp);
    const provider = new AwesomeCopilotBundleProvider({
      spec: makeSpec(),
      client,
      cache
    });

    const refs: unknown[] = [];
    for await (const r of provider.listBundles()) {
      refs.push(r);
    }

    expect(refs.length).toBe(2);
    expect(refs[0]).toStrictEqual({
      sourceId: 'src-a',
      sourceType: 'awesome-copilot',
      bundleId: 'collection-1',
      bundleVersion: 'abc123',
      installed: false
    });
    expect(refs[1]).toStrictEqual({
      sourceId: 'src-a',
      sourceType: 'awesome-copilot',
      bundleId: 'collection-2',
      bundleVersion: 'abc123',
      installed: false
    });
  });

  it('readManifest returns synthetic manifest with collection metadata', async () => {
    const collectionContent = `id: test-collection
name: Test Collection
description: A test collection
version: 2.0.0
items:
  - path: prompts/hello.prompt.md
    kind: prompt
`;
    const collectionBytes = Buffer.from(collectionContent, 'utf8');
    const collectionSha = computeGitBlobSha(collectionBytes);

    const fetch = fakeGithubFetch({
      commitSha: 'sha1',
      collectionFiles: [
        { name: 'collections/test-collection.collection.yml', content: collectionContent }
      ],
      tree: [
        { path: 'collections/test-collection.collection.yml', sha: collectionSha, size: collectionBytes.length }
      ],
      blobs: new Map([[collectionSha, collectionBytes]])
    });

    const client = new GitHubClient({ tokens: staticTokenProvider('t'), fetch });
    const cache = new BlobCache(tmp);
    const provider = new AwesomeCopilotBundleProvider({
      spec: makeSpec(),
      client,
      cache
    });

    const refs: Awaited<ReturnType<typeof provider.listBundles> extends AsyncIterable<infer T> ? T : never>[] = [];
    for await (const r of provider.listBundles()) {
      refs.push(r);
    }

    const manifest = await provider.readManifest(refs[0]);
    expect(manifest.id).toBe('test-collection');
    expect(manifest.version).toBe('sha1');
    expect(manifest.name).toBe('Test Collection');
    expect(manifest.description).toBe('A test collection');
    expect(manifest.tags).toEqual(['awesome-copilot']);
    expect(manifest.items?.length).toBe(1);
    expect(manifest.items?.[0].path).toBe('prompts/hello.prompt.md');
  });

  it('readFile fetches file content from raw GitHub', async () => {
    const collectionContent = `id: test
name: Test
version: 1.0.0
items:
  - path: prompts/hello.prompt.md
    kind: prompt
`;
    const promptContent = 'Hello world';
    const collectionBytes = Buffer.from(collectionContent, 'utf8');
    const promptBytes = Buffer.from(promptContent, 'utf8');
    const collectionSha = computeGitBlobSha(collectionBytes);
    const promptSha = computeGitBlobSha(promptBytes);

    const fetch = fakeGithubFetch({
      commitSha: 'sha1',
      collectionFiles: [
        { name: 'collections/test.collection.yml', content: collectionContent }
      ],
      tree: [
        { path: 'collections/test.collection.yml', sha: collectionSha, size: collectionBytes.length },
        { path: 'prompts/hello.prompt.md', sha: promptSha, size: promptBytes.length }
      ],
      blobs: new Map([
        [collectionSha, collectionBytes],
        [promptSha, promptBytes]
      ])
    });

    const client = new GitHubClient({ tokens: staticTokenProvider('t'), fetch });
    const cache = new BlobCache(tmp);
    const provider = new AwesomeCopilotBundleProvider({
      spec: makeSpec(),
      client,
      cache
    });

    const refs: Awaited<ReturnType<typeof provider.listBundles> extends AsyncIterable<infer T> ? T : never>[] = [];
    for await (const r of provider.listBundles()) {
      refs.push(r);
    }

    const content = await provider.readFile(refs[0], 'prompts/hello.prompt.md');
    expect(content).toBe(promptContent);
  });

  it('uses custom collectionsPath from config', async () => {
    const collectionContent = `id: test
name: Test
version: 1.0.0
items: []
`;
    const collectionBytes = Buffer.from(collectionContent, 'utf8');
    const collectionSha = computeGitBlobSha(collectionBytes);

    const customSpec: HubSourceSpec = {
      ...makeSpec(),
      collectionsPath: 'prompt-registry/collections'
    };

    const fetch = fakeGithubFetch({
      commitSha: 'sha1',
      collectionFiles: [
        { name: 'prompt-registry/collections/test.collection.yml', content: collectionContent }
      ],
      tree: [
        { path: 'prompt-registry/collections/test.collection.yml', sha: collectionSha, size: collectionBytes.length }
      ],
      blobs: new Map([[collectionSha, collectionBytes]])
    });

    const client = new GitHubClient({ tokens: staticTokenProvider('t'), fetch });
    const cache = new BlobCache(tmp);
    const provider = new AwesomeCopilotBundleProvider({
      spec: customSpec,
      client,
      cache
    });

    const refs: Awaited<ReturnType<typeof provider.listBundles> extends AsyncIterable<infer T> ? T : never>[] = [];
    for await (const r of provider.listBundles()) {
      refs.push(r);
    }

    expect(refs.length).toBe(1);
    expect(refs[0].bundleId).toBe('test');
  });

  it('throws error when readManifest called with unknown bundleId', async () => {
    const collectionContent = `id: test
name: Test
version: 1.0.0
items: []
`;
    const collectionBytes = Buffer.from(collectionContent, 'utf8');
    const collectionSha = computeGitBlobSha(collectionBytes);

    const fetch = fakeGithubFetch({
      commitSha: 'sha1',
      collectionFiles: [
        { name: 'collections/test.collection.yml', content: collectionContent }
      ],
      tree: [
        { path: 'collections/test.collection.yml', sha: collectionSha, size: collectionBytes.length }
      ],
      blobs: new Map([[collectionSha, collectionBytes]])
    });

    const client = new GitHubClient({ tokens: staticTokenProvider('t'), fetch });
    const cache = new BlobCache(tmp);
    const provider = new AwesomeCopilotBundleProvider({
      spec: makeSpec(),
      client,
      cache
    });

    const unknownRef = {
      sourceId: 'src-a',
      sourceType: 'awesome-copilot',
      bundleId: 'unknown-bundle',
      bundleVersion: 'sha1',
      installed: false
    };

    await expect(provider.readManifest(unknownRef)).rejects.toThrow('Collection file not found');
  });

  it('throws error when readFile called with path not in repo tree', async () => {
    const collectionContent = `id: test
name: Test
version: 1.0.0
items: []
`;
    const collectionBytes = Buffer.from(collectionContent, 'utf8');
    const collectionSha = computeGitBlobSha(collectionBytes);

    const fetch = fakeGithubFetch({
      commitSha: 'sha1',
      collectionFiles: [
        { name: 'collections/test.collection.yml', content: collectionContent }
      ],
      tree: [
        { path: 'collections/test.collection.yml', sha: collectionSha, size: collectionBytes.length }
      ],
      blobs: new Map([[collectionSha, collectionBytes]])
    });

    const client = new GitHubClient({ tokens: staticTokenProvider('t'), fetch });
    const cache = new BlobCache(tmp);
    const provider = new AwesomeCopilotBundleProvider({
      spec: makeSpec(),
      client,
      cache
    });

    const refs: Awaited<ReturnType<typeof provider.listBundles> extends AsyncIterable<infer T> ? T : never>[] = [];
    for await (const r of provider.listBundles()) {
      refs.push(r);
    }

    await expect(provider.readFile(refs[0], 'nonexistent/file.md')).rejects.toThrow('not a primitive candidate');
  });

  it('getCommitSha returns the commit sha', async () => {
    const collectionContent = `id: test
name: Test
version: 1.0.0
items: []
`;
    const collectionBytes = Buffer.from(collectionContent, 'utf8');
    const collectionSha = computeGitBlobSha(collectionBytes);

    const fetch = fakeGithubFetch({
      commitSha: 'abc123',
      collectionFiles: [
        { name: 'collections/test.collection.yml', content: collectionContent }
      ],
      tree: [
        { path: 'collections/test.collection.yml', sha: collectionSha, size: collectionBytes.length }
      ],
      blobs: new Map([[collectionSha, collectionBytes]])
    });

    const client = new GitHubClient({ tokens: staticTokenProvider('t'), fetch });
    const cache = new BlobCache(tmp);
    const provider = new AwesomeCopilotBundleProvider({
      spec: makeSpec(),
      client,
      cache
    });

    const commitSha = await provider.getCommitSha();
    expect(commitSha).toBe('abc123');
  });

  it('skips collections with invalid YAML', async () => {
    const invalidContent = 'invalid: yaml: content: [unclosed';
    const validContent = `id: valid
name: Valid
version: 1.0.0
items: []
`;
    const validBytes = Buffer.from(validContent, 'utf8');
    const validSha = computeGitBlobSha(validBytes);

    const fetch = fakeGithubFetch({
      commitSha: 'sha1',
      collectionFiles: [
        { name: 'collections/invalid.collection.yml', content: invalidContent },
        { name: 'collections/valid.collection.yml', content: validContent }
      ],
      tree: [
        { path: 'collections/valid.collection.yml', sha: validSha, size: validBytes.length }
      ],
      blobs: new Map([[validSha, validBytes]])
    });

    const client = new GitHubClient({ tokens: staticTokenProvider('t'), fetch });
    const cache = new BlobCache(tmp);
    const provider = new AwesomeCopilotBundleProvider({
      spec: makeSpec(),
      client,
      cache
    });

    const refs: Awaited<ReturnType<typeof provider.listBundles> extends AsyncIterable<infer T> ? T : never>[] = [];
    for await (const r of provider.listBundles()) {
      refs.push(r);
    }

    expect(refs.length).toBe(1);
    expect(refs[0].bundleId).toBe('valid');
  });

  it('skips collections missing id field', async () => {
    const noIdContent = `name: No ID
version: 1.0.0
items: []
`;
    const validContent = `id: valid
name: Valid
version: 1.0.0
items: []
`;
    const validBytes = Buffer.from(validContent, 'utf8');
    const validSha = computeGitBlobSha(validBytes);

    const fetch = fakeGithubFetch({
      commitSha: 'sha1',
      collectionFiles: [
        { name: 'collections/no-id.collection.yml', content: noIdContent },
        { name: 'collections/valid.collection.yml', content: validContent }
      ],
      tree: [
        { path: 'collections/valid.collection.yml', sha: validSha, size: validBytes.length }
      ],
      blobs: new Map([[validSha, validBytes]])
    });

    const client = new GitHubClient({ tokens: staticTokenProvider('t'), fetch });
    const cache = new BlobCache(tmp);
    const provider = new AwesomeCopilotBundleProvider({
      spec: makeSpec(),
      client,
      cache
    });

    const refs: Awaited<ReturnType<typeof provider.listBundles> extends AsyncIterable<infer T> ? T : never>[] = [];
    for await (const r of provider.listBundles()) {
      refs.push(r);
    }

    expect(refs.length).toBe(1);
    expect(refs[0].bundleId).toBe('valid');
  });
});
