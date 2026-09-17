import type {
  ExtractedFiles,
} from '../../ports/bundle-extractor';
import type {
  ReleaseDeploymentManifest,
} from '../collection/types';
import type {
  Target,
  TargetType,
} from './target';

const ENTRYPOINT = '.aidlc-plugin-projection.json';
const PLUGIN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const TARGET_HARNESSES: Partial<Record<TargetType, string>> = {
  vscode: 'copilot',
  'vscode-insiders': 'copilot',
  'copilot-cli': 'copilot',
  kiro: 'kiro-ide',
  'kiro-cli': 'kiro',
  'claude-code': 'claude',
  cursor: 'cursor',
  opencode: 'opencode'
};

export interface AidlcPluginDescriptor {
  plugin: string;
  harness: string;
  itemPath: string;
  bundleRoot: string;
}

export class AidlcPluginValidationError extends Error {
  public constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'AidlcPluginValidationError';
  }
}

/**
 * Resolve the AIDLC projection harness used by an installation target.
 * @param targetType Target runtime type.
 * @returns Harness identifier, or null when AIDLC does not support the target.
 */
export function getAidlcHarness(targetType: TargetType): string | null {
  return TARGET_HARNESSES[targetType] ?? null;
}

/**
 * Validate every AIDLC plugin projection before target files are written.
 * @param manifest Governed release manifest.
 * @param files Extracted archive files.
 * @param target Requested installation target.
 * @returns Validated plugin descriptors used by post-install activation.
 */
export function validateAidlcPluginBundleForTarget(
  manifest: ReleaseDeploymentManifest,
  files: ExtractedFiles,
  target: Target
): AidlcPluginDescriptor[] {
  const items = manifest.items.filter((item) => item.kind === 'aidlc-plugin');
  if (items.length === 0) {
    return [];
  }

  if (target.scope !== 'repository' || !target.rootPath) {
    throw new AidlcPluginValidationError(
      'AIDLC_PLUGIN.REPOSITORY_SCOPE_REQUIRED',
      'AIDLC plugins require a repository-scoped target with a workspace root path.'
    );
  }

  const expectedHarness = getAidlcHarness(target.type);
  if (!expectedHarness) {
    throw new AidlcPluginValidationError(
      'AIDLC_PLUGIN.UNSUPPORTED_TARGET',
      `AIDLC plugins are not supported for target type "${target.type}".`
    );
  }

  return items.map((item) => {
    const segments = item.path.split('/');
    if (segments.length !== 3
      || segments[0] !== 'aidlc-plugins'
      || !PLUGIN_ID.test(segments[1] ?? '')
      || segments[2] !== ENTRYPOINT) {
      throw new AidlcPluginValidationError(
        'AIDLC_PLUGIN.INVALID_PATH',
        `AIDLC plugin entry path must be aidlc-plugins/<plugin>/${ENTRYPOINT}: ${item.path}`
      );
    }

    const projectionBytes = files.get(item.path);
    if (!projectionBytes) {
      throw new AidlcPluginValidationError(
        'AIDLC_PLUGIN.MISSING_PROJECTION',
        `AIDLC plugin projection is missing from the bundle: ${item.path}`
      );
    }

    let projection: unknown;
    try {
      projection = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(projectionBytes));
    } catch {
      throw new AidlcPluginValidationError(
        'AIDLC_PLUGIN.INVALID_PROJECTION',
        `AIDLC plugin projection is not valid UTF-8 JSON: ${item.path}`
      );
    }

    if (projection === null || typeof projection !== 'object' || Array.isArray(projection)) {
      throw new AidlcPluginValidationError('AIDLC_PLUGIN.INVALID_PROJECTION', `Invalid AIDLC projection: ${item.path}`);
    }
    const metadata = projection as Record<string, unknown>;
    if (metadata.schema !== 1 || metadata.producer !== 'aidlc-plugin-build') {
      throw new AidlcPluginValidationError(
        'AIDLC_PLUGIN.INVALID_PROJECTION',
        `AIDLC projection must use schema 1 and producer "aidlc-plugin-build": ${item.path}`
      );
    }
    if (metadata.plugin !== segments[1]) {
      throw new AidlcPluginValidationError(
        'AIDLC_PLUGIN.PLUGIN_ID_MISMATCH',
        `AIDLC projection plugin must match its containing directory: ${item.path}`
      );
    }
    if (metadata.harness !== expectedHarness) {
      throw new AidlcPluginValidationError(
        'AIDLC_PLUGIN.HARNESS_MISMATCH',
        `AIDLC projection harness "${String(metadata.harness)}" is incompatible with target "${target.type}"; expected "${expectedHarness}".`
      );
    }

    return {
      plugin: segments[1],
      harness: expectedHarness,
      itemPath: item.path,
      bundleRoot: `aidlc-plugins/${segments[1]}`
    };
  });
}
