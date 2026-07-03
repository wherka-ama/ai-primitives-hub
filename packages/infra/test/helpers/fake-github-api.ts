/**
 * Hand-written `GitHubApi` test double, keyed by exact path/URL.
 *
 * Shared across `github-adapter.test.ts` today and (once ported)
 * `skills-adapter.test.ts` — both consume the same `GitHubApi` port.
 */
import type {
  GitHubApi,
} from '@ai-primitives-hub/core';

export class FakeGitHubApi implements GitHubApi {
  private readonly jsonByPath = new Map<string, unknown>();
  private readonly textByPath = new Map<string, string>();
  private readonly bytesByPath = new Map<string, Uint8Array>();

  public seedJson(pathOrUrl: string, value: unknown): this {
    this.jsonByPath.set(pathOrUrl, value);
    return this;
  }

  public seedText(pathOrUrl: string, value: string): this {
    this.textByPath.set(pathOrUrl, value);
    return this;
  }

  public seedBytes(pathOrUrl: string, value: Uint8Array): this {
    this.bytesByPath.set(pathOrUrl, value);
    return this;
  }

  public async getJson<T>(pathOrUrl: string): Promise<T> {
    if (!this.jsonByPath.has(pathOrUrl)) {
      throw new Error(`GitHub API error: 404 - not seeded: ${pathOrUrl}`);
    }
    return this.jsonByPath.get(pathOrUrl) as T;
  }

  public async getText(pathOrUrl: string): Promise<string> {
    const text = this.textByPath.get(pathOrUrl);
    if (text === undefined) {
      throw new Error(`GitHub API error: 404 - not seeded: ${pathOrUrl}`);
    }
    return text;
  }

  public async download(pathOrUrl: string): Promise<Uint8Array> {
    const bytes = this.bytesByPath.get(pathOrUrl);
    if (bytes === undefined) {
      throw new Error(`GitHub API error: 404 - not seeded: ${pathOrUrl}`);
    }
    return bytes;
  }
}
