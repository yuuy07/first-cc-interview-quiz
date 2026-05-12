import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'

export default function Review() {
  const [wrongAnswers, setWrongAnswers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) { navigate('/login'); return }
      supabase.from('user_progress')
        .select('*, questions(*)')
        .eq('user_id', data.user.id)
        .eq('status', 'wrong')
        .eq('session_type', 'quiz')
        .then(({ data: rows, error: err }) => {
          if (err) { setError(err.message); return }
          setWrongAnswers(rows)
          setLoading(false)
        })
    })
  }, [])

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBanner message={error} onRetry={() => window.location.reload()} />

  const filtered = filter
    ? wrongAnswers.filter(w => w.questions?.topic === filter)
    : wrongAnswers

  const topics = [...new Set(wrongAnswers.map(w => w.questions?.topic).filter(Boolean))]

  if (wrongAnswers.length === 0) return (
    <div className="text-center py-12">
      <p className="text-gray-500 text-lg">暂无错题，继续加油！</p>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">错题本（{wrongAnswers.length} 题）</h1>
        <button onClick={() => navigate(`/practice?topics=${encodeURIComponent(topics.join(','))}&wrong_only=1`)}
          className="text-sm bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600">
          复习全部错题
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilter('')}
          className={`px-3 py-1 rounded text-sm ${!filter ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>全部</button>
        {topics.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1 rounded text-sm ${filter === t ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>{t}</button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(w => (
          <div key={w.id} className="bg-white rounded-lg p-4 border hover:shadow-sm">
            <p className="font-medium">
              {w.questions?.question}
              {w.questions?.tags?.includes('ai_generated') && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded ml-2">AI</span>}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {w.questions?.topic} · 答错 {w.attempt_count} 次 · 上次 {new Date(w.last_reviewed).toLocaleDateString()}
            </p>
            {w.questions?.topic && (
              <button onClick={() => navigate(`/practice?topics=${encodeURIComponent(w.questions.topic)}&wrong_only=1`)}
                className="text-blue-600 text-sm mt-2">再练一次 →</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
