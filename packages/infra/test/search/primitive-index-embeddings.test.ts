import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  harvest,
} from '../../src/harvest/harvester';
import {
  TernlightEmbeddingProvider,
} from '../../src/search/embedding/ternlight-embedding-provider';
import {
  PrimitiveIndex,
} from '../../src/search/primitive-index';
import {
  loadIndex,
  saveIndex,
} from '../../src/stores/json-index-store';
import {
  createFixtureBundles,
  FakeBundleProvider,
} from '../fixtures/primitive-index';

async function buildEmbeddedIndex(): Promise<PrimitiveIndex> {
  const provider = new FakeBundleProvider(createFixtureBundles());
  return PrimitiveIndex.buildFrom(provider, {
    embeddings: new TernlightEmbeddingProvider()
  });
}

describe('PrimitiveIndex embeddings', () => {
  it('builds an index with embeddings when a provider is supplied', async () => {
    const idx = await buildEmbeddedIndex();
    const json = idx.toJSON() as {
      searchProfileId?: string | null;
      embeddingsMeta?: { provider: string; dim: number } | null;
      primitives: { embedding?: number[] }[];
    };
    expect(json.searchProfileId).toBe('ternlight-single-v1');
    expect(json.embeddingsMeta).toBeTruthy();
    expect(json.embeddingsMeta?.dim).toBe(384);
    expect(json.embeddingsMeta?.strategy).toBe('summary');

    const withEmbedding = json.primitives.filter((p) => p.embedding && p.embedding.length > 0);
    expect(withEmbedding.length).toBe(json.primitives.length);
  });

  it('buildFromPrimitives without embeddings does not store embeddings', async () => {
    const provider = new FakeBundleProvider(createFixtureBundles());
    const prims = await harvest(provider);
    const idx = PrimitiveIndex.fromPrimitives(prims);
    const json = idx.toJSON() as {
      embeddingsMeta?: { provider: string; dim: number } | null;
    };
    expect(json.embeddingsMeta ?? null).toBeNull();
  });

  it('supports hybrid search with a query embedding', async () => {
    const idx = await buildEmbeddedIndex();
    const embedder = new TernlightEmbeddingProvider();
    const [queryEmbedding] = await embedder.embed(['rust setup']);
    const res = idx.search({ q: 'rust setup', ranking: 'hybrid', queryEmbedding, limit: 5 });
    expect(res.hits.length).toBeGreaterThan(0);
    expect(res.hits[0].score).toBeGreaterThan(0);
  });

  it('retrieves a semantically-similar primitive that shares no query keyword', async () => {
    const idx = await buildEmbeddedIndex();
    const json = idx.toJSON() as {
      primitives: { id: string; embedding?: number[] }[];
    };
    const target = json.primitives.find((p) => p.embedding && p.embedding.length === 384);
    expect(target).toBeTruthy();

    // Query text deliberately shares no stemmed token with any document, so
    // BM25 matches nothing. The query embedding is the target's own vector
    // (cosine ~= 1), so a working semantic layer must still retrieve it.
    const queryEmbedding = new Float32Array(target!.embedding!);
    const res = idx.search({
      q: 'zzqqxx wvbnkq',
      ranking: 'hybrid',
      queryEmbedding,
      limit: 10
    });

    const ids = res.hits.map((h) => h.primitive.id);
    expect(ids).toContain(target!.id);
  });

  it('applies relevance floors to embedding-only queries', async () => {
    const idx = await buildEmbeddedIndex();
    const json = idx.toJSON() as {
      primitives: { embedding?: number[] }[];
    };
    const target = json.primitives.find((p) => p.embedding && p.embedding.length === 384);
    expect(target).toBeTruthy();

    const queryEmbedding = new Float32Array(target!.embedding!);
    const res = idx.search({
      ranking: 'hybrid',
      queryEmbedding,
      limit: 10,
      minScore: 1
    });

    expect(res.hits).toHaveLength(0);
    expect(res.total).toBe(0);
  });

  it('round-trips embeddings through saveIndex/loadIndex', async () => {
    const idx = await buildEmbeddedIndex();
    const file = path.join(os.tmpdir(), `pi-embed-${Date.now()}.json`);
    try {
      saveIndex(idx, file);
      const loaded = loadIndex(file);
      const json = loaded.toJSON() as {
        embeddingsMeta?: { provider: string; dim: number } | null;
        primitives: { embedding?: number[] }[];
      };
      expect(json.embeddingsMeta).toBeTruthy();
      expect(json.embeddingsMeta?.strategy).toBe('summary');
      expect(json.primitives.some((p) => p.embedding && p.embedding.length === 384)).toBe(true);

      const embedder = new TernlightEmbeddingProvider();
      const [queryEmbedding] = await embedder.embed(['terraform']);
      const res = loaded.search({ q: 'terraform', ranking: 'hybrid', queryEmbedding, limit: 5 });
      expect(res.hits.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(file, { force: true });
    }
  });

  it('builds a dual-embedding index and supports multi-vector search', async () => {
    const provider = new FakeBundleProvider(createFixtureBundles());
    const idx = await PrimitiveIndex.buildFrom(provider, {
      embeddings: new TernlightEmbeddingProvider(),
      embeddingStrategy: 'dual'
    });
    const json = idx.toJSON() as {
      searchProfileId?: string | null;
      embeddingsMeta?: { provider: string; dim: number; embeddingStrategy?: string } | null;
      primitives: { embeddings?: Record<string, number[]> }[];
    };
    expect(json.searchProfileId).toBe('ternlight-dual-v1');
    expect(json.embeddingsMeta?.embeddingStrategy).toBe('dual');
    expect(json.primitives[0]?.embeddings?.metadata).toHaveLength(384);
    expect(json.primitives[0]?.embeddings?.body).toHaveLength(384);

    const embedder = new TernlightEmbeddingProvider();
    const [metadataQuery] = await embedder.embed(['terraform']);
    const [bodyQuery] = await embedder.embed(['infrastructure provisioning']);
    const res = idx.search({
      q: 'terraform infrastructure',
      ranking: 'multi',
      queryEmbeddings: { metadata: metadataQuery, body: bodyQuery },
      embeddingWeights: { bm25: 0.6, metadata: 0.15, body: 0.25 },
      limit: 5
    });
    expect(res.hits.length).toBeGreaterThan(0);
    expect(res.hits[0].score).toBeGreaterThan(0);
  });

  it('reuses existing embeddings for unchanged primitives during incremental build and refresh', async () => {
    const baseEmbedder = new TernlightEmbeddingProvider();
    let embeddedTextsCount = 0;
    const countingEmbedder = {
      name: baseEmbedder.name,
      dim: baseEmbedder.dim,
      embed: async (texts: string[]): Promise<Float32Array[]> => {
        embeddedTextsCount += texts.length;
        return baseEmbedder.embed(texts);
      }
    };

    const fixtures = createFixtureBundles();
    const initialProvider = new FakeBundleProvider(fixtures);
    const initialIndex = await PrimitiveIndex.buildFrom(initialProvider, {
      embeddings: countingEmbedder,
      embeddingStrategy: 'dual',
      sourceRevisions: { 'gh-main': 'rev-1', 'local-dev': 'rev-1' }
    });

    const totalPrimitives = initialIndex.stats().primitives;
    expect(totalPrimitives).toBeGreaterThan(1);
    // Dual strategy embeds 2 streams (metadata + body) per primitive
    expect(embeddedTextsCount).toBe(totalPrimitives * 2);

    // Rebuild with exact same content and previousIndex -> 0 new embeddings computed!
    embeddedTextsCount = 0;
    const warmIndex = await PrimitiveIndex.buildFrom(initialProvider, {
      embeddings: countingEmbedder,
      embeddingStrategy: 'dual',
      previousIndex: initialIndex,
      sourceRevisions: { 'gh-main': 'rev-1', 'local-dev': 'rev-1' }
    });
    expect(embeddedTextsCount).toBe(0);
    expect(warmIndex.stats().primitives).toBe(totalPrimitives);
    expect(warmIndex.getSourceRevisions()).toEqual({ 'gh-main': 'rev-1', 'local-dev': 'rev-1' });

    // Modify one primitive's manifest-derived description (even with unchanged contentHash) -> only 1 primitive (2 streams) embedded!
    const allPrimitives = warmIndex.all();
    const modifiedPrimitive = {
      ...allPrimitives[0],
      description: 'Updated description for incremental test'
    };
    const nextPrimitives = [modifiedPrimitive, ...allPrimitives.slice(1)];

    embeddedTextsCount = 0;
    const incrementalIndex = await PrimitiveIndex.buildFromPrimitives(nextPrimitives, {
      embeddings: countingEmbedder,
      embeddingStrategy: 'dual',
      previousIndex: warmIndex
    });
    expect(embeddedTextsCount).toBe(2);
    expect(incrementalIndex.get(modifiedPrimitive.id)?.description).toBe('Updated description for incremental test');

    // Changing searchProfileId rejects embedding reuse and recomputes all embeddings
    embeddedTextsCount = 0;
    await PrimitiveIndex.buildFromPrimitives(nextPrimitives, {
      embeddings: countingEmbedder,
      embeddingStrategy: 'dual',
      searchProfileId: 'ternlight-dual-v2',
      previousIndex: incrementalIndex
    });
    expect(embeddedTextsCount).toBe(totalPrimitives * 2);
  });

  it('carries over unchanged sources and prunes removed sources without harvesting or re-embedding', async () => {
    const baseEmbedder = new TernlightEmbeddingProvider();
    let embeddedTextsCount = 0;
    const countingEmbedder = {
      name: baseEmbedder.name,
      dim: baseEmbedder.dim,
      embed: async (texts: string[]): Promise<Float32Array[]> => {
        embeddedTextsCount += texts.length;
        return baseEmbedder.embed(texts);
      }
    };

    const fixtures = createFixtureBundles();
    const initialIndex = await PrimitiveIndex.buildFrom(new FakeBundleProvider(fixtures), {
      embeddings: countingEmbedder,
      embeddingStrategy: 'dual',
      sourceRevisions: { 'github-abc': 'rev-1', 'github-def': 'rev-1' }
    });
    const abcCount = initialIndex.all().filter((p) => p.bundle.sourceId === 'github-abc').length;
    const defCount = initialIndex.all().filter((p) => p.bundle.sourceId === 'github-def').length;
    expect(abcCount).toBeGreaterThan(0);
    expect(defCount).toBeGreaterThan(0);

    // Remove 'github-def' and keep 'github-abc' unchanged (changedSourceIds is empty)
    embeddedTextsCount = 0;
    const emptyProvider = new FakeBundleProvider([]);
    const prunedIndex = await PrimitiveIndex.buildFrom(emptyProvider, {
      embeddings: countingEmbedder,
      embeddingStrategy: 'dual',
      previousIndex: initialIndex,
      sourceRevisions: { 'github-abc': 'rev-1' },
      changedSourceIds: new Set<string>()
    });

    expect(embeddedTextsCount).toBe(0);
    expect(prunedIndex.stats().primitives).toBe(abcCount);
    expect(prunedIndex.all().every((p) => p.bundle.sourceId === 'github-abc')).toBe(true);
    expect(prunedIndex.getSourceRevisions()).toEqual({ 'github-abc': 'rev-1' });
  });
});

describe('PrimitiveIndex persisted vectors and model', () => {
  type Json = {
    schemaVersion: number;
    vectorEncoding?: string;
    embeddingsMeta?: { model?: string } | null;
    primitives: { embedding?: unknown; embeddings?: Record<string, unknown> }[];
  };

  const countingEmbedder = (model?: string): { provider: TernlightEmbeddingProvider & { model?: string }; count: () => number } => {
    const base = new TernlightEmbeddingProvider();
    let count = 0;
    const provider = {
      name: base.name,
      dim: base.dim,
      model: model ?? base.model,
      embed: async (texts: string[]): Promise<Float32Array[]> => {
        count += texts.length;
        return base.embed(texts);
      }
    } as unknown as TernlightEmbeddingProvider;
    return { provider, count: () => count };
  };

  it('records the embedding model and writes compact vectors without the duplicate legacy vector', async () => {
    const provider = new FakeBundleProvider(createFixtureBundles());
    const plain = await PrimitiveIndex.buildFrom(provider, { embeddings: new TernlightEmbeddingProvider(), embeddingStrategy: 'dual' });
    const compact = await PrimitiveIndex.buildFrom(provider, {
      embeddings: new TernlightEmbeddingProvider(), embeddingStrategy: 'dual', vectorEncoding: 'i8'
    });
    const plainJson = plain.toJSON() as Json;
    const json = compact.toJSON() as Json;
    expect(plainJson.schemaVersion).toBe(1);
    expect(plainJson.embeddingsMeta?.model).toBe(new TernlightEmbeddingProvider().model);
    expect(json.schemaVersion).toBe(2);
    expect(json.vectorEncoding).toBe('i8-base64');
    expect(json.primitives.every((p) => p.embedding === undefined && typeof p.embeddings?.metadata === 'string')).toBe(true);
    expect(JSON.stringify(json).length).toBeLessThan(JSON.stringify(plainJson).length / 3);

    const file = path.join(os.tmpdir(), `pi-i8-${Date.now()}.json`);
    try {
      saveIndex(compact, file);
      const loaded = loadIndex(file);
      const embedder = new TernlightEmbeddingProvider();
      const [metadata] = await embedder.embed(['terraform']);
      const [body] = await embedder.embed(['infrastructure provisioning']);
      const query = { q: 'terraform infrastructure', ranking: 'multi' as const, queryEmbeddings: { metadata, body }, limit: 5 };
      expect(loaded.search(query).hits.map((h) => h.primitive.id)).toEqual(plain.search(query).hits.map((h) => h.primitive.id));
      expect((loaded.toJSON() as Json).vectorEncoding).toBe('i8-base64');
    } finally {
      fs.rmSync(file, { force: true });
    }
  });

  it('refuses an index with an unknown vector encoding', async () => {
    const idx = await buildEmbeddedIndex();
    const json = { ...(idx.toJSON() as Json), schemaVersion: 2, vectorEncoding: 'f16-base64' };
    expect(() => PrimitiveIndex.fromJSON(json as never)).toThrow(/vectorEncoding|encoding/i);
  });

  it('reuses embeddings only from the same model, and from i8 only into i8', async () => {
    const prims = await harvest(new FakeBundleProvider(createFixtureBundles()));
    const first = countingEmbedder();
    const i8 = await PrimitiveIndex.buildFromPrimitives(prims, { embeddings: first.provider, vectorEncoding: 'i8' });
    expect(first.count()).toBe(prims.length);

    const sameModelI8 = countingEmbedder();
    await PrimitiveIndex.buildFromPrimitives(prims, { embeddings: sameModelI8.provider, vectorEncoding: 'i8', previousIndex: i8 });
    expect(sameModelI8.count()).toBe(0);

    const lossless = countingEmbedder();
    await PrimitiveIndex.buildFromPrimitives(prims, { embeddings: lossless.provider, vectorEncoding: 'f32', previousIndex: i8 });
    expect(lossless.count()).toBe(prims.length);

    const otherModel = countingEmbedder('@ternlight/mini@9.9.9');
    await PrimitiveIndex.buildFromPrimitives(prims, { embeddings: otherModel.provider, vectorEncoding: 'i8', previousIndex: i8 });
    expect(otherModel.count()).toBe(prims.length);
  });
});
