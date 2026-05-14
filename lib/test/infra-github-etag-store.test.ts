/**
 * Coverage tests for infra/github/etag-store.ts.
 *
 * Tests EtagStore class for persistent ETag caching with atomic writes.
 */
import { describe, expect, it } from 'vitest';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import { EtagStore, type EtagEntry } from '../src/infra/github/etag-store';

describe('EtagStore', () => {
  it('opens new store when file does not exist', async () => {
    const store = await EtagStore.open('/tmp/nonexistent-etag-store.json');
    expect(store.size()).toBe(0);
  });

  it('opens existing store with etags', async () => {
    const testFile = '/tmp/test-etag-store-existing.json';
    const testContent = JSON.stringify({ etags: { 'http://example.com': 'etag123' } });
    await fsPromises.writeFile(testFile, testContent, 'utf8');
    
    const store = await EtagStore.open(testFile);
    expect(store.get('http://example.com')).toBe('etag123');
    expect(store.size()).toBe(1);
    
    await fsPromises.unlink(testFile);
  });

  it('handles corrupt JSON by resetting', async () => {
    const testFile = '/tmp/test-etag-store-corrupt.json';
    await fsPromises.writeFile(testFile, '{ invalid json', 'utf8');
    
    const store = await EtagStore.open(testFile);
    expect(store.size()).toBe(0);
    
    await fsPromises.unlink(testFile);
  });

  it('handles malformed JSON structure by resetting', async () => {
    const testFile = '/tmp/test-etag-store-malformed.json';
    await fsPromises.writeFile(testFile, '[]', 'utf8');
    
    const store = await EtagStore.open(testFile);
    expect(store.size()).toBe(0);
    
    await fsPromises.unlink(testFile);
  });

  it('migrates string etags to entry format', async () => {
    const testFile = '/tmp/test-etag-store-migrate.json';
    const testContent = JSON.stringify({ etags: { 'http://example.com': 'etag123' } });
    await fsPromises.writeFile(testFile, testContent, 'utf8');
    
    const store = await EtagStore.open(testFile);
    const entry = store.getEntry('http://example.com');
    expect(entry).toEqual({ etag: 'etag123' });
    
    await fsPromises.unlink(testFile);
  });

  it('returns undefined for non-existent URL', async () => {
    const store = await EtagStore.open('/tmp/nonexistent-etag-store.json');
    expect(store.get('http://nonexistent.com')).toBeUndefined();
    expect(store.getEntry('http://nonexistent.com')).toBeUndefined();
  });

  it('sets etag entry', async () => {
    const store = await EtagStore.open('/tmp/test-etag-store-set.json');
    await store.set('http://example.com', 'etag123');
    
    expect(store.get('http://example.com')).toBe('etag123');
    expect(store.getEntry('http://example.com')).toEqual({ etag: 'etag123', value: undefined });
  });

  it('sets etag entry with value', async () => {
    const store = await EtagStore.open('/tmp/test-etag-store-value.json');
    const testValue = { data: 'test' };
    await store.set('http://example.com', 'etag123', testValue);
    
    expect(store.getEntry('http://example.com')).toEqual({ etag: 'etag123', value: testValue });
  });

  it('does not mark dirty when setting same etag and value', async () => {
    const testFile = '/tmp/test-etag-store-dirty.json';
    const store = await EtagStore.open(testFile);
    await store.set('http://example.com', 'etag123');
    await store.save(); // Clear dirty flag
    
    await store.set('http://example.com', 'etag123');
    // Save should be no-op since not dirty
    const initialStat = await fsPromises.stat(testFile).catch(() => null);
    await store.save();
    const finalStat = await fsPromises.stat(testFile).catch(() => null);
    
    // File should not be modified
    if (initialStat && finalStat) {
      expect(initialStat.mtimeMs).toBe(finalStat.mtimeMs);
    }
    
    await fsPromises.unlink(testFile).catch(() => {});
  });

  it('marks dirty when etag changes', async () => {
    const store = await EtagStore.open('/tmp/test-etag-store-dirty-etag.json');
    await store.set('http://example.com', 'etag123');
    await store.save(); // Clear dirty flag
    
    await store.set('http://example.com', 'etag456');
    // Should be dirty, save should write
    const testFile = '/tmp/test-etag-store-dirty-etag.json';
    await store.save();
    
    const content = await fsPromises.readFile(testFile, 'utf8');
    const parsed = JSON.parse(content) as { etags: Record<string, EtagEntry> };
    expect(parsed.etags['http://example.com'].etag).toBe('etag456');
    
    await fsPromises.unlink(testFile);
  });

  it('marks dirty when value changes', async () => {
    const store = await EtagStore.open('/tmp/test-etag-store-dirty-value.json');
    await store.set('http://example.com', 'etag123', { data: 'test1' });
    await store.save(); // Clear dirty flag
    
    await store.set('http://example.com', 'etag123', { data: 'test2' });
    // Should be dirty, save should write
    const testFile = '/tmp/test-etag-store-dirty-value.json';
    await store.save();
    
    const content = await fsPromises.readFile(testFile, 'utf8');
    const parsed = JSON.parse(content) as { etags: Record<string, EtagEntry> };
    expect(parsed.etags['http://example.com'].value).toEqual({ data: 'test2' });
    
    await fsPromises.unlink(testFile);
  });

  it('deletes entry', async () => {
    const store = await EtagStore.open('/tmp/test-etag-store-delete.json');
    await store.set('http://example.com', 'etag123');
    expect(store.get('http://example.com')).toBe('etag123');
    
    store.delete('http://example.com');
    expect(store.get('http://example.com')).toBeUndefined();
  });

  it('marks dirty when deleting existing entry', async () => {
    const store = await EtagStore.open('/tmp/test-etag-store-delete-dirty.json');
    await store.set('http://example.com', 'etag123');
    await store.save(); // Clear dirty flag
    
    store.delete('http://example.com');
    // Should be dirty
    const testFile = '/tmp/test-etag-store-delete-dirty.json';
    await store.save();
    
    const content = await fsPromises.readFile(testFile, 'utf8');
    const parsed = JSON.parse(content) as { etags: Record<string, EtagEntry> };
    expect(parsed.etags['http://example.com']).toBeUndefined();
    
    await fsPromises.unlink(testFile);
  });

  it('does not mark dirty when deleting non-existent entry', async () => {
    const store = await EtagStore.open('/tmp/test-etag-store-delete-nonexist.json');
    await store.save(); // Clear dirty flag
    
    store.delete('http://nonexistent.com');
    // Should not be dirty, save should be no-op
    const testFile = '/tmp/test-etag-store-delete-nonexist.json';
    const initialStat = await fsPromises.stat(testFile).catch(() => null);
    await store.save();
    const finalStat = await fsPromises.stat(testFile).catch(() => null);
    
    // File should not be modified
    if (initialStat && finalStat) {
      expect(initialStat.mtimeMs).toBe(finalStat.mtimeMs);
    }
    
    await fsPromises.unlink(testFile).catch(() => {});
  });

  it('clears all entries', async () => {
    const store = await EtagStore.open('/tmp/test-etag-store-clear.json');
    await store.set('http://example.com', 'etag123');
    await store.set('http://example2.com', 'etag456');
    expect(store.size()).toBe(2);
    
    store.clear();
    expect(store.size()).toBe(0);
  });

  it('marks dirty when clearing non-empty store', async () => {
    const store = await EtagStore.open('/tmp/test-etag-store-clear-dirty.json');
    await store.set('http://example.com', 'etag123');
    await store.save(); // Clear dirty flag
    
    store.clear();
    // Should be dirty
    const testFile = '/tmp/test-etag-store-clear-dirty.json';
    await store.save();
    
    const content = await fsPromises.readFile(testFile, 'utf8');
    const parsed = JSON.parse(content) as { etags: Record<string, EtagEntry> };
    expect(Object.keys(parsed.etags).length).toBe(0);
    
    await fsPromises.unlink(testFile);
  });

  it('does not mark dirty when clearing empty store', async () => {
    const store = await EtagStore.open('/tmp/test-etag-store-clear-empty.json');
    await store.save(); // Clear dirty flag
    
    store.clear();
    // Should not be dirty
    const testFile = '/tmp/test-etag-store-clear-empty.json';
    const initialStat = await fsPromises.stat(testFile).catch(() => null);
    await store.save();
    const finalStat = await fsPromises.stat(testFile).catch(() => null);
    
    // File should not be modified
    if (initialStat && finalStat) {
      expect(initialStat.mtimeMs).toBe(finalStat.mtimeMs);
    }
    
    await fsPromises.unlink(testFile).catch(() => {});
  });

  it('returns size', async () => {
    const store = await EtagStore.open('/tmp/test-etag-store-size.json');
    expect(store.size()).toBe(0);
    
    await store.set('http://example.com', 'etag123');
    expect(store.size()).toBe(1);
    
    await store.set('http://example2.com', 'etag456');
    expect(store.size()).toBe(2);
  });

  it('saves to file atomically', async () => {
    const testFile = '/tmp/test-etag-store-save.json';
    const store = await EtagStore.open(testFile);
    await store.set('http://example.com', 'etag123');
    await store.save();
    
    const content = await fsPromises.readFile(testFile, 'utf8');
    const parsed = JSON.parse(content) as { etags: Record<string, EtagEntry> };
    expect(parsed.etags['http://example.com'].etag).toBe('etag123');
    
    await fsPromises.unlink(testFile);
  });

  it('creates directory if it does not exist', async () => {
    const testFile = '/tmp/test-etag-store-dir/subdir/store.json';
    const store = await EtagStore.open(testFile);
    await store.set('http://example.com', 'etag123');
    await store.save();
    
    const content = await fsPromises.readFile(testFile, 'utf8');
    const parsed = JSON.parse(content) as { etags: Record<string, EtagEntry> };
    expect(parsed.etags['http://example.com'].etag).toBe('etag123');
    
    await fsPromises.unlink(testFile);
    await fsPromises.rmdir('/tmp/test-etag-store-dir/subdir');
    await fsPromises.rmdir('/tmp/test-etag-store-dir');
  });

  it('uses atomic write with tmp file', async () => {
    const testFile = '/tmp/test-etag-store-atomic.json';
    const store = await EtagStore.open(testFile);
    await store.set('http://example.com', 'etag123');
    await store.save();
    
    // Check that .tmp file was cleaned up
    const tmpFiles = await fsPromises.readdir('/tmp').then(files =>
      files.filter(f => f.startsWith(path.basename(testFile)) && f.endsWith('.tmp'))
    );
    expect(tmpFiles.length).toBe(0);
    
    await fsPromises.unlink(testFile);
  });

  it('skips save when not dirty', async () => {
    const testFile = '/tmp/test-etag-store-skip-save.json';
    const store = await EtagStore.open(testFile);
    await store.save(); // Should not write since empty and not dirty
    
    // File should not exist since nothing was written
    const exists = await fsPromises.access(testFile).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });

  it('updates existing entry', async () => {
    const testFile = '/tmp/test-etag-store-update.json';
    const store = await EtagStore.open(testFile);
    await store.set('http://example.com', 'etag123');
    await store.set('http://example.com', 'etag456');
    
    expect(store.get('http://example.com')).toBe('etag456');
    expect(store.size()).toBe(1);
    
    await fsPromises.unlink(testFile).catch(() => {});
  });
});
