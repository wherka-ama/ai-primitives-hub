import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  TERNLIGHT_MODEL,
} from '../../src/search/embedding/ternlight-embedding-provider';
import {
  decodeVector,
  encodeVector,
} from '../../src/search/vector-codec';

const cosine = (a: Float32Array, b: Float32Array): number => {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [i, value] of a.entries()) {
    dot += value * b[i];
    na += value * value;
    nb += b[i] * b[i];
  }
  return dot / Math.sqrt(na * nb);
};

describe('vector codec', () => {
  const vector = Float32Array.from({ length: 384 }, (_, i) => Math.sin(i * 0.37) * (i % 7 === 0 ? 0.9 : 0.1));

  it('round-trips f32 vectors exactly', () => {
    expect(decodeVector(encodeVector(vector, 'f32-base64'), 'f32-base64')).toEqual(vector);
  });

  it('quantizes i8 vectors to about a quarter of the f32 size with near-identical direction', () => {
    const encoded = encodeVector(vector, 'i8-base64');
    expect(encoded.length).toBeLessThan(encodeVector(vector, 'f32-base64').length / 3.5);
    expect(cosine(vector, decodeVector(encoded, 'i8-base64'))).toBeGreaterThan(0.999);
  });

  it('encodes a zero vector without dividing by zero', () => {
    expect([...decodeVector(encodeVector(new Float32Array(4), 'i8-base64'), 'i8-base64')]).toEqual([0, 0, 0, 0]);
  });

  it('rejects truncated vectors', () => {
    expect(() => decodeVector('AAA=', 'f32-base64')).toThrow(/length/);
  });
});

describe('TERNLIGHT_MODEL', () => {
  it('names the installed @ternlight/mini package version', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../node_modules/@ternlight/mini/package.json'), 'utf8')) as { name: string; version: string };
    expect(TERNLIGHT_MODEL).toBe(`${pkg.name}@${pkg.version}`);
  });
});
