import test from 'node:test'
import assert from 'node:assert/strict'

import worker from '../scripts/sites-worker-runtime.js'

test('direct SPA routes serve the client shell instead of an asset redirect', async () => {
  const requestedPaths: string[] = []
  const env = {
    ASSETS: {
      fetch: async (request: Request) => {
        const path = new URL(request.url).pathname
        requestedPaths.push(path)
        if (path === '/client/index.html') {
          return new Response('<main>Gravity Graveyard</main>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          })
        }
        return Response.redirect('https://example.test/', 307)
      },
    },
  }

  const response = await worker.fetch(
    new Request('https://example.test/game/gravity-graveyard', {
      headers: { accept: 'text/html' },
    }),
    env,
  )

  assert.equal(response.status, 200)
  assert.equal(await response.text(), '<main>Gravity Graveyard</main>')
  assert.deepEqual(requestedPaths, ['/client/index.html'])
})

test('real static asset requests still pass through untouched', async () => {
  const env = {
    ASSETS: {
      fetch: async () => new Response('compiled asset', { status: 200 }),
    },
  }

  const response = await worker.fetch(
    new Request('https://example.test/client/assets/game.js', {
      headers: { accept: '*/*' },
    }),
    env,
  )

  assert.equal(response.status, 200)
  assert.equal(await response.text(), 'compiled asset')
})
