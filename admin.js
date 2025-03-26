
// Admin panel handler - this will serve the admin panel files
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname

  // Serve admin panel files
  if (path === '/admin' || path === '/admin/') {
    return fetch('admin/index.html')
  } else if (path.startsWith('/admin/')) {
    const filePath = path.replace('/admin/', '')
    return fetch(`admin/${filePath}`)
  }

  // Forward other requests to the main API worker
  return fetch(request)
}
