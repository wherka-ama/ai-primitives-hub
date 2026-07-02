import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  GhCliTokenProvider,
} from '../../src/auth/gh-cli-token-provider';

describe('GhCliTokenProvider', () => {
  it('returns the trimmed stdout when gh auth token succeeds', async () => {
    const provider = new GhCliTokenProvider(async () => ({ stdout: '  gho_abc123\n' }));
    await expect(provider.getToken()).resolves.toBe('gho_abc123');
  });

  it('returns undefined when gh auth token exits non-zero (not installed or not authenticated)', async () => {
    const provider = new GhCliTokenProvider(() => Promise.reject(new Error('command not found: gh')));
    await expect(provider.getToken()).resolves.toBeUndefined();
  });

  it('returns undefined when gh auth token succeeds but prints nothing', async () => {
    const provider = new GhCliTokenProvider(async () => ({ stdout: '   \n' }));
    await expect(provider.getToken()).resolves.toBeUndefined();
  });

  it('invokes exactly the gh auth token command', async () => {
    const seenCommands: string[] = [];
    const provider = new GhCliTokenProvider((command) => {
      seenCommands.push(command);
      return Promise.resolve({ stdout: 'token' });
    });
    await provider.getToken();
    expect(seenCommands).toEqual(['gh auth token']);
  });
});
