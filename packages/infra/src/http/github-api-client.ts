/**
 * `GitHubApi` port implementation, backed by an injected `HttpClient`.
 *
 * Replaces `src/adapters/github-adapter.ts`'s `makeRequest`/`downloadFile`
 * methods. Two behavioral simplifications relative to that code, both
 * deliberate:
 *
 * - No HTML-error-page body-scraping. It only ever improved a diagnostic
 *   message for an edge case (an auth gateway/proxy returning HTML instead
 *   of JSON); status-code-based error messages below still cover it.
 * - No multi-strategy auth retry loop (explicit token -> VS Code session ->
 *   `gh` CLI, invalidating a cache and retrying on 401/403). That chain
 *   conflated two concerns: *which* token to use is a delivery-specific
 *   policy (CLI vs. extension), so it belongs in whichever `TokenProvider`
 *   the caller injects, not in this HTTP layer. `getToken()` is called
 *   fresh on every request, so a `TokenProvider` that itself tries
 *   multiple strategies still gets a chance to re-resolve on the next call.
 * @module http/github-api-client
 */
import type {
  GitHubApi,
  HttpClient,
  HttpResponse,
  TokenProvider,
} from '@ai-primitives-hub/core';

export interface GitHubApiClientOptions {
  /** Defaults to `https://api.github.com`. */
  baseUrl?: string;
  /** Defaults to `ai-primitives-hub/1.0`. */
  userAgent?: string;
  /** Resolves a bearer token for each request; omit for unauthenticated access. */
  tokenProvider?: TokenProvider;
}

const DEFAULT_BASE_URL = 'https://api.github.com';
const DEFAULT_USER_AGENT = 'ai-primitives-hub/1.0';

export class GitHubApiClient implements GitHubApi {
  private readonly baseUrl: string;
  private readonly userAgent: string;

  public constructor(
    private readonly http: HttpClient,
    private readonly options: GitHubApiClientOptions = {}
  ) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  }

  private resolveUrl(pathOrUrl: string): string {
    return /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${this.baseUrl}${pathOrUrl}`;
  }

  /**
   * GitHub's asset-download API endpoints return JSON metadata about the
   * asset by default; only `Accept: application/octet-stream` makes them
   * return the actual bytes. Only applies to `this.baseUrl`-hosted URLs -
   * a `browser_download_url` or redirect target doesn't need it (and
   * shouldn't get an unexpected Accept override).
   * @param url - Already-resolved absolute URL to check.
   */
  private needsOctetStreamAccept(url: string): boolean {
    return url.startsWith(this.baseUrl);
  }

  private async buildHeaders(accept: string, extraHeaders?: Record<string, string>): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'User-Agent': this.userAgent,
      Accept: accept,
      ...extraHeaders
    };
    const token = await this.options.tokenProvider?.getToken();
    if (token) {
      headers.Authorization = `token ${token}`;
    }
    return headers;
  }

  private async request(
    pathOrUrl: string,
    accept: string,
    extraHeaders?: Record<string, string>
  ): Promise<HttpResponse> {
    const url = this.resolveUrl(pathOrUrl);
    const headers = await this.buildHeaders(accept, extraHeaders);
    const response = await this.http.fetch({ url, headers });

    if (response.statusCode >= 400) {
      throw new Error(describeError(response, url));
    }
    return response;
  }

  public async getJson<T>(pathOrUrl: string, extraHeaders?: Record<string, string>): Promise<T> {
    const response = await this.request(pathOrUrl, 'application/json', extraHeaders);
    const text = Buffer.from(response.body).toString('utf8');
    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new Error(`Failed to parse GitHub response as JSON: ${error instanceof Error ? error.message : error}`);
    }
  }

  public async getText(pathOrUrl: string, extraHeaders?: Record<string, string>): Promise<string> {
    const url = this.resolveUrl(pathOrUrl);
    const accept = this.needsOctetStreamAccept(url) ? 'application/octet-stream' : '*/*';
    const response = await this.request(pathOrUrl, accept, extraHeaders);
    return Buffer.from(response.body).toString('utf8');
  }

  public async download(pathOrUrl: string, extraHeaders?: Record<string, string>): Promise<Uint8Array> {
    const url = this.resolveUrl(pathOrUrl);
    const accept = this.needsOctetStreamAccept(url) ? 'application/octet-stream' : '*/*';
    const response = await this.request(pathOrUrl, accept, extraHeaders);
    return response.body;
  }
}

function describeError(response: HttpResponse, url: string): string {
  switch (response.statusCode) {
    case 401: {
      return `GitHub API error: 401 - Authentication failed. Token may be invalid or expired. (${url})`;
    }
    case 403: {
      return `GitHub API error: 403 - Access forbidden. Token may lack required scopes (repo). (${url})`;
    }
    case 404: {
      return `GitHub API error: 404 - Not found or not accessible. Check authentication. (${url})`;
    }
    default: {
      return `GitHub API error: ${response.statusCode} (${url})`;
    }
  }
}
