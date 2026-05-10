import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { analyzeAnswer } from '../lib/deepseek'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'

export default function Practice() {
  const [searchParams] = useSearchParams()
  const [questions, setQuestions] = useState([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('subjective')
  const [userAnswer, setUserAnswer] = useState('')
  const [selectedChoice, setSelectedChoice] = useState(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [user, setUser] = useState(null)

  const topics = searchParams.get('topics')?.split(',') || []

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null))
  }, [])

  useEffect(() => {
    if (topics.length === 0) return
    supabase
      .from('questions')
      .select('*')
      .in('topic', topics)
      .order('display_order')
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); return }
        setQuestions(data)
        setLoading(false)
      })
  }, [topics.join(',')])

  const question = questions[index]

  async function handleAiAnalysis() {
    if (!userAnswer.trim()) return
    setAiLoading(true)
    setAiError(null)
    const apiKey = localStorage.getItem('deepseek_api_key')
    if (!apiKey) { setAiError('请先在设置中填入 DeepSeek API Key'); setAiLoading(false); return }
    try {
      const result = await analyzeAnswer(question.question, question.answer, userAnswer, apiKey)
      setAiResult(result)
    } catch (e) {
      setAiError('AI 分析失败：' + e.message)
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSelfEval(status) {
    if (!user) return
    const { data: existing } = await supabase
      .from('user_progress')
      .select('id, attempt_count')
      .eq('user_id', user.id)
      .eq('question_id', question.id)
      .eq('session_type', 'quiz')
      .single()

    if (existing) {
      await supabase.from('user_progress').update({
        status, attempt_count: existing.attempt_count + 1,
        last_answer: userAnswer, last_reviewed: new Date().toISOString()
      }).eq('id', existing.id)
    } else {
      await supabase.from('user_progress').insert({
        user_id: user.id, question_id: question.id, status,
        attempt_count: 1, last_answer: userAnswer, session_type: 'quiz'
      })
    }
    goNext()
  }

  function goNext() {
    if (index < questions.length - 1) setIndex(i => i + 1)
    resetState()
  }

  function goPrev() {
    if (index > 0) setIndex(i => i - 1)
    resetState()
  }

  function resetState() {
    setUserAnswer('')
    setSelectedChoice(null)
    setShowAnswer(false)
    setAiResult(null)
    setAiError(null)
  }

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBanner message={error} onRetry={() => window.location.reload()} />
  if (questions.length === 0) return (
    <div className="text-center py-12 text-gray-500">请先选择话题</div>
  )

  const hasChoices = question.choices && question.choices.length > 0

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-gray-500">
          {question.topic} {question.subtopic && `> ${question.subtopic}`}
        </span>
        <span className="text-sm text-gray-500">第 {index + 1}/{questions.length} 题</span>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setMode('subjective')}
          className={`px-3 py-1 rounded text-sm ${mode === 'subjective' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
          主观模式
        </button>
        {hasChoices && (
          <button onClick={() => setMode('choice')}
            className={`px-3 py-1 rounded text-sm ${mode === 'choice' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
            选择题模式
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h2 className="text-lg font-medium mb-4">{question.question}</h2>
        {question.code_blocks?.map((code, i) => (
          <pre key={i} className="bg-gray-900 text-gray-100 rounded-lg p-4 mb-4 overflow-x-auto text-sm">
            <code>{code}</code>
          </pre>
        ))}
      </div>

      {mode === 'subjective' && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <textarea value={userAnswer} onChange={e => setUserAnswer(e.target.value)}
            placeholder="输入你的答案..."
            className="w-full h-32 p-3 border rounded-lg resize-y mb-3"
          />
          <div className="flex gap-2">
            <button onClick={handleAiAnalysis} disabled={aiLoading || !userAnswer.trim()}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
              {aiLoading ? '分析中...' : '🧠 AI 分析'}
            </button>
            <button onClick={() => setShowAnswer(!showAnswer)}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300">
              {showAnswer ? '隐藏答案' : '📖 显示参考答案'}
            </button>
          </div>

          {aiError && <p className="text-red-500 mt-2 text-sm">{aiError}</p>}

          {aiResult && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <p className="text-lg font-bold">评分：{aiResult.score}/10</p>
              <p className="mt-2">{aiResult.feedback}</p>
              {aiResult.strengths?.length > 0 && (
                <div className="mt-2"><strong>优点：</strong>
                  <ul className="list-disc ml-5">{aiResult.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              {aiResult.weaknesses?.length > 0 && (
                <div className="mt-2"><strong>不足：</strong>
                  <ul className="list-disc ml-5 text-orange-700">{aiResult.weaknesses.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </div>
              )}
            </div>
          )}

          {showAnswer && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <strong>参考答案：</strong>
              <div className="mt-1 whitespace-pre-wrap">{question.answer}</div>
            </div>
          )}

          {user && (
            <div className="flex gap-2 mt-4">
              <button onClick={() => handleSelfEval('correct')} className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600">✅ 答对了</button>
              <button onClick={() => handleSelfEval('wrong')} className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600">❌ 答错了</button>
              <button onClick={() => handleSelfEval('skipped')} className="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500">🤷 跳过</button>
            </div>
          )}
        </div>
      )}

      {mode === 'choice' && hasChoices && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <div className="space-y-2">
            {question.choices.map((c, i) => (
              <label key={i} className={`block p-3 border rounded-lg cursor-pointer ${
                selectedChoice === i ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
              }`}>
                <input type="radio" name="choice" checked={selectedChoice === i}
                  onChange={() => setSelectedChoice(i)} className="mr-2" />
                {c}
              </label>
            ))}
          </div>
          {selectedChoice !== null && (
            <div className={`mt-4 p-3 rounded-lg ${
              selectedChoice === question.correct_idx ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {selectedChoice === question.correct_idx ? '✅ 回答正确！' : `❌ 正确答案是：${question.choices[question.correct_idx]}`}
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button onClick={() => { setShowAnswer(true) }} className="bg-gray-200 px-4 py-2 rounded-lg">📖 查看解析</button>
          </div>
          {showAnswer && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <strong>解析：</strong>
              <div className="mt-1 whitespace-pre-wrap">{question.answer}</div>
            </div>
          )}
          {user && selectedChoice !== null && (
            <div className="flex gap-2 mt-4">
              <button onClick={() => handleSelfEval(selectedChoice === question.correct_idx ? 'correct' : 'wrong')}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg">下一题</button>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={goPrev} disabled={index === 0}
          className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-300">
          ← 上一题
        </button>
        <button onClick={goNext} disabled={index >= questions.length - 1}
          className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-300">
          下一题 →
        </button>
      </div>
    </div>
  )
}
