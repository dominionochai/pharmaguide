// Backened is now the PharmaGuide FastAPI service (trained model + herbs),
// CORS is enabled on the backend, so direct calls work
// call it directly by absolute URL rather than proxying through Vite.
const BASE = 'http://localhost:8000'

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return res.json()
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return res.json()
}

export const getGraphData = () => get('/graph')
export const analyseRx = (rawText) => post('/analyze', { raw_text: rawText })
export const getHerbs = () => get('/herbs')

export async function detectHerbFromImage(file, medications = []) {
  const form = new FormData()
  if (file) form.append('image', file)
  form.append('medications', JSON.stringify(medications))
  const res = await fetch(`${BASE}/detect-herb`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return res.json()
}
