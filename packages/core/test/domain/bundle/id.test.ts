import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  generateBundleId,
} from '../../../src/domain/bundle/id';

describe('generateBundleId', () => {
  it('joins owner/repo, collection id, and version into the canonical format', () => {
    expect(generateBundleId('owner/repo', 'my-collection', '1.0.0')).toBe(
      'owner-repo-my-collection-v1.0.0'
    );
  });

  it('normalizes every slash in the repo slug, not just the first', () => {
    expect(generateBundleId('org/team/repo', 'collection', '2.1.0')).toBe(
      'org-team-repo-collection-v2.1.0'
    );
  });

  it('passes through an already-hyphenated repo slug unchanged', () => {
    expect(generateBundleId('owner-repo', 'collection', '1.0.0')).toBe(
      'owner-repo-collection-v1.0.0'
    );
  });
});
