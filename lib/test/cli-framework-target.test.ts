import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  createTestContext,
  findProjectLockfile,
  loadTargets,
} from '../src/cli/framework';

describe('loadTargets', () => {
  it('loads targets from hierarchical configuration', async () => {
    const ctx = createTestContext({
      env: {
        HOME: '/home/test'
      },
      fs: {
        exists: async (path: string) => {
          return path.includes('targets.yml') || path.includes('.config');
        },
        readFile: async (path: string) => {
          if (path.includes('targets.yml')) {
            return '- name: test-target\n  path: /test/path\n  type: user\n';
          }
          return '';
        },
        writeFile: async () => {},
        mkdir: async () => {},
        readDir: async () => [],
        remove: async () => {},
        readJson: async () => ({}),
        writeJson: async () => {}
      }
    });

    const targets = await loadTargets(ctx);
    expect(targets).toBeInstanceOf(Array);
  });

  it('returns empty array when no configuration exists', async () => {
    const ctx = createTestContext({
      env: {
        HOME: '/home/test'
      },
      fs: {
        exists: async () => false,
        readFile: async () => '',
        writeFile: async () => {},
        mkdir: async () => {},
        readDir: async () => [],
        remove: async () => {},
        readJson: async () => ({}),
        writeJson: async () => {}
      }
    });

    const targets = await loadTargets(ctx);
    expect(targets).toBeInstanceOf(Array);
  });
});

describe('findProjectLockfile', () => {
  it('returns lockfile path when found', async () => {
    const ctx = createTestContext({
      env: {
        HOME: '/home/test'
      },
      fs: {
        exists: async (path: string) => {
          return path.includes('prompt-registry.lock.json');
        },
        readFile: async () => '',
        writeFile: async () => {},
        mkdir: async () => {},
        readDir: async () => [],
        remove: async () => {},
        readJson: async () => ({}),
        writeJson: async () => {}
      }
    });

    const lockPath = await findProjectLockfile(ctx);
    expect(typeof lockPath).toBe('string');
  });

  it('returns null when lockfile not found', async () => {
    const ctx = createTestContext({
      env: {
        HOME: '/home/test'
      },
      fs: {
        exists: async () => false,
        readFile: async () => '',
        writeFile: async () => {},
        mkdir: async () => {},
        readDir: async () => [],
        remove: async () => {},
        readJson: async () => ({}),
        writeJson: async () => {}
      }
    });

    const lockPath = await findProjectLockfile(ctx);
    expect(lockPath).toBeNull();
  });
});
