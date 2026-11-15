/**
 * `index pull` — install the search index a Hub publishes instead of harvesting it.
 *
 * The index is installed into the shared index cache under the active hub (or
 * `--hub-id`) and pinned, so `index search` without `--index` uses it until
 * `index pull --unpin`.
 * @module commands/index-pull
 */
import * as path from 'node:path';
import {
  canonicalizeIndexHubId,
  resolveUserConfigPaths,
} from '@ai-primitives-hub/app';
import {
  ActiveHubStore,
  AppStoragePrimitiveIndexStore,
  createTokenResolver,
  HubIndexPullError,
  type HubIndexPullResult,
  NodeProcessExecutor,
  pullHubIndex,
  resolveGithubToken,
  TERNLIGHT_MODEL,
  unpinHubIndex,
  XdgAppStorage,
} from '@ai-primitives-hub/infra';
import {
  Command,
  type Context,
  failWith,
  formatOutput,
  Option,
  type OutputFormat,
  RegistryError,
} from '../framework';

async function activeHubId(ctx: Context): Promise<string | undefined> {
  const userPaths = resolveUserConfigPaths(ctx.env);
  const pointers = [userPaths.activeHub, path.join(path.dirname(userPaths.root), 'prompt-registry', 'active-hub.json')];
  for (const pointer of pointers) {
    const id = await new ActiveHubStore(pointer, ctx.fs).get();
    if (id !== null) {
      return id;
    }
  }
  return undefined;
}

/**
 * Index pull command class.
 */
export class IndexPullCommand extends Command {
  public static readonly paths = [['index', 'pull']];

  public static readonly usage = Command.Usage({
    description: 'Install the search index a Hub publishes, instead of harvesting it locally.',
    category: 'Index & Search',
    details: `
      Usage: ai-primitives-hub index pull --from <location> [options]

      The manifest is read first; the index is downloaded only when it differs
      from the installed one and is newer. It is checked against the manifest
      (size, SHA-256, identity, embedding model), installed in the shared index
      cache and pinned: \`index search\` uses it until \`index pull --unpin\`.

      Options:
        --from <location>        Directory, https base URL, or github:OWNER/REPO[@TAG]
                                 (newest hub-index-* release when no tag is given)
        --hub-id <id>            Hub namespace to install under (default: active hub,
                                 then the manifest hubId)
        --token-env <name>       Environment variable holding the token; github:
                                 sources otherwise use GITHUB_TOKEN, GH_TOKEN or gh
        --verify-attestation <OWNER/REPO>
                                 Require build provenance for the manifest from that
                                 repository (runs gh attestation verify)
        --allow-rollback         Accept a publication that is not newer than the installed one
        --no-pin                 Install without preferring it over harvested indexes
        --unpin                  Unpin the hub's published indexes and exit
        -o, --output <format>    Output format (text, json, yaml, ndjson)

      Examples:
        ai-primitives-hub index pull --from github:OWNER/HUB-REPO --verify-attestation OWNER/HUB-REPO
        ai-primitives-hub index pull --from ./out/hub-index
        ai-primitives-hub index pull --unpin
    `
  });

  public from = Option.String('--from');
  public hubId = Option.String('--hub-id');
  public tokenEnv = Option.String('--token-env');
  public verifyAttestation = Option.String('--verify-attestation');
  public allowRollback = Option.Boolean('--allow-rollback', false);
  public pin = Option.Boolean('--pin', true);
  public unpin = Option.Boolean('--unpin', false);
  public output = Option.String('-o,--output');
  public commandContext!: { ctx: Context };

  public async execute(): Promise<number> {
    const { ctx } = this.commandContext;
    const fmt = (this.output ?? 'text') as OutputFormat;
    const store = new AppStoragePrimitiveIndexStore(new XdgAppStorage(ctx.env));
    const requestedHub = this.hubId ?? await activeHubId(ctx);
    const hubId = requestedHub === undefined ? undefined : canonicalizeIndexHubId(requestedHub);

    if (this.unpin) {
      if (hubId === undefined) {
        return failWith(ctx, fmt, 'index.pull', new RegistryError({
          code: 'USAGE.MISSING_FLAG',
          message: 'index pull --unpin: no active hub; pass --hub-id <id>'
        }));
      }
      const unpinned = await unpinHubIndex(store, hubId);
      formatOutput({
        ctx, command: 'index.pull', output: fmt, status: 'ok',
        data: { hubId, unpinned },
        textRenderer: (r) => `unpinned ${r.unpinned.length > 0 ? r.unpinned.join(', ') : '(nothing)'} for ${r.hubId}\n`
      });
      return 0;
    }

    if (this.from === undefined) {
      return failWith(ctx, fmt, 'index.pull', new RegistryError({
        code: 'USAGE.MISSING_FLAG',
        message: 'index pull: --from <directory|https URL|github:OWNER/REPO[@TAG]> is required'
      }));
    }
    if (this.verifyAttestation !== undefined && !/^[\w.-]+\/[\w.-]+$/u.test(this.verifyAttestation)) {
      return failWith(ctx, fmt, 'index.pull', new RegistryError({
        code: 'USAGE.INVALID_FLAG',
        message: `index pull: --verify-attestation must be OWNER/REPO (got "${this.verifyAttestation}")`
      }));
    }

    let token = this.tokenEnv === undefined ? undefined : ctx.env[this.tokenEnv];
    if (token === undefined && (this.from.startsWith('github:') || this.verifyAttestation !== undefined)) {
      token = (await resolveGithubToken({}, createTokenResolver(ctx.env))).token;
    }

    let result: HubIndexPullResult;
    try {
      result = await pullHubIndex({
        from: this.from,
        hubId,
        store,
        token,
        localModel: TERNLIGHT_MODEL,
        verifyAttestationRepo: this.verifyAttestation,
        processExecutor: new NodeProcessExecutor(),
        allowRollback: this.allowRollback,
        pin: this.pin
      });
    } catch (cause) {
      const code = cause instanceof HubIndexPullError ? `INDEX.PULL_${cause.code}` : 'INDEX.PULL_FAILED';
      return failWith(ctx, fmt, 'index.pull', new RegistryError({
        code,
        message: `index pull: ${cause instanceof Error ? cause.message : String(cause)}`,
        hint: code === 'INDEX.PULL_MODEL_MISMATCH' ? 'Upgrade the client or harvest the hub locally with `index harvest --embed`.' : undefined,
        cause: cause instanceof Error ? cause : undefined
      }));
    }

    for (const warning of result.warnings) {
      ctx.stderr.write(`warning: ${warning}\n`);
    }
    formatOutput({
      ctx, command: 'index.pull', output: fmt, status: 'ok',
      data: result,
      textRenderer: (r) =>
        `${r.status} ${r.manifest.indexDigest} ${r.manifest.searchProfileId}`
        + ` primitives=${String(r.manifest.totals?.primitives ?? '?')}`
        + ` generation=${r.manifest.generation}`
        + ` attested=${String(r.attestationVerified)} pinned=${String(r.pinned)}\n`
        + `  from ${r.from}\n  into ${r.path}\n`
    });
    return 0;
  }
}
