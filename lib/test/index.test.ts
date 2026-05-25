/**
 * Tests for the public API surface (src/index.ts).
 */
import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  BlobCache,
  domain,
  GitHubClient,
  HubHarvester,
  PrimitiveIndex,
} from '../src/index';

describe('index.ts public API', () => {
  it('should export PrimitiveIndex from infra/search', () => {
    expect(PrimitiveIndex).toBeDefined();
  });

  it('should export HubHarvester from infra/harvest', () => {
    expect(HubHarvester).toBeDefined();
  });

  it('should export GitHubClient from infra/github', () => {
    expect(GitHubClient).toBeDefined();
  });

  it('should export BlobCache from infra/github', () => {
    expect(BlobCache).toBeDefined();
  });

  it('should export domain namespace', () => {
    expect(domain).toBeDefined();
  });
});
