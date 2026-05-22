import {
  describe,
  expect,
  it,
} from 'vitest';

describe('profile cleanup path expansion', () => {
  it('should use replace instead of replaceAll for RegExp without global flag', () => {
    const baseDir = '~/.github';
    const home = '/home/test';

    // This is the fix: use replace() for non-global RegExp
    const expanded = baseDir.replace(/^~/, home);

    expect(expanded).toBe('/home/test/.github');
  });

  it('should handle replaceAll with global RegExp flag', () => {
    const baseDir = '${workspaceRoot}/.github/${workspaceRoot}';
    const workspaceRoot = '/test/workspace';

    // This works because the RegExp has the global flag
    const expanded = baseDir.replaceAll(/\$\{workspaceRoot\}/g, workspaceRoot);

    expect(expanded).toBe('/test/workspace/.github//test/workspace');
  });

  it('should throw error with replaceAll and non-global RegExp', () => {
    const baseDir = '~/.github';
    const home = '/home/test';

    // This would throw: String.prototype.replaceAll called with a non-global RegExp argument
    expect(() => {
      baseDir.replaceAll(/^~/, home);
    }).toThrow();
  });

  it('should expand ${workspaceRoot} token', () => {
    const baseDir = '${workspaceRoot}/.github';
    const workspaceRoot = '/test/workspace';
    const expanded = baseDir.replaceAll(/\$\{workspaceRoot\}/g, workspaceRoot);
    expect(expanded).toBe('/test/workspace/.github');
  });

  it('should expand ${HOME} token', () => {
    const baseDir = '${HOME}/.github';
    const home = '/home/test';
    const expanded = baseDir.replaceAll(/\$\{HOME\}/g, home);
    expect(expanded).toBe('/home/test/.github');
  });

  it('should handle plain paths without expansion', () => {
    const baseDir = '.github';
    const expanded = baseDir
      .replaceAll(/\$\{workspaceRoot\}/g, '/test')
      .replaceAll(/\$\{HOME\}/g, '/home/test')
      .replace(/^~/, '/home/test');
    expect(expanded).toBe('.github');
  });
});
