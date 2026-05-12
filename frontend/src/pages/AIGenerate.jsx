import { useState, useEffect } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { supabase } from '../lib/supabase'
import { useAIGenerate, useAIEval } from '../hooks/useAIGenerate'
import { getBuiltInDocs, getUploadedDocs } from '../lib/docStore'

export default function AIGenerate() {
  const [topics, setTopics] = useState([])
  const [selectedTopic, setSelectedTopic] = useState('')
  const [keywords, setKeywords] = useState('')
  const [questionType, setQuestionType] = useState('subjective')
  const [availableDocs, setAvailableDocs] = useState([])
  const [selectedDocs, setSelectedDocs] = useState({})
  const [user, setUser] = useState(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [selectedChoice, setSelectedChoice] = useState(null)
  const [showAnswer, setShowAnswer] = useState(false)

  const { question, loading, error, handleGenerate } = useAIGenerate(selectedTopic, keywords, questionType, selectedDocs)
  const { evalResult, evalLoading, handleSubmit, resetEval } = useAIEval(question, selectedTopic, keywords, questionType)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null))

    supabase.from('questions').select('topic').then(({ data }) => {
      const set = new Set()
      data?.forEach(q => set.add(q.topic))
      setTopics([...set].sort())
    })

    Promise.all([getBuiltInDocs(), getUploadedDocs()]).then(([builtIn, uploaded]) => {
      const all = [...builtIn, ...uploaded]
      setAvailableDocs(all)
      const initial = {}
      builtIn.forEach(d => { initial[d.id || d.name] = true })
      setSelectedDocs(initial)
    })
  }, [])

  function reset() {
    setUserAnswer('')
    setSelectedChoice(null)
    setShowAnswer(false)
    resetEval()
  }

  function toggleDoc(key) {
    setSelectedDocs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">AI 出题</h1>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">话题</label>
          <select value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)}
            className="w-full p-2 border rounded-lg">
            <option value="">选择话题...</option>
            {topics.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">关键词（可选）</label>
          <input value={keywords} onChange={e => setKeywords(e.target.value)}
            placeholder="输入关键词，如：虚函数、死锁、DMA..."
            className="w-full p-2 border rounded-lg" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">题目类型</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="radio" name="qtype" checked={questionType === 'subjective'}
                onChange={() => setQuestionType('subjective')} />主观题
            </label>
            <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="radio" name="qtype" checked={questionType === 'choice'}
                onChange={() => setQuestionType('choice')} />选择题
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">参考文档</label>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {availableDocs.map(doc => {
              const key = doc.id || doc.name
              return (
                <label key={key} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm">
                  <input type="checkbox" checked={!!selectedDocs[key]}
                    onChange={() => toggleDoc(key)} className="rounded" />
                  <span>{doc.name}</span>
                  {doc.builtIn && <span className="text-xs text-gray-400">(内置)</span>}
                </label>
              )
            })}
          </div>
        </div>

        <button onClick={handleGenerate} disabled={loading || !selectedTopic}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {loading ? '搜索文档并生成中...' : '🎯 出题'}
        </button>

        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>

      {question && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <h2 className="text-lg font-medium mb-3">{question.question}</h2>

          {questionType === 'choice' && question.choices && (
            <div className="space-y-2 mb-4">
              {question.choices.map((c, i) => (
                <label key={i} className={`block p-3 border rounded-lg cursor-pointer ${
                  selectedChoice === i ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                } ${evalResult ? (i === question.correct_idx ? 'border-green-500 bg-green-50' : selectedChoice === i ? 'border-red-500 bg-red-50' : '') : ''}`}>
                  <input type="radio" name="ai-choice" checked={selectedChoice === i}
                    onChange={() => setSelectedChoice(i)} disabled={!!evalResult} className="mr-2" />
                  {c}
                </label>
              ))}
            </div>
          )}

          {questionType === 'subjective' && !evalResult && (
            <textarea value={userAnswer} onChange={e => setUserAnswer(e.target.value)}
              placeholder="输入你的答案..."
              className="w-full h-32 p-3 border rounded-lg resize-y mb-3" />
          )}

          {!evalResult && (
            <div className="flex gap-2">
              <button onClick={() => handleSubmit(user, userAnswer, selectedChoice)} disabled={
                (questionType === 'subjective' && !userAnswer.trim()) ||
                (questionType === 'choice' && selectedChoice === null) || evalLoading
              }
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
                {evalLoading ? '批改中...' : '📝 提交答案'}
              </button>
              <button onClick={() => setShowAnswer(!showAnswer)}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300">
                {showAnswer ? '隐藏答案' : '📖 显示答案'}
              </button>
            </div>
          )}

          {evalResult && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <p className="text-lg font-bold">评分：{evalResult.score}/10</p>
              <div className="mt-2 prose prose-sm max-w-none"><Markdown remarkPlugins={[remarkGfm]}>{evalResult.feedback}</Markdown></div>
              {evalResult.strengths?.length > 0 && (
                <div className="mt-2"><strong>优点：</strong>
                  <ul className="list-disc ml-5">{evalResult.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              {evalResult.weaknesses?.length > 0 && (
                <div className="mt-2"><strong>不足：</strong>
                  <ul className="list-disc ml-5 text-orange-700">{evalResult.weaknesses.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </div>
              )}
              {evalResult.score < 5 && <p className="text-xs text-gray-400 mt-2">（已自动记入错题本）</p>}
            </div>
          )}

          {showAnswer && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <strong>参考答案：</strong>
              <div className="mt-1 prose prose-sm max-w-none"><Markdown remarkPlugins={[remarkGfm]}>{question.answer}</Markdown></div>
            </div>
          )}

          {evalResult && (
            <div className="flex gap-2 mt-4">
              <button onClick={reset} className="bg-blue-600 text-white px-4 py-2 rounded-lg">🎯 再来一题</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
