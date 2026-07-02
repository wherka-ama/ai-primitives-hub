import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  CLI_PACKAGE_READY,
} from '../src/index';

describe('@ai-primitives-hub/cli placeholder', () => {
  it('resolves its @ai-primitives-hub/app dependency and re-exports a truthy marker', () => {
    expect(CLI_PACKAGE_READY).toBe(true);
  });
});
