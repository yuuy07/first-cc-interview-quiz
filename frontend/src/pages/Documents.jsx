import { useState, useEffect } from 'react'
import { getBuiltInDocs, getUploadedDocs, uploadDoc, deleteUploadedDoc, loadBuiltInContent } from '../lib/docStore'

export default function Documents() {
  const [builtInDocs] = useState(() => getBuiltInDocs())
  const [uploadedDocs, setUploadedDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    getUploadedDocs().then(docs => {
      setUploadedDocs(docs)
      setLoading(false)
    }).catch(e => {
      setError(e.message)
      setLoading(false)
    })
  }, [])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.md') && !file.name.endsWith('.txt')) {
      setError('仅支持 .md 和 .txt 文件')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const content = await file.text()
      // Check for duplicate name
      const exists = [...builtInDocs, ...uploadedDocs].some(d => d.name === file.name)
      if (exists) {
        if (!confirm(`文档 "${file.name}" 已存在，是否覆盖？`)) { setUploading(false); return }
        await deleteUploadedDoc(file.name)
      }
      await uploadDoc(file.name, content)
      const updated = await getUploadedDocs()
      setUploadedDocs(updated)
    } catch (e) {
      setError('上传失败：' + e.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(doc) {
    if (!confirm(`删除 "${doc.name}"？`)) return
    try {
      await deleteUploadedDoc(doc.name)
      setUploadedDocs(prev => prev.filter(d => d.name !== doc.name))
    } catch (e) {
      setError('删除失败：' + e.message)
    }
  }

  async function handlePreview(doc) {
    let content
    if (doc.builtIn && doc.filename) {
      content = await loadBuiltInContent(doc.filename)
    } else {
      const all = await getUploadedDocs()
      const found = all.find(d => d.name === doc.name)
      content = found?.content
    }
    if (content) {
      const win = window.open('', '_blank')
      win.document.write(`<pre style="white-space:pre-wrap;font-size:13px;padding:16px">${content.replace(/</g, '&lt;')}</pre>`)
      win.document.title = doc.name
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">参考文档</h1>
      <p className="text-sm text-gray-500 mb-6">AI 出题时将搜索以下文档中的相关内容作为参考。</p>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="font-medium mb-3">内置文档</h2>
        <div className="space-y-2">
          {builtInDocs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm">{doc.name}</span>
              <button onClick={() => handlePreview(doc)}
                className="text-blue-600 text-sm hover:underline">预览</button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">自定义文档</h2>
          <label className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm cursor-pointer hover:bg-blue-700">
            {uploading ? '上传中...' : '+ 上传文档'}
            <input type="file" accept=".md,.txt" onChange={handleUpload}
              className="hidden" disabled={uploading} />
          </label>
        </div>
        {uploadedDocs.length === 0 ? (
          <p className="text-gray-400 text-sm py-4 text-center">暂无自定义文档，上传 .md 或 .txt 文件</p>
        ) : (
          <div className="space-y-2">
            {uploadedDocs.map(doc => (
              <div key={doc.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm">{doc.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{doc.uploadedAt?.slice(0, 10)}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handlePreview(doc)}
                    className="text-blue-600 text-sm hover:underline">预览</button>
                  <button onClick={() => handleDelete(doc)}
                    className="text-red-500 text-sm hover:underline">删除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
