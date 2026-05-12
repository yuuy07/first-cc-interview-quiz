import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { supabase } from '../lib/supabase'
import { analyzeAnswer } from '../lib/deepseek'
import { useQuestionLoader } from '../hooks/useQuestionLoader'
import { useProgressSaver } from '../hooks/useProgressSaver'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function PracticeSummary({ results, onContinue, onReview }) {
  const rate = results.total > 0 ? Math.round(results.correct / results.total * 100) : 0
  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-xl shadow-sm p-6 text-center mb-6">
        <h2 className="text-xl font-bold mb-2">练习完成！</h2>
        <p className="text-5xl font-bold my-4" style={{ color: rate >= 70 ? '#16a34a' : rate >= 40 ? '#ca8a04' : '#dc2626' }}>
          {rate}%
        </p>
        <p className="text-gray-500">正确率</p>
        <div className="flex justify-center gap-8 mt-4">
          <div>
            <p className="text-2xl font-bold text-green-600">{results.correct}</p>
            <p className="text-sm text-gray-500">答对</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{results.wrong}</p>
            <p className="text-sm text-gray-500">答错</p>
          </div>
        </div>
      </div>
      {results.details.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h3 className="font-semibold mb-3">答题记录</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {results.details.map((d, i) => (
              <div key={i} className="flex items-start gap-2 text-sm border-b pb-2 last:border-0">
                <span className={`shrink-0 mt-0.5 ${d.status === 'correct' ? 'text-green-600' : 'text-red-600'}`}>
                  {d.status === 'correct' ? '✅' : '❌'}
                </span>
                <div className="min-w-0">
                  <p className="truncate">{d.question}</p>
                  <p className="text-xs text-gray-400">{d.topic}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-3">
        <button onClick={onContinue} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">📚 继续练习</button>
        <button onClick={onReview} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">📝 查看错题</button>
      </div>
    </div>
  )
}

function AiAnalysis({ result, error, loading }) {
  if (loading) return <p className="text-gray-500 mt-2 text-sm">AI 分析中...</p>
  if (error) return <p className="text-red-500 mt-2 text-sm">{error}</p>
  if (!result) return null
  return (
    <div className="mt-4 p-4 bg-green-50 rounded-lg">
      <p className="text-lg font-bold">评分：{result.score}/10</p>
      <div className="mt-2 prose prose-sm max-w-none"><Markdown remarkPlugins={[remarkGfm]}>{result.feedback}</Markdown></div>
      {result.strengths?.length > 0 && (
        <div className="mt-2"><strong>优点：</strong>
          <ul className="list-disc ml-5">{result.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
      {result.weaknesses?.length > 0 && (
        <div className="mt-2"><strong>不足：</strong>
          <ul className="list-disc ml-5 text-orange-700">{result.weaknesses.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}
    </div>
  )
}

export default function Practice() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const topics = searchParams.get('topics')?.split(',') || []
  const wrongOnly = searchParams.get('wrong_only') === '1'
  const { questions, setQuestions, loading, error } = useQuestionLoader(topics, wrongOnly)
  const { recordedIds, setRecordedIds, sessionResults, setSessionResults, recordResult, saveToSupabase, reset: resetProgress } = useProgressSaver()

  const [index, setIndex] = useState(0)
  const [mode, setMode] = useState('subjective')
  const [userAnswer, setUserAnswer] = useState('')
  const [selectedChoice, setSelectedChoice] = useState(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [user, setUser] = useState(null)
  const [choiceSaved, setChoiceSaved] = useState(false)
  const [randomMode, setRandomMode] = useState(false)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null))
  }, [])

  useEffect(() => {
    resetProgress()
    setIndex(0)
    setCompleted(false)
    setRandomMode(false)
    resetState()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics.join(','), wrongOnly])

  useEffect(() => {
    if (selectedChoice === null || !user || !question || choiceSaved) return
    if (!hasChoices) return
    setChoiceSaved(true)

    const correct = selectedChoice === question.correct_idx
    const status = correct ? 'correct' : 'wrong'
    recordResult(question, status)
    saveToSupabase(user, question.id, status, question.choices[selectedChoice])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChoice])

  const question = questions[index]
  const hasChoices = question?.choices?.length > 0

  const handleAiAnalysis = useCallback(async () => {
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
  }, [userAnswer, question])

  const handleSelfEval = useCallback(async (status) => {
    recordResult(question, status)
    if (user) await saveToSupabase(user, question.id, status, userAnswer)
    goNext()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, user, userAnswer])

  function goNext() {
    if (index >= questions.length - 1) { setCompleted(true); return }
    setIndex(i => i + 1)
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
    setChoiceSaved(false)
  }

  function shuffleQuestions() {
    setQuestions(shuffle(questions))
    setIndex(0)
    resetState()
    setRandomMode(true)
  }

  function restoreOrder() {
    setRandomMode(false)
    setIndex(0)
    resetState()
    window.location.reload()
  }

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBanner message={error} onRetry={() => window.location.reload()} />
  if (questions.length === 0) return (
    <div className="text-center py-12">
      <p className="text-gray-500 text-lg">{wrongOnly ? '暂无错题需要复习' : '请先选择话题'}</p>
    </div>
  )

  if (completed) {
    return <PracticeSummary results={sessionResults} onContinue={() => navigate('/topics')} onReview={() => navigate('/review')} />
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-gray-500">
          {question.topic} {question.subtopic && `> ${question.subtopic}`}
        </span>
        <span className="text-sm text-gray-500">第 {index + 1}/{questions.length} 题</span>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setMode('subjective')}
          className={`px-3 py-1 rounded text-sm ${mode === 'subjective' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>主观模式</button>
        {hasChoices && (
          <button onClick={() => setMode('choice')}
            className={`px-3 py-1 rounded text-sm ${mode === 'choice' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>选择题模式</button>
        )}
        <button onClick={randomMode ? restoreOrder : shuffleQuestions}
          className={`px-3 py-1 rounded text-sm ${randomMode ? 'bg-yellow-500 text-white' : 'bg-gray-200'}`}>
          {randomMode ? '🔀 已随机' : '🔀 随机顺序'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h2 className="text-lg font-medium mb-4">{question.question}</h2>
        {question.code_blocks?.map((code, i) => (
          <pre key={i} className="bg-gray-900 text-gray-100 rounded-lg p-4 mb-4 overflow-x-auto text-sm"><code>{code}</code></pre>
        ))}
      </div>

      {mode === 'subjective' && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <textarea value={userAnswer} onChange={e => setUserAnswer(e.target.value)}
            placeholder="输入你的答案..."
            className="w-full h-32 p-3 border rounded-lg resize-y mb-3" />
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

          <AiAnalysis result={aiResult} error={aiError} loading={aiLoading} />

          {showAnswer && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <strong>参考答案：</strong>
              <div className="mt-1 prose prose-sm max-w-none"><Markdown remarkPlugins={[remarkGfm]}>{question.answer}</Markdown></div>
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
              <p>{selectedChoice === question.correct_idx ? '✅ 回答正确！' : `❌ 正确答案是：${question.choices[question.correct_idx]}`}</p>
              {selectedChoice !== question.correct_idx && user && (
                <p className="text-xs text-gray-400 mt-1">已自动记入错题本</p>
              )}
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowAnswer(true)} className="bg-gray-200 px-4 py-2 rounded-lg">📖 查看解析</button>
          </div>
          {showAnswer && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <strong>解析：</strong>
              <div className="mt-1 prose prose-sm max-w-none"><Markdown remarkPlugins={[remarkGfm]}>{question.answer}</Markdown></div>
            </div>
          )}
          {selectedChoice !== null && (
            <div className="flex gap-2 mt-4">
              <button onClick={index < questions.length - 1 ? goNext : () => setCompleted(true)}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg">
                {index < questions.length - 1 ? '下一题' : '📊 查看总结'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={goPrev} disabled={index === 0}
          className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-300">← 上一题</button>
        <button onClick={goNext} disabled={index >= questions.length - 1}
          className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-300">下一题 →</button>
      </div>
    </div>
  )
}
