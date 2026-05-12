import { uploadDoc } from './docStore'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export async function parseResume(file) {
  if (file.size > MAX_FILE_SIZE) throw new Error('文件超过 5MB 限制')

  const ext = file.name.split('.').pop().toLowerCase()
  let text
  if (ext === 'md' || ext === 'txt') {
    text = await file.text()
  } else if (ext === 'pdf') {
    text = await parsePdfText(file)
  } else {
    throw new Error('无法解析此文件，请尝试 .md 或 .txt 格式')
  }

  // Best-effort save to IndexedDB
  try {
    await uploadDoc('resume-' + file.name, text)
  } catch {
    // IndexedDB failure is non-critical, parsing still succeeded
  }

  return text
}

async function parsePdfText(file) {
  let pdfjsLib
  try {
    pdfjsLib = await import('pdfjs-dist')
  } catch {
    throw new Error('无法解析此文件，请尝试 .md 或 .txt 格式')
  }

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const text = await page.getTextContent()
    pages.push(text.items.map(item => item.str).join(' '))
  }
  return pages.join('\n\n')
}
