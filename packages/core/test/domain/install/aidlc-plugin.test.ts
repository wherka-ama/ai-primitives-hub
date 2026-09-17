import {
  describe,
  expect,
  it,
} from 'vitest';
import type {
  ReleaseDeploymentManifest,
} from '../../../src/domain/collection/types';
import {
  AidlcPluginValidationError,
  getAidlcHarness,
  validateAidlcPluginBundleForTarget,
} from '../../../src/domain/install/aidlc-plugin';
import type {
  ExtractedFiles,
} from '../../../src/ports/bundle-extractor';

const bytes = (value: string): Uint8Array => new TextEncoder().encode(value);

const manifest = (path = 'aidlc-plugins/example/.aidlc-plugin-projection.json'): ReleaseDeploymentManifest => ({
  formatVersion: 1,
  id: 'bundle',
  version: '1.0.0',
  name: 'Bundle',
  items: [{ id: 'example', path, kind: 'aidlc-plugin' }],
  files: [],
  provenance: {
    source: 'https://example.test/repo',
    revision: 'abc',
    collectionPath: 'collections/bundle.collection.yml',
    sourceSnapshotPath: 'metadata/source/collections/bundle.collection.yml',
    license: 'Apache-2.0',
    licensePath: 'LICENSE'
  }
});

const projectionFiles = (harness: string): ExtractedFiles => new Map([
  ['aidlc-plugins/example/.aidlc-plugin-projection.json', bytes(JSON.stringify({
    schema: 1,
    producer: 'aidlc-plugin-build',
    plugin: 'example',
    harness
  }))],
  ['aidlc-plugins/example/hooks/compose.ts', bytes('export const compose = () => {};')]
]);

describe('AIDLC plugin target validation', () => {
  it('maps supported targets to AIDLC harness projections', () => {
    expect(getAidlcHarness('kiro')).toBe('kiro-ide');
    expect(getAidlcHarness('kiro-cli')).toBe('kiro');
    expect(getAidlcHarness('vscode')).toBe('copilot');
    expect(getAidlcHarness('claude-code')).toBe('claude');
    expect(getAidlcHarness('cursor')).toBe('cursor');
    expect(getAidlcHarness('opencode')).toBe('opencode');
    expect(getAidlcHarness('windsurf')).toBeNull();
  });

  it('accepts a matching repository-scoped projection', () => {
    const descriptors = validateAidlcPluginBundleForTarget(
      manifest(),
      projectionFiles('kiro-ide'),
      { name: 'kiro', type: 'kiro', scope: 'repository', rootPath: '/workspace' }
    );

    expect(descriptors).toEqual([{
      plugin: 'example',
      harness: 'kiro-ide',
      itemPath: 'aidlc-plugins/example/.aidlc-plugin-projection.json',
      bundleRoot: 'aidlc-plugins/example'
    }]);
  });

  it('rejects user-scope installation before files are written', () => {
    expect(() => validateAidlcPluginBundleForTarget(
      manifest(),
      projectionFiles('kiro-ide'),
      { name: 'kiro', type: 'kiro', scope: 'user' }
    )).toThrowError(expect.objectContaining({ code: 'AIDLC_PLUGIN.REPOSITORY_SCOPE_REQUIRED' }));
  });

  it('rejects a projection built for another harness', () => {
    expect(() => validateAidlcPluginBundleForTarget(
      manifest(),
      projectionFiles('kiro'),
      { name: 'kiro', type: 'kiro', scope: 'repository', rootPath: '/workspace' }
    )).toThrowError(expect.objectContaining({ code: 'AIDLC_PLUGIN.HARNESS_MISMATCH' }));
  });

  it('rejects malformed or misplaced projection entry points', () => {
    expect(() => validateAidlcPluginBundleForTarget(
      manifest('plugins/example/plugin.json'),
      projectionFiles('kiro-ide'),
      { name: 'kiro', type: 'kiro', scope: 'repository', rootPath: '/workspace' }
    )).toThrow(AidlcPluginValidationError);
  });
});
