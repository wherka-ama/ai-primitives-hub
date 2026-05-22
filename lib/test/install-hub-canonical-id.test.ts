/**
 * Regression test: hub canonical bundle ID vs. bundle's native manifest ID.
 *
 * When a bundle is listed in a hub config its ID is a synthesized
 * canonical form: "{owner}-{repo}-{native-id}".  The bundle's own
 * deployment-manifest.yml carries only the short native ID.
 *
 * Before the fix, performRemoteInstall passed spec.bundleId (canonical)
 * as expectedId to validateManifest, causing a BUNDLE.ID_MISMATCH error.
 *
 * After the fix, expectedId is undefined when opts.sourceConfig is set
 * (hub-driven install), so the manifest's native ID is accepted as-is.
 */
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import {
  createInstallCommand,
} from '../src/cli/commands/install';
import {
  runCommand,
} from '../src/cli/framework';
import type {
  RegistrySource,
} from '../src/domain/registry/registry-source';
import {
  NodeFileSystem,
} from '../src/infra/fs/node-filesystem';
import {
  NULL_TOKEN_PROVIDER,
} from '../src/infra/github/token';
import {
  buildZip,
} from '../src/infra/writers/zip-writer';
import {
  okResponse,
  RecordingHttpClient,
} from './install-http.test';

const CANONICAL_BUNDLE_ID = 'amadeus-airlines-solutions-workflow-instructions-workflow-nevio';
const NATIVE_MANIFEST_ID = 'workflow-nevio';
const REPO_URL = 'https://github.com/amadeus-airlines-solutions/workflow-instructions';

const RELEASES_URL = 'GET https://api.github.com/repos/amadeus-airlines-solutions/workflow-instructions/releases';
const DOWNLOAD_URL = 'https://example.com/workflow-nevio.bundle.zip';

const makeBundle = (): Uint8Array =>
  buildZip([
    {
      path: 'deployment-manifest.yml',
      bytes: Buffer.from(
        `id: ${NATIVE_MANIFEST_ID}\nversion: 2.0.7\nname: Task Driven Workflow\n`
      )
    }
  ]);

const makeHttp = (): RecordingHttpClient =>
  new RecordingHttpClient({
    [RELEASES_URL]: okResponse(JSON.stringify([
      {
        tag_name: 'workflow-nevio-v2.0.7',
        assets: [
          {
            name: 'workflow-nevio.bundle.zip',
            browser_download_url: DOWNLOAD_URL
          }
        ]
      }
    ])),
    [`GET ${DOWNLOAD_URL}`]: okResponse(makeBundle())
  });

const SOURCE_CONFIG: RegistrySource = {
  id: 'spec-driven-instructions',
  name: 'Task driven workflow',
  type: 'github',
  url: REPO_URL,
  enabled: true,
  priority: 1,
  hubId: 'amadeus-hub'
};

describe('install: hub canonical vs. native manifest ID', () => {
  let tmp: string;
  let targetDir: string;

  beforeEach(async () => {
    tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'prc-hub-id-'));
    targetDir = path.join(tmp, 'target');
    await fsp.mkdir(targetDir, { recursive: true });

    const config = [
      'targets:',
      '  - name: my-target',
      '    type: vscode',
      `    path: ${targetDir}`,
      '    scope: user'
    ].join('\n');
    await fsp.writeFile(path.join(tmp, 'prompt-registry.yml'), config, 'utf8');
  });

  afterEach(async () => {
    await fsp.rm(tmp, { recursive: true, force: true });
  });

  it('succeeds when manifest native id differs from canonical hub id', async () => {
    const http = makeHttp();
    const result = await runCommand(['install'], {
      commands: [
        createInstallCommand({
          output: 'json',
          bundle: CANONICAL_BUNDLE_ID,
          target: 'my-target',
          source: REPO_URL,
          sourceConfig: SOURCE_CONFIG,
          http,
          tokens: NULL_TOKEN_PROVIDER
        })
      ],
      context: {
        cwd: tmp,
        fs: new NodeFileSystem()
      }
    });

    const parsed = JSON.parse(result.stdout) as {
      status: string;
      data?: { bundle?: { id: string } };
      errors?: { code: string; message: string }[];
    };

    expect(parsed.errors?.[0]?.code ?? 'none').not.toBe('BUNDLE.ID_MISMATCH');
    expect(parsed.status).toBe('ok');
    expect(parsed.data?.bundle?.id).toBe(NATIVE_MANIFEST_ID);
  });

  it('still enforces id check when no sourceConfig is set (non-hub install)', async () => {
    const http = makeHttp();
    const result = await runCommand(['install'], {
      commands: [
        createInstallCommand({
          output: 'json',
          bundle: CANONICAL_BUNDLE_ID,
          target: 'my-target',
          source: 'amadeus-airlines-solutions/workflow-instructions',
          http,
          tokens: NULL_TOKEN_PROVIDER
        })
      ],
      context: {
        cwd: tmp,
        fs: new NodeFileSystem()
      }
    });

    const parsed = JSON.parse(result.stdout) as {
      status: string;
      errors?: { code: string }[];
    };

    expect(parsed.errors?.[0]?.code).toBe('BUNDLE.ID_MISMATCH');
  });
});
