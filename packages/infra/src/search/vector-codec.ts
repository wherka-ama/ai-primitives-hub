/**
 * Compact persisted encodings for primitive-index embedding vectors.
 *
 * Schema-1 indexes store vectors as JSON number arrays, so most of an embedded
 * index is decimal text. The encodings below store each vector as one base64
 * string (little-endian):
 *
 * - `f32-base64`: the float32 values; lossless.
 * - `i8-base64`: a float32 scale followed by one int8 per dimension
 *   (`value = int8 * scale`, scale = max |value| / 127); about a quarter of
 *   the float32 size. Ranking uses cosine similarity, so the per-vector scale
 *   only bounds the rounding error.
 * @module search/vector-codec
 */

/** Persisted vector encoding written to the index `vectorEncoding` field. */
export type PersistedVectorEncoding = 'f32-base64' | 'i8-base64';

/** User-facing vector encoding: `json` keeps schema-1 number arrays. */
export type VectorEncoding = 'json' | 'f32' | 'i8';

/** All user-facing vector encodings. */
export const VECTOR_ENCODINGS: readonly VectorEncoding[] = ['json', 'f32', 'i8'];

/**
 * Narrow user input to a supported vector encoding.
 * @param value Raw value, e.g. a CLI flag.
 */
export function isVectorEncoding(value: string): value is VectorEncoding {
  return (VECTOR_ENCODINGS as readonly string[]).includes(value);
}

/**
 * Map a user-facing encoding to the persisted field value.
 * @param encoding User-facing encoding.
 * @returns Persisted encoding, or undefined for plain JSON arrays.
 */
export function toPersistedVectorEncoding(encoding: VectorEncoding | undefined): PersistedVectorEncoding | undefined {
  if (encoding === 'f32') {
    return 'f32-base64';
  }
  if (encoding === 'i8') {
    return 'i8-base64';
  }
  return undefined;
}

/**
 * Whether reading vectors persisted with `encoding` loses precision.
 * @param encoding Persisted encoding (undefined for JSON arrays).
 */
export function isLossyVectorEncoding(encoding: PersistedVectorEncoding | undefined): boolean {
  return encoding === 'i8-base64';
}

/**
 * Encode one vector.
 * @param vector Vector to encode.
 * @param encoding Persisted encoding.
 * @returns Base64 string.
 */
export function encodeVector(vector: Float32Array, encoding: PersistedVectorEncoding): string {
  if (encoding === 'f32-base64') {
    const f32Bytes = Buffer.alloc(vector.length * 4);
    for (const [i, value] of vector.entries()) {
      f32Bytes.writeFloatLE(value, i * 4);
    }
    return f32Bytes.toString('base64');
  }
  let maxAbs = 0;
  for (const value of vector) {
    maxAbs = Math.max(maxAbs, Math.abs(value));
  }
  const scale = Math.fround(maxAbs / 127);
  const bytes = Buffer.alloc(4 + vector.length);
  bytes.writeFloatLE(scale, 0);
  for (const [i, value] of vector.entries()) {
    const quantized = scale === 0 ? 0 : Math.max(-127, Math.min(127, Math.round(value / scale)));
    bytes.writeInt8(quantized, 4 + i);
  }
  return bytes.toString('base64');
}

/**
 * Decode one vector.
 * @param value Base64 string written by {@link encodeVector}.
 * @param encoding Persisted encoding.
 * @returns Decoded vector.
 */
export function decodeVector(value: string, encoding: PersistedVectorEncoding): Float32Array {
  const bytes = Buffer.from(value, 'base64');
  if (encoding === 'f32-base64') {
    if (bytes.length % 4 !== 0) {
      throw new Error('Invalid f32-base64 vector length');
    }
    const f32Vector = new Float32Array(bytes.length / 4);
    for (let i = 0; i < f32Vector.length; i++) {
      f32Vector[i] = bytes.readFloatLE(i * 4);
    }
    return f32Vector;
  }
  if (bytes.length < 4) {
    throw new Error('Invalid i8-base64 vector length');
  }
  const scale = bytes.readFloatLE(0);
  const vector = new Float32Array(bytes.length - 4);
  for (let i = 0; i < vector.length; i++) {
    vector[i] = bytes.readInt8(4 + i) * scale;
  }
  return vector;
}
