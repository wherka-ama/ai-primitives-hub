import esbuild from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

await esbuild.build({
  entryPoints: ['src/cli/main.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/cli/prompt-registry-bundle.js',
  format: 'cjs',
  external: [],
  minify: true,
  minifyIdentifiers: true,
  minifySyntax: true,
  minifyWhitespace: true,
  sourcemap: false,
  treeShaking: true,
  metafile: true,
  define: {
    'CLI_VERSION': JSON.stringify(pkg.version),
  },
});
