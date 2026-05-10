const DB_NAME = 'documents-store'
const DB_VERSION = 1
const STORE_NAME = 'uploaded'

const BUILT_IN = [
  { id: 'doc-1', name: '八股（上）C/C++/STL/操作系统', filename: '八股（上）（C、C++、STL与容器、操作系统）.md' },
  { id: 'doc-2', name: '八股（中）计算机网络/STM32/FreeRTOS', filename: '八股（中）（计算机网络、STM32、FreeRTOS、通讯协议).md' },
  { id: 'doc-3', name: '八股（下）Linux/驱动/Bootloader', filename: '八股（下）（Linux应用、驱动、Bootloader、Rootfs）.md' },
]

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function getBuiltInDocs() {
  return BUILT_IN.map(d => ({ ...d, builtIn: true }))
}

let contentCache = {}

export async function loadBuiltInContent(filename) {
  if (contentCache[filename]) return contentCache[filename]
  const res = await fetch(`/reference/${encodeURIComponent(filename)}`)
  if (!res.ok) throw new Error(`Failed to load ${filename}`)
  const text = await res.text()
  contentCache[filename] = text
  return text
}

export async function getUploadedDocs() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result.map(d => ({ ...d, builtIn: false })))
    req.onerror = () => reject(req.error)
  })
}

export async function uploadDoc(name, content) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).put({ name, content, uploadedAt: new Date().toISOString() })
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function deleteUploadedDoc(name) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).delete(name)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

function extractExcerpt(text, keyword, maxChars = 2000) {
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase())
  if (idx === -1) return text.slice(0, maxChars)

  // Find the nearest heading before the keyword
  const before = text.slice(0, idx)
  const headingMatch = before.match(/(?:^|\n)(#{1,4}\s+[^\n]+)\n(?:[^#]*)$/m)
  const start = headingMatch ? before.lastIndexOf(headingMatch[1]) : Math.max(0, idx - 500)

  // Take content from start to maxChars after the keyword
  const end = Math.min(text.length, idx + maxChars)
  let excerpt = text.slice(start, end)

  // Try to end at a natural boundary
  const nextHeading = excerpt.slice(200).search(/\n#{1,4}\s+/)
  if (nextHeading > 0) {
    excerpt = excerpt.slice(0, 200 + nextHeading)
  }

  return excerpt
}

export async function searchDocuments(docIds, keywords, onProgress) {
  const results = []

  for (const id of docIds) {
    const builtIn = BUILT_IN.find(d => d.id === id)
    let content

    if (builtIn) {
      content = await loadBuiltInContent(builtIn.filename)
    } else {
      const uploaded = await getUploadedDocs()
      const doc = uploaded.find(d => d.id === id)
      if (doc) content = doc.content
    }

    if (!content) continue
    onProgress?.(`搜索 ${builtIn?.name || id}...`)

    // Find sections matching keywords
    for (const kw of [keywords, ...(keywords || '').split(/[\s,，、/]+/).filter(Boolean)]) {
      if (!kw || kw.length < 2) continue
      if (content.toLowerCase().includes(kw.toLowerCase())) {
        const excerpt = extractExcerpt(content, kw)
        results.push({ source: builtIn?.name || id, keyword: kw, excerpt })
        break // one excerpt per doc is enough
      }
    }

    // If no keyword match, take first section
    if (results.filter(r => r.source === (builtIn?.name || id)).length === 0) {
      const firstHeading = content.match(/(?:^|\n)(#{1,2}\s+[^\n]+)\n[\s\S]*?(?=\n#{1,2}\s+|$)/)
      if (firstHeading) {
        results.push({
          source: builtIn?.name || id,
          keyword: '(自动选取)',
          excerpt: firstHeading[0].slice(0, 1500),
        })
      }
    }
  }

  return results
}
