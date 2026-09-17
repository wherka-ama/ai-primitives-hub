import type {
  ProcessExecutor,
  Target,
} from '@ai-primitives-hub/core';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  ProcessAidlcPluginActivator,
} from '../../src/install/aidlc-plugin-activator';

const target: Target = {
  name: 'kiro',
  type: 'kiro',
  scope: 'repository',
  rootPath: '/workspace'
};

describe('ProcessAidlcPluginActivator', () => {
  it('runs the fixed AIDLC sync command with controlled environment', async () => {
    const execFile = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
    const executor: ProcessExecutor = { execFile };

    await new ProcessAidlcPluginActivator(executor).activate(target, [{
      plugin: 'example',
      harness: 'kiro-ide',
      itemPath: 'aidlc-plugins/example/.aidlc-plugin-projection.json',
      bundleRoot: 'aidlc-plugins/example'
    }]);

    expect(execFile).toHaveBeenCalledWith(
      'aidlc',
      ['engine', 'plugin', 'sync', '--project-dir', '/workspace'],
      {
        cwd: '/workspace',
        env: {
          AIDLC_PROJECT_DIR: '/workspace',
          AIDLC_HARNESS_DIR: '.kiro',
          AIDLC_HARNESS_NAME: 'kiro-ide',
          AIDLC_PLUGIN_ROOT: '.kiro/aidlc-plugins'
        }
      }
    );
  });

  it('does not spawn AIDLC for bundles without plugins', async () => {
    const execFile = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
    await new ProcessAidlcPluginActivator({ execFile }).activate(target, []);
    expect(execFile).not.toHaveBeenCalled();
  });
});
