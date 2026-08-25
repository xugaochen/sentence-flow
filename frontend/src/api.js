const API_BASE = import.meta.env.VITE_API_BASE || '/api'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (response.status === 204) return null
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.detail || '请求失败，请确认后端已启动')
  return data
}

async function download(path) {
  const response = await fetch(`${API_BASE}${path}`)
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.detail || '下载失败，请确认后端已启动')
  }
  const disposition = response.headers.get('Content-Disposition') || ''
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] || 'sentence-flow-export'
  return { blob: await response.blob(), filename }
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
  download,
}

export function queryString(params) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== '' && value !== undefined && value !== null) query.set(key, value)
  })
  const text = query.toString()
  return text ? `?${text}` : ''
}
