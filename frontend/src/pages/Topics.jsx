import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'

export default function Topics() {
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState({})
  const navigate = useNavigate()

  useEffect(() => {
    supabase
      .from('questions')
      .select('topic, id')
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); return }
        const map = {}
        data.forEach(q => {
          if (!map[q.topic]) map[q.topic] = { name: q.topic, total: 0 }
          map[q.topic].total += 1
        })
        setTopics(Object.values(map).sort((a, b) => b.total - a.total))
        setLoading(false)
      })
  }, [])

  function toggle(topicName) {
    setSelected(prev => ({ ...prev, [topicName]: !prev[topicName] }))
  }

  function startPractice() {
    const chosen = Object.entries(selected).filter(([, v]) => v).map(([k]) => k)
    if (chosen.length === 0) return
    navigate('/practice?topics=' + encodeURIComponent(chosen.join(',')))
  }

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBanner message={error} onRetry={() => window.location.reload()} />

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">选择话题</h1>
      <div className="space-y-2">
        {topics.map(t => (
          <label key={t.name}
            className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${
              selected[t.name] ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
            }`}>
            <input type="checkbox" checked={!!selected[t.name]} onChange={() => toggle(t.name)}
              className="mr-3 h-5 w-5" />
            <div className="flex-1">
              <span className="font-medium">{t.name}</span>
              <span className="text-gray-500 text-sm ml-2">({t.total} 题)</span>
            </div>
          </label>
        ))}
      </div>
      {Object.values(selected).some(Boolean) && (
        <button onClick={startPractice}
          className="mt-6 w-full bg-blue-600 text-white py-3 rounded-lg text-lg font-bold hover:bg-blue-700">
          开始练习 ({Object.values(selected).filter(Boolean).length} 个话题)
        </button>
      )}
    </div>
  )
}
