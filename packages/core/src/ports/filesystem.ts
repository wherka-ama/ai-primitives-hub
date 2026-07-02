/**
 * FileSystem port — IO abstraction for all file-system operations.
 *
 * The contract every feature layer uses for filesystem access — mirrors
 * the operations `src/services/*` already perform via `fs/promises`
 * today (read/write text and JSON, existence checks, directory
 * creation/listing, removal). Concrete adapters live in
 * `@ai-primitives-hub/infra` (Phase 3); tests supply hand-written
 * in-memory doubles. Keeps `core`/`app` free of direct `node:fs` imports.
 * @module ports/filesystem
 */

export interface FileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, contents: string): Promise<void>;
  readJson<T = unknown>(path: string): Promise<T>;
  writeJson(path: string, value: unknown): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string, opts?: { recursive?: boolean }): Promise<void>;
  readDir(path: string): Promise<string[]>;
  remove(path: string, opts?: { recursive?: boolean }): Promise<void>;
}
