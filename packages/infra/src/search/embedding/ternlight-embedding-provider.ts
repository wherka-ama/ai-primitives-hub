/**
 * Ternlight-backed local embedding provider for the primitive index.
 *
 * Implements the infra `EmbeddingProvider` port using `@ternlight/mini`, a
 * self-contained 5 MB WASM sentence encoder. No native dependencies, no GPU,
 * no network calls after install.
 * @module search/embedding/ternlight-embedding-provider
 */
import {
  embed,
} from '@ternlight/mini';
import type {
  EmbeddingProvider,
} from '../types';

/**
 * Truncate input text to a safe byte budget before embedding.
 * Ternlight tokenizes with BERT WordPiece and truncates at 128 tokens;
 * 4000 characters is a generous upper bound for ~95 English words.
 */
const MAX_INPUT_LENGTH = 4000;

function prepare(text: string): string {
  return text.slice(0, MAX_INPUT_LENGTH);
}

/**
 * Model identity recorded in embedded indexes. Keep it equal to the exact
 * `@ternlight/mini` dependency version: a different model produces vectors
 * that are not comparable with indexes built by this one.
 */
export const TERNLIGHT_MODEL = '@ternlight/mini@0.1.1';

/**
 * Local embedding provider powered by `@ternlight/mini`.
 */
export class TernlightEmbeddingProvider implements EmbeddingProvider {
  public readonly name = 'ternlight-mini';
  public readonly model = TERNLIGHT_MODEL;
  public readonly dim = 384;

  /**
   * Embed one or more texts into 384-dimensional unit vectors.
   * @param texts - Texts to embed.
   * @returns Array of Float32Array embeddings, one per input.
   */
  public embed(texts: string[]): Promise<Float32Array[]> {
    return Promise.resolve(texts.map((text) => embed(prepare(text))));
  }
}
