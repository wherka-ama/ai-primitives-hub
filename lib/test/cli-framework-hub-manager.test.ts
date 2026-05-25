import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  createHubManager,
} from '../src/cli/framework';

describe('createHubManager', () => {
  it('creates a HubManager instance with required dependencies', () => {
    const ctx = {
      env: {
        HOME: '/home/test'
      },
      cwd: () => '/workspace',
      fs: {
        exists: async () => false,
        readFile: async () => '',
        writeFile: async () => {},
        mkdir: async () => {},
        readDir: async () => [],
        remove: async () => {},
        readJson: async () => ({} as never),
        writeJson: async () => {}
      }
    };

    const http = {
      getText: async () => '',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({}),
        arrayBuffer: async () => new ArrayBuffer(0)
      })
    };

    const tokens = {
      getToken: async () => 'test-token'
    };

    const hubManager = createHubManager({ ctx, http, tokens });
    expect(hubManager).toBeDefined();
    expect(hubManager).toHaveProperty('syncHub');
  });
});
