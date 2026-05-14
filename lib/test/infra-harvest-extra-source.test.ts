/**
 * Coverage tests for infra/harvest/extra-source.ts.
 *
 * Tests parseExtraSource function.
 */
import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  parseExtraSource,
} from '../src/infra/harvest/extra-source';

describe('parseExtraSource', () => {
  it('parses valid github source', () => {
    const result = parseExtraSource('id=test,type=github,url=https://github.com/owner/repo');
    expect(result.id).toBe('test');
    expect(result.name).toBe('test');
    expect(result.type).toBe('github');
    expect(result.url).toBe('https://github.com/owner/repo');
    expect(result.owner).toBe('owner');
    expect(result.repo).toBe('repo');
    expect(result.branch).toBe('main');
  });

  it('parses source with custom name', () => {
    const result = parseExtraSource('id=test,name=My Source,type=github,url=https://github.com/owner/repo');
    expect(result.name).toBe('My Source');
  });

  it('parses source with custom branch', () => {
    const result = parseExtraSource('id=test,type=github,url=https://github.com/owner/repo,branch=develop');
    expect(result.branch).toBe('develop');
  });

  it('parses awesome-copilot source with collectionsPath', () => {
    const result = parseExtraSource('id=test,type=awesome-copilot,url=https://github.com/owner/repo,collectionsPath=collections');
    expect(result.type).toBe('awesome-copilot');
    expect(result.collectionsPath).toBe('collections');
  });

  it('parses awesome-copilot-plugin source with default pluginsPath', () => {
    const result = parseExtraSource('id=test,type=awesome-copilot-plugin,url=https://github.com/owner/repo');
    expect(result.type).toBe('awesome-copilot-plugin');
    expect(result.pluginsPath).toBe('plugins');
  });

  it('parses awesome-copilot-plugin source with custom pluginsPath', () => {
    const result = parseExtraSource('id=test,type=awesome-copilot-plugin,url=https://github.com/owner/repo,pluginsPath=custom-plugins');
    expect(result.pluginsPath).toBe('custom-plugins');
  });

  it('throws error for missing id', () => {
    expect(() => parseExtraSource('type=github,url=https://github.com/owner/repo')).toThrow(
      '--extra-source: missing field "id"'
    );
  });

  it('throws error for missing type', () => {
    expect(() => parseExtraSource('id=test,url=https://github.com/owner/repo')).toThrow(
      '--extra-source: missing field "type"'
    );
  });

  it('throws error for missing url', () => {
    expect(() => parseExtraSource('id=test,type=github')).toThrow(
      '--extra-source: missing field "url"'
    );
  });

  it('throws error for unsupported type', () => {
    expect(() => parseExtraSource('id=test,type=invalid,url=https://github.com/owner/repo')).toThrow(
      '--extra-source: unsupported source type "invalid"'
    );
  });

  it('throws error for non-github URL', () => {
    expect(() => parseExtraSource('id=test,type=github,url=https://example.com')).toThrow(
      '--extra-source: not a github URL:'
    );
  });

  it('handles whitespace around keys and values', () => {
    const result = parseExtraSource(' id = test , type = github , url = https://github.com/owner/repo ');
    expect(result.id).toBe('test');
    expect(result.type).toBe('github');
    expect(result.url).toBe('https://github.com/owner/repo');
  });

  it('silently skips malformed chunks', () => {
    const result = parseExtraSource('id=test,type=github,url=https://github.com/owner/repo,invalid-chunk,no-equals');
    expect(result.id).toBe('test');
    expect(result.type).toBe('github');
    expect(result.url).toBe('https://github.com/owner/repo');
  });

  it('handles empty keys', () => {
    const result = parseExtraSource('id=test,type=github,url=https://github.com/owner/repo,=value');
    expect(result.id).toBe('test');
  });
});
