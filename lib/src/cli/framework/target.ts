/**
 * Target-related utilities for CLI commands.
 *
 * Centralizes target resolution logic to reduce duplication across commands.
 * @module cli/framework/target
 */

import {
  resolveUserConfigPaths,
} from '../../app/registry';
import {
  type Target,
} from '../../domain/install';
import {
  findLockfile,
} from '../../infra/stores/json-lockfile-store';
import {
  readTargetsHierarchical,
} from '../../infra/stores/target-store';
import {
  type Context,
} from './context';

/**
 * Load all targets from the hierarchical target configuration.
 * @param ctx CLI context.
 * @returns Array of configured targets.
 */
export const loadTargets = async (ctx: Context): Promise<Target[]> => {
  const userPaths = resolveUserConfigPaths(ctx.env);
  return readTargetsHierarchical({ cwd: ctx.cwd(), fs: ctx.fs }, userPaths.userTargets);
};

/**
 * Find the lockfile path for the current working directory.
 * @param ctx CLI context.
 * @returns Lockfile path or null if not found.
 */
export const findProjectLockfile = async (ctx: Context): Promise<string | null> => {
  const userPaths = resolveUserConfigPaths(ctx.env);
  return findLockfile(ctx.cwd(), ctx.fs, userPaths.userLockfile);
};
