import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const serverDir = resolve('dist', 'server')
const workerPath = resolve(serverDir, 'index.js')

const workerSource = `
const INDEX_PATH = '/index.html';

function shouldFallbackToIndex(request, response) {
  if (response.status !== 404) return false;
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;

  const url = new URL(request.url);
  if (url.pathname.startsWith('/assets/')) return false;
  if (url.pathname.includes('.')) return false;

  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html') || accept.includes('*/*') || accept === '';
}

export default {
  async fetch(request, env) {
    if (!env || !env.ASSETS) {
      return new Response('Sites static asset binding is unavailable.', { status: 500 });
    }

    const response = await env.ASSETS.fetch(request);
    if (!shouldFallbackToIndex(request, response)) return response;

    const indexUrl = new URL(INDEX_PATH, request.url);
    return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
  },
};
`.trimStart()

await mkdir(serverDir, { recursive: true })
await writeFile(workerPath, workerSource)
