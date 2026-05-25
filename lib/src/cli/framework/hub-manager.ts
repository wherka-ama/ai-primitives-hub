/**
 * Shared HubManager factory for CLI commands.
 *
 * Centralizes HubManager creation logic to reduce duplication across commands.
 * @module cli/framework/hub-manager
 */

import {
  HubManager,
} from '../../app/registry/hub-manager';
import {
  resolveUserConfigPaths,
} from '../../app/registry/user-config-paths';
import {
  envTokenProvider,
  type TokenProvider,
} from '../../infra/github/token';
import {
  NodeHttpClient,
} from '../../infra/http/node-http-client';
import {
  CompositeHubResolver,
  GitHubHubResolver,
  LocalHubResolver,
  UrlHubResolver,
} from '../../infra/resolvers/hub-resolver';
import {
  ActiveHubStore,
} from '../../infra/stores/active-hub-store';
import {
  HubStore,
} from '../../infra/stores/yaml-hub-store';
import {
  type HttpClient,
} from '../../ports/http';
import {
  type Context,
} from './context';

/**
 * Create HTTP client and token provider with defaults.
 * @param http Optional HTTP client (for testing).
 * @param ctx CLI context.
 * @param tokens Optional token provider (for testing).
 * @returns Tuple of [httpClient, tokenProvider].
 */
export const createHttpClientAndTokens = (
  http: HttpClient | undefined,
  ctx: Context,
  tokens: TokenProvider | undefined
): [HttpClient, TokenProvider] => {
  const httpClient = http ?? new NodeHttpClient();
  const tokenProvider = tokens ?? envTokenProvider(ctx.env);
  return [httpClient, tokenProvider];
};

export interface CreateHubManagerOptions {
  ctx: Context;
  http?: HttpClient;
  tokens?: TokenProvider;
}

/**
 * Create a HubManager with default HTTP client and token provider.
 * @param opts Options for creating HubManager.
 * @returns Configured HubManager instance.
 */
export const createHubManager = (opts: CreateHubManagerOptions): HubManager => {
  const { ctx, http, tokens } = opts;
  const paths = resolveUserConfigPaths(ctx.env);
  const [httpClient, tokenProvider] = createHttpClientAndTokens(http, ctx, tokens);
  const resolver = new CompositeHubResolver(
    new GitHubHubResolver(httpClient, tokenProvider),
    new LocalHubResolver(ctx.fs),
    new UrlHubResolver(httpClient, tokenProvider)
  );
  return new HubManager(
    new HubStore(paths.hubs, ctx.fs),
    new ActiveHubStore(paths.activeHub, ctx.fs),
    resolver
  );
};
