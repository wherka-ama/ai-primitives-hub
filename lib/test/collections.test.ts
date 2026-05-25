import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import {
  generateMarkdown,
  listCollectionFiles,
  loadItemKindsFromSchema,
  readCollection,
  resolveCollectionItemPaths,
  validateAllCollections,
  validateCollectionFile,
} from '../src/app/collection/read-collection';
import {
  createTempDir,
} from './helpers/install-test-helpers';

let tempDir: string;
let cleanup: () => void;

beforeEach(() => {
  [tempDir, cleanup] = createTempDir('collections-test-');
});

afterEach(() => {
  cleanup();
});

function writeFile(root: string, relativePath: string, content: string): void {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

describe('Collections Module', () => {
  describe('listCollectionFiles()', () => {
    it('should find .collection.yml files', () => {
      writeFile(tempDir, 'collections/first.collection.yml', 'id: first\nname: First\nitems: []');
      writeFile(tempDir, 'collections/second.collection.yml', 'id: second\nname: Second\nitems: []');
      writeFile(tempDir, 'collections/readme.md', '# Collections');

      const files = listCollectionFiles(tempDir);

      expect(files.length).toBe(2);
      expect(files.every((f: string) => f.endsWith('.collection.yml'))).toBe(true);
      expect(files.some((f: string) => f.includes('first.collection.yml'))).toBe(true);
      expect(files.some((f: string) => f.includes('second.collection.yml'))).toBe(true);
    });

    it('should return empty array when no collections exist', () => {
      fs.mkdirSync(path.join(tempDir, 'collections'), { recursive: true });
      writeFile(tempDir, 'collections/readme.md', '# Collections');

      const files = listCollectionFiles(tempDir);

      expect(files.length).toBe(0);
    });
  });

  describe('readCollection()', () => {
    it('should parse required fields', () => {
      writeFile(tempDir, 'collections/test.collection.yml', `
id: test-collection
name: Test Collection
description: A test collection
version: "1.0.0"
items:
  - path: prompts/test.md
    kind: prompt
`);

      const collection = readCollection(tempDir, 'collections/test.collection.yml');

      expect(collection.id).toBe('test-collection');
      expect(collection.name).toBe('Test Collection');
      expect(Array.isArray(collection.items)).toBe(true);
      expect(collection.items.length).toBe(1);
    });

    it('should handle optional fields', () => {
      writeFile(tempDir, 'collections/minimal.collection.yml', `
id: minimal
name: Minimal
items: []
`);

      const collection = readCollection(tempDir, 'collections/minimal.collection.yml');

      expect(collection.id).toBe('minimal');
      expect(collection.name).toBe('Minimal');
      expect(collection.items).toStrictEqual([]);
      expect(collection.version).toBeUndefined();
    });

    it('should throw for invalid YAML', () => {
      writeFile(tempDir, 'collections/invalid.collection.yml', `
id: test
name: Test
items: [unclosed bracket
`);

      expect(() => readCollection(tempDir, 'collections/invalid.collection.yml')).toThrow();
    });

    it('should accept absolute paths', () => {
      writeFile(tempDir, 'collections/test.collection.yml', `
id: test
name: Test
items: []
`);

      const absPath = path.join(tempDir, 'collections/test.collection.yml');
      const collection = readCollection(tempDir, absPath);

      expect(collection.id).toBe('test');
    });
  });

  describe('resolveCollectionItemPaths()', () => {
    it('should return repo-root relative paths', () => {
      const collection = {
        id: 'test',
        name: 'Test',
        items: [
          { path: 'prompts/first.md', kind: 'prompt' },
          { path: 'prompts/second.md', kind: 'prompt' },
          { path: 'instructions/inst.md', kind: 'instruction' }
        ]
      };

      const paths = resolveCollectionItemPaths(tempDir, collection);

      expect(paths.length).toBe(3);
      expect(paths.every((p: string) => !p.startsWith('..'))).toBe(true);
      expect(paths.every((p: string) => !p.startsWith('/'))).toBe(true);
      expect(paths).toStrictEqual([
        'prompts/first.md',
        'prompts/second.md',
        'instructions/inst.md'
      ]);
    });

    it('should handle empty items array', () => {
      const collection = {
        id: 'empty',
        name: 'Empty',
        items: []
      };

      const paths = resolveCollectionItemPaths(tempDir, collection);

      expect(paths).toStrictEqual([]);
    });

    it('should normalize Windows-style paths', () => {
      const collection = {
        id: 'test',
        name: 'Test',
        items: [{ path: 'prompts\\windows\\style.md', kind: 'prompt' }]
      };

      const paths = resolveCollectionItemPaths(tempDir, collection);

      expect(paths.length).toBe(1);
      expect(!paths[0].includes('\\')).toBe(true);
    });

    it('should filter out items without path', () => {
      const collection = {
        id: 'test',
        name: 'Test',
        items: [
          { path: 'prompts/valid.md', kind: 'prompt' },
          { kind: 'prompt' } as any, // Missing path
          { path: '', kind: 'prompt' }, // Empty path
          { path: 'prompts/another.md', kind: 'prompt' }
        ]
      };

      const paths = resolveCollectionItemPaths(tempDir, collection);

      expect(paths.length).toBe(2);
      expect(paths).toStrictEqual(['prompts/valid.md', 'prompts/another.md']);
    });

    it('should include all files in skill directory when kind is skill', () => {
      // Create a skill directory structure
      writeFile(tempDir, 'skills/my-skill/SKILL.md', '# My Skill\nDescription here');
      writeFile(tempDir, 'skills/my-skill/assets/diagram.png', 'fake-png-content');
      writeFile(tempDir, 'skills/my-skill/references/doc.md', '# Reference Doc');
      writeFile(tempDir, 'skills/my-skill/scripts/helper.js', 'console.log("helper")');

      const collection = {
        id: 'test',
        name: 'Test',
        items: [{ path: 'skills/my-skill/SKILL.md', kind: 'skill' }]
      };

      const paths = resolveCollectionItemPaths(tempDir, collection);

      expect(paths.length).toBeGreaterThanOrEqual(4);
      expect(paths.includes('skills/my-skill/SKILL.md')).toBe(true);
      expect(paths.includes('skills/my-skill/assets/diagram.png')).toBe(true);
      expect(paths.includes('skills/my-skill/references/doc.md')).toBe(true);
      expect(paths.includes('skills/my-skill/scripts/helper.js')).toBe(true);
    });

    it('should include skill directory files alongside regular prompts', () => {
      // Create skill directory
      writeFile(tempDir, 'skills/my-skill/SKILL.md', '# My Skill');
      writeFile(tempDir, 'skills/my-skill/assets/image.png', 'fake-png');

      // Create regular prompt
      writeFile(tempDir, 'prompts/simple.prompt.md', '# Simple Prompt');

      const collection = {
        id: 'test',
        name: 'Test',
        items: [
          { path: 'skills/my-skill/SKILL.md', kind: 'skill' },
          { path: 'prompts/simple.prompt.md', kind: 'prompt' }
        ]
      };

      const paths = resolveCollectionItemPaths(tempDir, collection);

      expect(paths.includes('skills/my-skill/SKILL.md')).toBe(true);
      expect(paths.includes('skills/my-skill/assets/image.png')).toBe(true);
      expect(paths.includes('prompts/simple.prompt.md')).toBe(true);
    });
  });

  describe('loadItemKindsFromSchema()', () => {
    it('should return fallback kinds when schema is unavailable', () => {
      const kinds = loadItemKindsFromSchema('/nonexistent/path');

      expect(kinds).toEqual(['prompt', 'instruction', 'agent', 'skill']);
    });

    it('should return kinds from schema when available', () => {
      const kinds = loadItemKindsFromSchema();

      expect(Array.isArray(kinds)).toBe(true);
      expect(kinds.length).toBeGreaterThan(0);
      expect(kinds).toContain('prompt');
      expect(kinds).toContain('skill');
    });
  });

  describe('validateCollectionFile()', () => {
    it('should return error when file does not exist', () => {
      const result = validateCollectionFile(tempDir, 'collections/nonexistent.yml');

      expect(result.ok).toBe(false);
      expect(result.errors).toContain('collections/nonexistent.yml: Collection file not found');
    });

    it('should return error for invalid YAML', () => {
      writeFile(tempDir, 'collections/invalid.yml', 'invalid: [unclosed');

      const result = validateCollectionFile(tempDir, 'collections/invalid.yml');

      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('YAML parse error'))).toBe(true);
    });

    it('should validate collection and check referenced files', () => {
      writeFile(tempDir, 'collections/valid.yml', `
id: test
name: Test
items:
  - path: prompts/test.md
    kind: prompt
`);
      writeFile(tempDir, 'prompts/test.md', '# Test');

      const result = validateCollectionFile(tempDir, 'collections/valid.yml');

      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.collection).toBeDefined();
    });

    it('should return error when referenced file does not exist', () => {
      writeFile(tempDir, 'collections/missing-ref.yml', `
id: test
name: Test
items:
  - path: prompts/missing.md
    kind: prompt
`);

      const result = validateCollectionFile(tempDir, 'collections/missing-ref.yml');

      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('referenced file not found'))).toBe(true);
    });
  });

  describe('validateAllCollections()', () => {
    it('should validate multiple collections and detect duplicates', () => {
      writeFile(tempDir, 'collections/first.yml', `
id: duplicate-id
name: First
items: []
`);
      writeFile(tempDir, 'collections/second.yml', `
id: duplicate-id
name: Second
items: []
`);

      const result = validateAllCollections(tempDir, ['collections/first.yml', 'collections/second.yml']);

      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('Duplicate collection ID'))).toBe(true);
    });

    it('should return ok when all collections are valid', () => {
      writeFile(tempDir, 'collections/first.yml', `
id: first
name: First
items: []
`);
      writeFile(tempDir, 'collections/second.yml', `
id: second
name: Second
items: []
`);

      const result = validateAllCollections(tempDir, ['collections/first.yml', 'collections/second.yml']);

      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('generateMarkdown()', () => {
    it('should generate success markdown', () => {
      const result = { ok: true, errors: [], fileResults: [] };
      const md = generateMarkdown(result, 2);

      expect(md).toContain('✅');
      expect(md).toContain('All 2 collection(s) validated successfully!');
    });

    it('should generate error markdown', () => {
      const result = { ok: false, errors: ['Error 1', 'Error 2'], fileResults: [] };
      const md = generateMarkdown(result, 2);

      expect(md).toContain('❌');
      expect(md).toContain('2 error(s)');
      expect(md).toContain('Error 1');
      expect(md).toContain('Error 2');
    });
  });
});
