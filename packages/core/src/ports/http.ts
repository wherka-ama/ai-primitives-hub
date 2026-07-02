/**
 * HTTP port — network abstraction for source adapters and the install
 * pipeline.
 *
 * `app`/`infra` non-adapter code depends only on this interface, never on
 * `fetch`/`axios`/`node:http` directly. The production adapter
 * (`@ai-primitives-hub/infra`, Phase 3) wraps the real HTTP client.
 * @module ports/http
 */

export interface HttpResponse {
  /** Status code after redirect handling. */
  statusCode: number;
  /** Raw response body bytes. */
  body: Uint8Array;
  /** Final URL after any redirect chain. */
  finalUrl: string;
  /** Lower-cased response headers. */
  headers: Record<string, string>;
}

export interface HttpRequest {
  /** Absolute URL. */
  url: string;
  /** Defaults to `'GET'`. */
  method?: 'GET' | 'HEAD' | 'POST';
  /** Request headers (case-insensitive). */
  headers?: Record<string, string>;
  /** Request body, for `POST`. */
  body?: Uint8Array | string;
  /** Maximum redirect chain length; defaults to the adapter's own default. */
  maxRedirects?: number;
}

/**
 * The minimal HTTP surface source adapters and the install pipeline need.
 */
export interface HttpClient {
  fetch(request: HttpRequest): Promise<HttpResponse>;
}
