#!/usr/bin/env node
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promises as fs } from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const targets = [
  {
    entry: path.join(root, 'electron/mcp/workos-mcp-server.mjs'),
    outfile: path.join(root, 'dist-electron/mcp/workos-mcp-server.mjs'),
  },
  {
    // SessionStart hook — no npm deps, but bundle for consistency + future-proofing.
    entry: path.join(root, 'electron/mcp/session-start-hook.mjs'),
    outfile: path.join(root, 'dist-electron/mcp/session-start-hook.mjs'),
  },
];

for (const { entry, outfile } of targets) {
  await fs.mkdir(path.dirname(outfile), { recursive: true });
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    legalComments: 'none',
  });
  await fs.chmod(outfile, 0o755).catch(() => {});
  console.log(`[build-mcp-server] bundled → ${path.relative(root, outfile)}`);
}
