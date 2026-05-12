/**
 * Phase 4 / Iter 23 — `config list` subcommand.
 *
 * Dumps the resolved config (after the 8-layer merge) as text or
 * the JSON envelope. Useful for debugging precedence: a user can
 * `prompt-registry config list -o yaml` and see exactly what the
 * commands see.
 */
import {
  type CommandDefinition,
  type Context,
  defineCommand,
  formatOutput,
  loadConfig,
  type OutputFormat,
} from '../framework';

/**
 * Config list command options.
 */
export interface ConfigListOptions {
  output?: OutputFormat;
}

/**
 * Render config in a human-readable format.
 * @param config - Resolved config object.
 * @returns Formatted string.
 */
const renderConfigText = (config: Record<string, unknown>): string => {
  const lines: string[] = [];
  
  lines.push('=== Prompt Registry Configuration ===\n');
  
  // Version and basic settings
  lines.push(`Version: ${String(config.version ?? 'unknown')}`);
  lines.push(`Output format: ${String(config.output ?? 'text')}`);
  lines.push(`Verbose: ${String(config.verbose ?? false)}`);
  lines.push(`Quiet: ${String(config.quiet ?? false)}`);
  lines.push('');
  
  // Hubs
  const hubs = config.hubs as Record<string, unknown> | undefined;
  if (hubs && typeof hubs === 'object') {
    lines.push('=== Hubs ===');
    const activeHub = hubs.activeHub as string | undefined;
    lines.push(`Active hub: ${activeHub ?? 'none'}`);
    const configuredHubs = hubs.configuredHubs as Record<string, unknown> | undefined;
    if (configuredHubs && typeof configuredHubs === 'object') {
      lines.push(`Configured hubs: ${Object.keys(configuredHubs).join(', ') || 'none'}`);
    }
    lines.push('');
  }
  
  // Targets
  const targets = config.targets as Record<string, unknown> | undefined;
  if (targets && typeof targets === 'object') {
    lines.push('=== Targets ===');
    const targetArray = targets.targets as Array<{ name: string; type: string }> | undefined;
    if (targetArray && Array.isArray(targetArray)) {
      if (targetArray.length === 0) {
        lines.push('No targets configured');
      } else {
        for (const t of targetArray) {
          lines.push(`  - ${t.name} (${t.type})`);
        }
      }
    }
    lines.push('');
  }
  
  // Profiles
  const profiles = config.profiles as Record<string, unknown> | undefined;
  if (profiles && typeof profiles === 'object') {
    lines.push('=== Profiles ===');
    const activeProfile = profiles.activeProfile as string | undefined;
    lines.push(`Active profile: ${activeProfile ?? 'none'}`);
    lines.push('');
  }
  
  // GitHub auth
  const github = config.github as Record<string, unknown> | undefined;
  if (github && typeof github === 'object') {
    lines.push('=== GitHub Authentication ===');
    const token = github.token as string | undefined;
    lines.push(`Token configured: ${token ? 'yes' : 'no'}`);
    lines.push('');
  }
  
  // Paths
  const paths = config.paths as Record<string, unknown> | undefined;
  if (paths && typeof paths === 'object') {
    lines.push('=== Paths ===');
    const configPath = paths.configPath as string | undefined;
    const cachePath = paths.cachePath as string | undefined;
    if (configPath) lines.push(`Config path: ${configPath}`);
    if (cachePath) lines.push(`Cache path: ${cachePath}`);
    lines.push('');
  }
  
  return lines.join('\n');
};

/**
 * Build the `config list` command.
 * @param opts - Command options.
 * @returns CommandDefinition wired to the framework adapter.
 */
export const createConfigListCommand = (
  opts: ConfigListOptions = {}
): CommandDefinition =>
  defineCommand({
    path: ['config', 'list'],
    description: 'Print the resolved config (post-merge across all 8 precedence layers).',
    category: 'Configuration',
    run: async ({ ctx }: { ctx: Context }): Promise<number> => {
      const config = await loadConfig({
        cwd: ctx.cwd(),
        env: ctx.env,
        fs: ctx.fs
      });
      
      const fmt = opts.output ?? 'text';
      
      // For text output, write directly to stdout to avoid envelope wrapping
      if (fmt === 'text') {
        ctx.stdout.write(renderConfigText(config));
        return 0;
      }
      
      // For other formats (json, yaml, ndjson), use the envelope
      formatOutput({
        ctx,
        command: 'config.list',
        output: fmt,
        status: 'ok',
        data: config,
        textRenderer: (d) => renderConfigText(d as Record<string, unknown>)
      });
      return 0;
    }
  });
