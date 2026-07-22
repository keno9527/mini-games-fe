const INDEX_PATHS = ['/client/index.html', '/index.html']

async function fetchAsset(request, env) {
  const response = await env.ASSETS.fetch(request)
  if (response.status !== 404) return response

  const url = new URL(request.url)
  if (url.pathname.startsWith('/client/')) return response

  const clientUrl = new URL(`/client${url.pathname}`, request.url)
  return env.ASSETS.fetch(new Request(clientUrl.toString(), request))
}

async function fetchIndex(request, env) {
  for (const path of INDEX_PATHS) {
    const indexUrl = new URL(path, request.url)
    const response = await env.ASSETS.fetch(new Request(indexUrl.toString(), request))
    if (response.status !== 404) return response
  }
  return new Response('Mini Games entry file is unavailable.', { status: 404 })
}

function isPageNavigation(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false

  const url = new URL(request.url)
  if (url.pathname.startsWith('/client/')) return false
  if (url.pathname.includes('.')) return false

  const accept = request.headers.get('accept') || ''
  return accept.includes('text/html') || accept.includes('*/*') || accept === ''
}

export default {
  async fetch(request, env) {
    if (!env || !env.ASSETS) {
      return new Response('Sites static asset binding is unavailable.', { status: 500 })
    }

    if (isPageNavigation(request)) return fetchIndex(request, env)

    const response = await fetchAsset(request, env)
    if (response.status !== 404) return response
    return isPageNavigation(request) ? fetchIndex(request, env) : response
  },
}
