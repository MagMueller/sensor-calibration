import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

const distDirectory = new URL('../dist/', import.meta.url);
const clientDirectory = new URL('../dist/client/', import.meta.url);
const serverDirectory = new URL('../dist/server/', import.meta.url);

await rm(distDirectory, { recursive: true, force: true });
await mkdir(clientDirectory, { recursive: true });
await mkdir(serverDirectory, { recursive: true });
await cp(new URL('../build/', import.meta.url), clientDirectory, { recursive: true });

const worker = `const worker = {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== 'GET') {
      return response;
    }

    const acceptsHtml = request.headers.get('accept')?.includes('text/html');
    if (!acceptsHtml) {
      return response;
    }

    const indexRequest = new Request(new URL('/index.html', request.url), {
      method: 'GET',
      headers: request.headers,
    });
    return env.ASSETS.fetch(indexRequest);
  },
};

export default worker;
`;

const wrangler = {
  name: 'sensor-calibration-studio',
  compatibility_date: '2026-05-15',
  compatibility_flags: ['nodejs_compat'],
  main: 'index.js',
  no_bundle: true,
  assets: { directory: '../client' },
  observability: { enabled: true },
  rules: [{ type: 'ESModule', globs: ['**/*.js', '**/*.mjs'] }],
};

await writeFile(new URL('index.js', serverDirectory), worker);
await writeFile(
  new URL('wrangler.json', serverDirectory),
  `${JSON.stringify(wrangler, null, 2)}\n`,
);
await writeFile(
  new URL('_headers', clientDirectory),
  '/static/*\n  Cache-Control: public, max-age=31536000, immutable\n',
);
await writeFile(
  new URL('.assetsignore', clientDirectory),
  'wrangler.json\n.dev.vars\n.vite\n',
);

console.log('Prepared dist/client and dist/server for Sites hosting.');
