import { build } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const html = await readFile(path.join(root, 'generated/ssg/index.html'), 'utf8');
const canonical = /<link rel="canonical" href="(https?:\/\/[^"]+)"/.exec(html)?.[1];
if (!canonical) throw new Error('Build static HTML before building the Node server.');
await mkdir('generated', { recursive: true });
await build({
  entryPoints: ['server/index.mjs'], outfile: 'generated/node-server.mjs', bundle: true, platform: 'node', target: 'node22', format: 'esm', packages: 'external',
  define: { __SSG_ORIGIN__: JSON.stringify(new URL(canonical).origin) },
  plugins: [{ name: 'sites-node-runtime', setup(builder) {
    builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: path.join(root, 'server/node-env.mjs') }));
    builder.onResolve({ filter: /chatgpt-auth(?:\.ts)?$/ }, args => {
      if (path.resolve(path.dirname(args.importer), args.path) === path.join(root, 'app/chatgpt-auth') || path.resolve(path.dirname(args.importer), args.path) === path.join(root, 'app/chatgpt-auth.ts')) return { path: path.join(root, 'server/node-auth.mjs') };
      return null;
    });
  } }],
});
console.log('Built standalone Node server with shared API handlers.');
