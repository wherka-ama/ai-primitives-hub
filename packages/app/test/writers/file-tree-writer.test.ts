/**
 * Tests for app/writers/file-tree-writer.ts.
 *
 * No direct equivalent test existed at this module's current location
 * in the reference branch (the only test found there,
 * `infra/test/writers/file-tree-writer.test.ts.skip`, referenced the
 * module at its *old* pre-refactor `infra` location and stale
 * `infra`-internal import paths — see the module doc for the
 * `default-layouts.json` single-source-of-truth history). Written
 * fresh against this module's actual current behavior.
 */
import type {
  ResourceTransformer,
  Target,
} from '@ai-primitives-hub/core';
import {
  BuiltInOnlyLayoutConfigLoader,
} from '@ai-primitives-hub/infra';
import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  expandPath,
  FileTreeTargetWriter,
  resolveLayout,
  resolveLayoutAsync,
} from '../../src/writers/file-tree-writer';
import {
  InMemoryFileSystem,
} from '../helpers/in-memory-filesystem';

describe('resolveLayout', () => {
  it('resolves vscode user scope layout from built-in defaults', () => {
    const target: Target = { name: 'test', type: 'vscode', scope: 'user', path: '/custom/path' };
    const layout = resolveLayout(target);
    expect(layout.baseDir).toBe('/custom/path');
    expect(layout.kindRoutes).toHaveProperty('prompts/');
    expect(layout.kindRoutes).toHaveProperty('skills/');
  });

  it('resolves kiro repository scope routes to .kiro/steering/', () => {
    const target: Target = { name: 'test', type: 'kiro', scope: 'repository', rootPath: '/ws' };
    const layout = resolveLayout(target);
    expect(layout.baseDir).toBe('/ws');
    expect(layout.kindRoutes['prompts/']).toBe('.kiro/steering/');
  });

  it('throws for an unknown target type', () => {
    const target = { name: 'test', type: 'nonexistent', scope: 'user' } as unknown as Target;
    expect(() => resolveLayout(target)).toThrow('No layout defined for target type "nonexistent"');
  });
});

describe('resolveLayoutAsync', () => {
  it('resolves using an injected loader', async () => {
    const target: Target = { name: 'test', type: 'vscode', scope: 'user' };
    const layout = await resolveLayoutAsync(target, new BuiltInOnlyLayoutConfigLoader());
    expect(layout.kindRoutes).toHaveProperty('prompts/');
  });
});

describe('expandPath', () => {
  it('expands ${VAR} tokens from the env map', () => {
    expect(expandPath('${HOME}/.config', { HOME: '/home/alice' })).toBe('/home/alice/.config');
  });

  it('expands a leading ~ using HOME', () => {
    expect(expandPath('~/.config', { HOME: '/home/alice' })).toBe('/home/alice/.config');
  });

  it('falls back to USERPROFILE when HOME is unset', () => {
    expect(expandPath('~/.config', { USERPROFILE: 'C:/Users/alice' })).toBe('C:/Users/alice/.config');
  });

  it('leaves unmatched tokens blank rather than throwing', () => {
    expect(expandPath('${UNKNOWN}/x', {})).toBe('/x');
  });
});

describe('FileTreeTargetWriter', () => {
  const target: Target = { name: 'test', type: 'vscode', scope: 'user', path: '/out' };

  it('writes routed files into the resolved layout', async () => {
    const fs = new InMemoryFileSystem();
    const writer = new FileTreeTargetWriter({ fs, env: {} });
    const files = new Map<string, Uint8Array>([
      ['prompts/test.md', new TextEncoder().encode('# Test')]
    ]);

    const result = await writer.write(target, files);

    expect(result.written).toContain('/out/prompts/test.md');
    expect(result.skipped).toEqual([]);
    expect(await fs.readFile('/out/prompts/test.md')).toBe('# Test');
  });

  it('skips files in the layout skipPaths list', async () => {
    const fs = new InMemoryFileSystem();
    const writer = new FileTreeTargetWriter({ fs, env: {} });
    const files = new Map<string, Uint8Array>([
      ['deployment-manifest.yml', new TextEncoder().encode('id: x')]
    ]);

    const result = await writer.write(target, files);

    expect(result.written).toEqual([]);
  });

  it('skips unrouted files without erroring', async () => {
    const fs = new InMemoryFileSystem();
    const writer = new FileTreeTargetWriter({ fs, env: {} });
    const files = new Map<string, Uint8Array>([
      ['unrouted/thing.bin', new TextEncoder().encode('data')]
    ]);

    const result = await writer.write(target, files);

    expect(result.written).toEqual([]);
    expect(result.skipped).toContain('unrouted/thing.bin');
  });

  it('honors target.allowedKinds by skipping excluded kinds', async () => {
    const fs = new InMemoryFileSystem();
    const writer = new FileTreeTargetWriter({ fs, env: {} });
    const restrictedTarget: Target = { ...target, allowedKinds: ['skills'] };
    const files = new Map<string, Uint8Array>([
      ['prompts/test.md', new TextEncoder().encode('# Test')],
      ['skills/my-skill/SKILL.md', new TextEncoder().encode('# Skill')]
    ]);

    const result = await writer.write(restrictedTarget, files);

    expect(result.written).toContain('/out/skills/my-skill/SKILL.md');
    expect(result.skipped).toContain('prompts/test.md');
  });

  it('applies a resource transformer to file content', async () => {
    const fs = new InMemoryFileSystem();
    const transformer: ResourceTransformer = {
      transform: (ctx) => ({ content: `${ctx.content}\n<!-- transformed -->`, modified: true })
    };
    const writer = new FileTreeTargetWriter({ fs, env: {}, transformer });
    const files = new Map<string, Uint8Array>([
      ['prompts/test.md', new TextEncoder().encode('# Test')]
    ]);

    await writer.write(target, files);

    expect(await fs.readFile('/out/prompts/test.md')).toBe('# Test\n<!-- transformed -->');
  });

  it('falls back to original content when the transformer throws', async () => {
    const fs = new InMemoryFileSystem();
    const transformer: ResourceTransformer = {
      transform: () => {
        throw new Error('boom');
      }
    };
    const writer = new FileTreeTargetWriter({ fs, env: {}, transformer });
    const files = new Map<string, Uint8Array>([
      ['prompts/test.md', new TextEncoder().encode('# Test')]
    ]);

    await writer.write(target, files);

    expect(await fs.readFile('/out/prompts/test.md')).toBe('# Test');
  });

  it('removes a routed file', async () => {
    const fs = new InMemoryFileSystem();
    fs.seed('/out/prompts/test.md', '# Test');
    const writer = new FileTreeTargetWriter({ fs, env: {} });

    await writer.remove(target, 'prompts/test.md');

    expect(await fs.exists('/out/prompts/test.md')).toBe(false);
  });

  it('no-ops removing an unrouted file', async () => {
    const fs = new InMemoryFileSystem();
    const writer = new FileTreeTargetWriter({ fs, env: {} });

    await expect(writer.remove(target, 'unrouted/thing.bin')).resolves.not.toThrow();
  });
});
