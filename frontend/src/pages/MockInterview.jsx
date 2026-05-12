import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMockInterview } from '../hooks/useMockInterview'
import { useMockSession } from '../hooks/useMockSession'
import { parseResume } from '../lib/resumeParser'

export default function MockInterview() {
  const navigate = useNavigate()
  const { topics, suggestedTopics, companyInfo, loading, error,
          analyzeJd, fetchCompanyInfo, generatePrompt, generateQuestions, setError, setCompanyInfo } = useMockInterview()
  const { createSession } = useMockSession()

  const [jdText, setJdText] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [resumeFileName, setResumeFileName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [selectedTopics, setSelectedTopics] = useState([])
  const [duration, setDuration] = useState(30)
  const [jdAnalyzed, setJdAnalyzed] = useState(false)
  const [starting, setStarting] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)
  const [editingCompany, setEditingCompany] = useState(false)
  const [editedCompany, setEditedCompany] = useState({})

  async function handleAnalyzeJd() {
    if (!jdText.trim()) return
    setJdAnalyzed(false)
    await analyzeJd(jdText)
    setJdAnalyzed(true)
  }

  async function handleResumeUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await parseResume(file)
      setResumeText(text)
      setResumeFileName(file.name)
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleFetchCompany() {
    if (!companyName.trim()) return
    await fetchCompanyInfo(companyName)
  }

  async function handleStart() {
    if (!jdText.trim() || selectedTopics.length === 0) return
    setStarting(true)
    setError(null)
    try {
      const questions = await generateQuestions(jdText, resumeText, selectedTopics,
        duration <= 15 ? 3 : duration <= 30 ? 6 : 10)
      const sessionId = await createSession({
        jdText, company: companyInfo?.name || null, resumeText, topics: selectedTopics, duration, questions,
      })
      navigate(`/mock-interview/session?id=${sessionId}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setStarting(false)
    }
  }

  async function handleCopyPrompt() {
    const prompt = generatePrompt(jdText, resumeText, selectedTopics)
    await navigator.clipboard.writeText(prompt)
    setPromptCopied(true)
    setTimeout(() => setPromptCopied(false), 2000)
    // Create a pending session for later result entry
    try {
      await createSession({
        jdText, company: companyInfo?.name || null, resumeText, topics: selectedTopics, duration,
        questions: [], status: 'pending',
      })
    } catch {}
  }

  function toggleTopic(t) {
    setSelectedTopics(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  // On first JD analysis, auto-select suggested topics
  useEffect(() => {
    if (jdAnalyzed && suggestedTopics.length > 0) {
      setSelectedTopics(prev => {
        const combined = [...new Set([...suggestedTopics.filter(t => topics.includes(t)), ...prev])]
        return combined.length > 0 ? combined : prev
      })
    }
  }, [jdAnalyzed, suggestedTopics])

  const canStart = jdText.trim().length > 0 && selectedTopics.length > 0

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🎯 AI 模拟面试</h1>

      {/* JD Input */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <label className="block font-medium mb-2">岗位 JD <span className="text-red-500">*</span></label>
        <textarea value={jdText} onChange={e => { setJdText(e.target.value); setJdAnalyzed(false) }}
          placeholder="粘贴岗位 JD..."
          className="w-full h-32 p-3 border rounded-lg resize-y mb-2" />
        {!jdText.trim() && <p className="text-xs text-red-500">请粘贴岗位 JD</p>}
        <div className="flex gap-2">
          <button onClick={handleAnalyzeJd} disabled={loading || !jdText.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {loading ? '分析中...' : '🔍 分析技术要求'}
          </button>
          {jdText.length > 3000 && <p className="text-xs text-amber-600 self-center">JD 过长，已截断分析</p>}
        </div>
      </div>

      {/* Resume Upload */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <label className="block font-medium mb-2">简历（可选）</label>
        <p className="text-sm text-gray-500 mb-2">支持 .md .txt .pdf，5MB 以内。不上传服务器，仅存本地。</p>
        <label className="inline-block bg-gray-200 px-4 py-2 rounded-lg text-sm cursor-pointer hover:bg-gray-300">
          {resumeFileName ? `✅ ${resumeFileName}` : '📄 选择文件'}
          <input type="file" accept=".md,.txt,.pdf" onChange={handleResumeUpload} className="hidden" />
        </label>
        {resumeText && <p className="text-xs text-green-600 mt-1">已解析（{resumeText.length} 字）</p>}
      </div>

      {/* Company */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <label className="block font-medium mb-2">公司名（可选）</label>
        <div className="flex gap-2">
          <input value={companyName} onChange={e => setCompanyName(e.target.value)}
            placeholder="如：字节跳动、大疆..."
            className="flex-1 p-2 border rounded-lg text-sm" />
          <button onClick={handleFetchCompany} disabled={loading || !companyName.trim()}
            className="bg-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-300 disabled:opacity-50">查询</button>
        </div>
        {companyInfo && !editingCompany && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm">
            <p className="text-xs text-gray-400 mb-1">⚠️ AI 生成，仅供参考</p>
            <p><strong>{companyInfo.name}</strong></p>
            <p>业务：{companyInfo.business}</p>
            <p>规模：{companyInfo.scale}</p>
            <p>技术栈：{companyInfo.techStack}</p>
            <div className="flex gap-2 mt-1">
              <button onClick={() => { setEditedCompany(companyInfo); setEditingCompany(true) }}
                className="text-blue-600 text-xs hover:underline">编辑</button>
              <button onClick={() => setCompanyInfo(null)} className="text-red-500 text-xs hover:underline">清除</button>
            </div>
          </div>
        )}
        {companyInfo && editingCompany && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm">
            <p className="text-xs text-gray-400 mb-1">✏️ 编辑公司信息</p>
            <div className="space-y-2">
              <div><label className="text-xs text-gray-500">公司名</label><input value={editedCompany.name || ''} onChange={e => setEditedCompany(prev => ({...prev, name: e.target.value}))} className="w-full p-1 border rounded text-sm" /></div>
              <div><label className="text-xs text-gray-500">业务</label><input value={editedCompany.business || ''} onChange={e => setEditedCompany(prev => ({...prev, business: e.target.value}))} className="w-full p-1 border rounded text-sm" /></div>
              <div><label className="text-xs text-gray-500">规模</label><input value={editedCompany.scale || ''} onChange={e => setEditedCompany(prev => ({...prev, scale: e.target.value}))} className="w-full p-1 border rounded text-sm" /></div>
              <div><label className="text-xs text-gray-500">技术栈</label><input value={editedCompany.techStack || ''} onChange={e => setEditedCompany(prev => ({...prev, techStack: e.target.value}))} className="w-full p-1 border rounded text-sm" /></div>
              <div className="flex gap-2 mt-1">
                <button onClick={() => { setCompanyInfo(editedCompany); setEditingCompany(false) }} className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700">保存</button>
                <button onClick={() => setEditingCompany(false)} className="text-gray-500 text-xs hover:underline">取消</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Topics */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <label className="block font-medium mb-2">面试话题 <span className="text-red-500">*</span></label>
        {suggestedTopics.length > 0 && (
          <p className="text-xs text-green-600 mb-2">AI 推荐：{suggestedTopics.join('、')}</p>
        )}
        {jdAnalyzed && suggestedTopics.length === 0 && <p className="text-xs text-orange-600 mt-2">AI 未能识别技术方向，请手动选择</p>}
        {jdAnalyzed && <button onClick={handleAnalyzeJd} disabled={loading} className="text-xs text-blue-600 ml-2 hover:underline">重新分析</button>}
        <div className="flex gap-2 flex-wrap">
          {topics.map(t => (
            <button key={t} onClick={() => toggleTopic(t)}
              className={`px-3 py-1 rounded-full text-sm ${
                selectedTopics.includes(t) ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}>{t}</button>
          ))}
        </div>
        {selectedTopics.length === 0 && <p className="text-xs text-red-500 mt-1">至少选择一个话题</p>}
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {/* Duration + Actions */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <label className="block font-medium mb-2">面试时长</label>
        <div className="flex gap-3 mb-4">
          {[15, 30, 60].map(m => (
            <button key={m} onClick={() => setDuration(m)}
              className={`px-4 py-2 rounded-lg text-sm ${duration === m ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>{m} 分钟</button>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={handleStart} disabled={!canStart || starting}
            className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
            {starting ? '准备中...' : '▶ 开始面试'}
          </button>
          <button onClick={handleCopyPrompt} disabled={!canStart}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 disabled:opacity-50">
            {promptCopied ? '✅ 已复制' : '📋 复制豆包 prompt'}
          </button>
        </div>
      </div>
    </div>
  )
}
