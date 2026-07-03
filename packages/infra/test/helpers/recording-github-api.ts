/**
 * `GitHubApi` test double that records every call made through it while
 * delegating to an inner `GitHubApi` (typically a `FakeGitHubApi`).
 *
 * Shared across adapter tests that need to assert on call counts/order
 * (manifest caching, concurrency batching) rather than just return values.
 */
import type {
  GitHubApi,
} from '@ai-primitives-hub/core';

type GitHubApiMethod = 'getJson' | 'getText' | 'download';

export interface RecordedGitHubApiCall {
  method: GitHubApiMethod;
  pathOrUrl: string;
}

export class RecordingGitHubApi implements GitHubApi {
  public readonly calls: RecordedGitHubApiCall[] = [];

  public constructor(private readonly inner: GitHubApi) {}

  public getJson<T>(pathOrUrl: string): Promise<T> {
    this.calls.push({ method: 'getJson', pathOrUrl });
    return this.inner.getJson(pathOrUrl);
  }

  public getText(pathOrUrl: string): Promise<string> {
    this.calls.push({ method: 'getText', pathOrUrl });
    return this.inner.getText(pathOrUrl);
  }

  public download(pathOrUrl: string): Promise<Uint8Array> {
    this.calls.push({ method: 'download', pathOrUrl });
    return this.inner.download(pathOrUrl);
  }

  public countOf(method: GitHubApiMethod): number {
    return this.calls.filter((call) => call.method === method).length;
  }
}
