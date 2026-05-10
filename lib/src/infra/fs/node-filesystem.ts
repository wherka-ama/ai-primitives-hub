/**
 * Node.js filesystem adapter implementing the FileSystem port.
 *
 * Wraps node:fs/promises to provide the FileSystem interface.
 * This is the production implementation used by the CLI.
 */
import * as fsp from 'node:fs/promises';
import type {
  FileSystem,
} from '../../ports/filesystem';

/**
 * Production filesystem adapter using Node.js fs/promises.
 */
export class NodeFileSystem implements FileSystem {
  async readFile(path: string): Promise<string> {
    return fsp.readFile(path, 'utf8');
  }

  async writeFile(path: string, contents: string): Promise<void> {
    await fsp.writeFile(path, contents, 'utf8');
  }

  async readJson<T = unknown>(path: string): Promise<T> {
    const raw = await fsp.readFile(path, 'utf8');
    return JSON.parse(raw) as T;
  }

  async writeJson(path: string, value: unknown): Promise<void> {
    await fsp.writeFile(path, JSON.stringify(value, null, 2), 'utf8');
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fsp.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async mkdir(path: string, opts?: { recursive?: boolean }): Promise<void> {
    await fsp.mkdir(path, { recursive: opts?.recursive === true });
  }

  async readDir(path: string): Promise<string[]> {
    return fsp.readdir(path, { withFileTypes: false });
  }

  async remove(path: string, opts?: { recursive?: boolean }): Promise<void> {
    await fsp.rm(path, { recursive: opts?.recursive === true, force: true });
  }
}
