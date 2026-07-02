import type {
  HttpClient,
  HttpRequest,
  HttpResponse,
  TokenProvider,
} from '@ai-primitives-hub/core';
import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  GitHubApiClient,
} from '../../src/http/github-api-client';

class FakeHttpClient implements HttpClient {
  public lastRequest?: HttpRequest;

  public constructor(private readonly response: HttpResponse) {}

  public async fetch(request: HttpRequest): Promise<HttpResponse> {
    this.lastRequest = request;
    return this.response;
  }
}

class StaticTokenProvider implements TokenProvider {
  public constructor(private readonly token: string | undefined) {}

  public async getToken(): Promise<string | undefined> {
    return this.token;
  }
}

function jsonResponse(body: unknown, statusCode = 200): HttpResponse {
  return {
    statusCode,
    body: new TextEncoder().encode(JSON.stringify(body)),
    finalUrl: 'https://api.github.com/resolved',
    headers: {}
  };
}

describe('GitHubApiClient', () => {
  it('resolves a relative path against the default GitHub API base URL', async () => {
    const http = new FakeHttpClient(jsonResponse({ ok: true }));
    await new GitHubApiClient(http).getJson('/repos/o/r');
    expect(http.lastRequest?.url).toBe('https://api.github.com/repos/o/r');
  });

  it('leaves an absolute URL untouched', async () => {
    const http = new FakeHttpClient(jsonResponse({ ok: true }));
    await new GitHubApiClient(http).getJson('https://example.com/custom');
    expect(http.lastRequest?.url).toBe('https://example.com/custom');
  });

  it('sends a User-Agent and Accept: application/json for getJson', async () => {
    const http = new FakeHttpClient(jsonResponse({ ok: true }));
    await new GitHubApiClient(http, { userAgent: 'test-agent/1.0' }).getJson('/repos/o/r');
    expect(http.lastRequest?.headers).toMatchObject({
      'User-Agent': 'test-agent/1.0',
      Accept: 'application/json'
    });
  });

  it('adds an Authorization header when a TokenProvider resolves a token', async () => {
    const http = new FakeHttpClient(jsonResponse({ ok: true }));
    const client = new GitHubApiClient(http, { tokenProvider: new StaticTokenProvider('secret-token') });
    await client.getJson('/repos/o/r');
    expect(http.lastRequest?.headers?.Authorization).toBe('token secret-token');
  });

  it('omits Authorization when the TokenProvider resolves undefined', async () => {
    const http = new FakeHttpClient(jsonResponse({ ok: true }));
    const client = new GitHubApiClient(http, { tokenProvider: new StaticTokenProvider(undefined) });
    await client.getJson('/repos/o/r');
    expect(http.lastRequest?.headers?.Authorization).toBeUndefined();
  });

  it('parses the JSON body on success', async () => {
    const http = new FakeHttpClient(jsonResponse({ name: 'repo' }));
    await expect(new GitHubApiClient(http).getJson('/repos/o/r')).resolves.toEqual({ name: 'repo' });
  });

  it('throws a descriptive error on a 404 response', async () => {
    const http = new FakeHttpClient(jsonResponse({}, 404));
    await expect(new GitHubApiClient(http).getJson('/repos/o/r')).rejects.toThrow('404');
  });

  it('throws a descriptive error on a 401 response', async () => {
    const http = new FakeHttpClient(jsonResponse({}, 401));
    await expect(new GitHubApiClient(http).getJson('/repos/o/r')).rejects.toThrow('Authentication failed');
  });

  it('throws a descriptive error on a 403 response', async () => {
    const http = new FakeHttpClient(jsonResponse({}, 403));
    await expect(new GitHubApiClient(http).getJson('/repos/o/r')).rejects.toThrow('Access forbidden');
  });

  it('throws when the response body is not valid JSON', async () => {
    const http = new FakeHttpClient({
      statusCode: 200,
      body: new TextEncoder().encode('not json'),
      finalUrl: 'https://api.github.com/repos/o/r',
      headers: {}
    });
    await expect(new GitHubApiClient(http).getJson('/repos/o/r')).rejects.toThrow('Failed to parse');
  });

  it('requests Accept: application/octet-stream for a relative (API) asset path via getText', async () => {
    const http = new FakeHttpClient({
      statusCode: 200,
      body: new TextEncoder().encode('id: my-bundle'),
      finalUrl: '',
      headers: {}
    });
    await new GitHubApiClient(http).getText('/repos/o/r/releases/assets/1');
    expect(http.lastRequest?.headers?.Accept).toBe('application/octet-stream');
  });

  it('does not force Accept: application/octet-stream for a non-API absolute URL via getText', async () => {
    const http = new FakeHttpClient({
      statusCode: 200,
      body: new TextEncoder().encode('id: my-bundle'),
      finalUrl: '',
      headers: {}
    });
    await new GitHubApiClient(http).getText('https://raw.githubusercontent.com/o/r/main/manifest.yml');
    expect(http.lastRequest?.headers?.Accept).toBe('*/*');
  });

  it('download() returns raw bytes', async () => {
    const bytes = new Uint8Array([0x50, 0x4B, 0x03, 0x04]);
    const http = new FakeHttpClient({ statusCode: 200, body: bytes, finalUrl: '', headers: {} });
    await expect(new GitHubApiClient(http).download('/repos/o/r/releases/assets/1')).resolves.toEqual(bytes);
  });
});
