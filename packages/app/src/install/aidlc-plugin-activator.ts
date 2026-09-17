import type {
  AidlcPluginDescriptor,
  ProcessExecutor,
  Target,
} from '@ai-primitives-hub/core';

export interface AidlcPluginActivator {
  activate(target: Target, plugins: readonly AidlcPluginDescriptor[]): Promise<void>;
}

export class ProcessAidlcPluginActivator implements AidlcPluginActivator {
  public constructor(
    private readonly executor: ProcessExecutor,
    private readonly executable = 'aidlc'
  ) {}

  public async activate(target: Target, plugins: readonly AidlcPluginDescriptor[]): Promise<void> {
    if (plugins.length === 0) {
      return;
    }
    if (!target.rootPath) {
      throw new Error('AIDLC plugin activation requires a workspace root path.');
    }

    const harnesses = new Set(plugins.map((plugin) => plugin.harness));
    if (harnesses.size !== 1) {
      throw new Error('AIDLC plugin projections for one installation must target the same harness.');
    }
    const harness = plugins[0]?.harness;
    if (!harness) {
      return;
    }

    await this.executor.execFile(
      this.executable,
      ['engine', 'plugin', 'sync', '--project-dir', target.rootPath],
      {
        cwd: target.rootPath,
        env: {
          AIDLC_PROJECT_DIR: target.rootPath,
          AIDLC_HARNESS_NAME: harness,
          AIDLC_HARNESS_DIR: getHarnessDirectory(target),
          AIDLC_PLUGIN_ROOT: getPluginRoot(target)
        }
      }
    );
  }
}

const getHarnessDirectory = (target: Target): string => {
  switch (target.type) {
    case 'vscode':
    case 'vscode-insiders':
    case 'copilot-cli': {
      return '.github';
    }
    case 'claude-code': {
      return '.claude';
    }
    case 'cursor': {
      return '.cursor';
    }
    case 'opencode': {
      return '.opencode';
    }
    case 'kiro':
    case 'kiro-cli': {
      return '.kiro';
    }
    default: {
      throw new Error(`Unsupported AIDLC target: ${target.type}`);
    }
  }
};

const getPluginRoot = (target: Target): string => `${getHarnessDirectory(target)}/aidlc-plugins`;
