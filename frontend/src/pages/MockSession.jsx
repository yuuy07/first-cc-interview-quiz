import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useMockSession } from '../hooks/useMockSession'
import LoadingSpinner from '../components/LoadingSpinner'

export default function MockSession() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const sessionId = searchParams.get('id')
  const { session, responses, currentIndex, currentQuestion, submitting, error,
          loadSession, submitAnswer, submitFollowup, skipQuestion, goNext, finishSession } = useMockSession()

  const [userAnswer, setUserAnswer] = useState('')
  const [followupAnswer, setFollowupAnswer] = useState('')
  const [lastResult, setLastResult] = useState(null)
  const [showFollowup, setShowFollowup] = useState(false)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    if (sessionId) loadSession(sessionId)
  }, [sessionId])

  async function handleSubmit() {
    if (!userAnswer.trim()) return
    const result = await submitAnswer(userAnswer)
    if (result) {
      setLastResult(result)
      setUserAnswer('')
      if (result.followup) setShowFollowup(true)
    }
  }

  async function handleFollowupSubmit() {
    if (!followupAnswer.trim()) return
    await submitFollowup(followupAnswer)
    setFollowupAnswer('')
    setShowFollowup(false)
    goNext()
  }

  async function handleFinish() {
    await finishSession()
    setFinished(true)
  }

  function handleNextAfterSkip() {
    setLastResult(null)
    setShowFollowup(false)
    goNext()
  }

  if (!session) return <LoadingSpinner />
  if (finished) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <h2 className="text-2xl font-bold mb-4">面试结束！</h2>
        <p className="text-gray-500 mb-6">共回答 {responses.length} 题</p>
        <button onClick={() => navigate(`/mock-interview/review?id=${session.id}`)}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg">📊 查看复盘报告</button>
      </div>
    )
  }

  // After last question: show finish screen
  if (currentIndex >= (session.generated_questions?.length || 0)) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <h2 className="text-xl font-bold mb-4">所有题目已答完</h2>
        <p className="text-gray-500 mb-6">你可以选择结束面试，或返回检查已回答的题目。</p>
        <button onClick={handleFinish}
          className="bg-green-600 text-white px-6 py-2 rounded-lg">📊 结束面试并查看报告</button>
      </div>
    )
  }

  if (!currentQuestion) return null

  const totalQuestions = session.generated_questions?.length || 0
  const progress = responses.length / totalQuestions * 100

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>面试进行中</span>
          <span>第 {currentIndex + 1}/{totalQuestions} 题</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      </div>

      {/* Question */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <div className="mb-2">
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{currentQuestion.topic}</span>
        </div>
        <p className="text-lg font-medium">{currentQuestion.question}</p>
      </div>

      {/* Answer input */}
      {!lastResult && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <textarea value={userAnswer} onChange={e => setUserAnswer(e.target.value)}
            placeholder="输入你的回答..."
            className="w-full h-32 p-3 border rounded-lg resize-y mb-3" />
          <div className="flex gap-2">
            <button onClick={handleSubmit} disabled={submitting || !userAnswer.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {submitting ? '评分中...' : '📝 提交回答'}
            </button>
            <button onClick={() => { skipQuestion(); setLastResult(null) }}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg">跳过</button>
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
      )}

      {/* Result feedback */}
      {lastResult && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg font-bold">评分：{lastResult.score}/10</span>
            <span className={`px-2 py-0.5 rounded text-xs ${
              lastResult.score >= 8 ? 'bg-green-100 text-green-700' :
              lastResult.score >= 4 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {lastResult.score >= 8 ? '优秀' : lastResult.score >= 4 ? '一般' : '需加强'}
            </span>
          </div>
          <p className="text-sm">{lastResult.feedback}</p>

          {showFollowup && lastResult.followup ? (
            <div className="mt-4 pt-4 border-t">
              <p className="font-medium text-sm mb-2">追问：{lastResult.followup}</p>
              <textarea value={followupAnswer} onChange={e => setFollowupAnswer(e.target.value)}
                placeholder="回答追问..."
                className="w-full h-24 p-3 border rounded-lg resize-y mb-2 text-sm" />
              <button onClick={handleFollowupSubmit} disabled={!followupAnswer.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">提交追问回答</button>
            </div>
          ) : (
            <div className="flex gap-2 mt-4 pt-4 border-t">
              <button onClick={handleNextAfterSkip}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">
                {currentIndex < totalQuestions - 1 ? '下一题 →' : '📊 查看总结'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
