import { useState } from 'react'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    const { data } = await supabase
      .from('questions')
      .select('question, topic, subtopic')
      .or(`question.ilike.%${query}%,answer.ilike.%${query}%`)
      .limit(20)
    setResults(data || [])
    setLoading(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">搜索题库</h1>
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="输入关键词搜索..."
          className="flex-1 px-4 py-2 border rounded-lg" />
        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
          搜索
        </button>
      </form>

      {loading && <LoadingSpinner />}

      {results.length === 0 && query && !loading && (
        <p className="text-gray-500 text-center py-8">未找到相关题目</p>
      )}

      <div className="space-y-3">
        {results.map((q, i) => (
          <div key={i} className="bg-white rounded-lg p-4 border">
            <p className="font-medium">{q.question}</p>
            <p className="text-sm text-gray-500 mt-1">{q.topic}{q.subtopic ? ` > ${q.subtopic}` : ''}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
