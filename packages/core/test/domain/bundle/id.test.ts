import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  generateBundleId,
  generateGitHubReleaseBundleId,
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

describe('generateGitHubReleaseBundleId', () => {
  it('uses the manifest id and manifest version, without a v prefix, when both are present', () => {
    expect(generateGitHubReleaseBundleId('owner', 'repo', 'v1.0.0', 'my-collection', '1.0.0')).toBe(
      'owner-repo-my-collection-1.0.0'
    );
  });

  it('falls back to the release tag verbatim when there is no manifest id', () => {
    expect(generateGitHubReleaseBundleId('owner', 'repo', 'v2.3.4')).toBe('owner-repo-v2.3.4');
  });

  it('strips a leading v from the tag to derive the version when manifestVersion is absent', () => {
    expect(generateGitHubReleaseBundleId('owner', 'repo', 'v1.2.3', 'my-collection')).toBe(
      'owner-repo-my-collection-1.2.3'
    );
  });

  it('leaves a tag without a v prefix unchanged when deriving the fallback version', () => {
    expect(generateGitHubReleaseBundleId('owner', 'repo', '1.2.3', 'my-collection')).toBe(
      'owner-repo-my-collection-1.2.3'
    );
  });
});
