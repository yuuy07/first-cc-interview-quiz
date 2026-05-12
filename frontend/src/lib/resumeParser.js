const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export async function parseResume(file) {
  if (file.size > MAX_FILE_SIZE) throw new Error('文件超过 5MB 限制')

  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'md' || ext === 'txt') {
    return await file.text()
  }
  if (ext === 'pdf') {
    return await parsePdfText(file)
  }
  throw new Error('仅支持 .md、.txt、.pdf 格式')
}

async function parsePdfText(file) {
  let pdfjsLib
  try {
    pdfjsLib = await import('pdfjs-dist')
  } catch {
    throw new Error('PDF 解析库加载失败，请尝试使用 .md 或 .txt 格式')
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
