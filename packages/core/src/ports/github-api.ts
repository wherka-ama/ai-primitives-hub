/**
 * GitHubApi port — interface for GitHub REST API interactions.
 *
 * Covers the access patterns `src/adapters/github-adapter.ts` and
 * `src/adapters/skills-adapter.ts` need: JSON GETs (repository contents,
 * tree, releases), text GETs (raw file content), and binary downloads
 * (release/tarball assets). Deliberately lean — conditional/ETag GETs and
 * rate-limit telemetry are not ported yet since nothing on `main` uses
 * them; extend this port when Phase 3 actually needs them (e.g. porting
 * the Git Trees API perf optimization from `c1fbb24`), not speculatively
 * now.
 * @module ports/github-api
 */

export interface GitHubApi {
  /**
   * GET returning parsed JSON. Throws on a non-2xx response.
   * @param pathOrUrl - Relative API path (e.g. `/repos/{owner}/{repo}`) or absolute URL.
   * @param extraHeaders - Optional additional headers.
   */
  getJson<T>(pathOrUrl: string, extraHeaders?: Record<string, string>): Promise<T>;

  /**
   * GET returning the raw text body. Throws on a non-2xx response.
   * @param pathOrUrl - Relative API path or absolute URL.
   * @param extraHeaders - Optional additional headers.
   */
  getText(pathOrUrl: string, extraHeaders?: Record<string, string>): Promise<string>;

  /**
   * GET returning the raw response bytes, for binary assets (release ZIPs,
   * tarballs). Throws on a non-2xx response.
   * @param pathOrUrl - Relative API path or absolute URL.
   * @param extraHeaders - Optional additional headers.
   */
  download(pathOrUrl: string, extraHeaders?: Record<string, string>): Promise<Uint8Array>;
}
