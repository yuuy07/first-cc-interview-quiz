import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Stats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) { setLoading(false); return }
      supabase.from('user_progress')
        .select('status')
        .eq('user_id', data.user.id)
        .eq('session_type', 'quiz')
        .then(({ data: rows }) => {
          const total = rows?.length || 0
          const correct = rows?.filter(r => r.status === 'correct').length || 0
          const wrong = rows?.filter(r => r.status === 'wrong').length || 0
          setStats({
            totalAnswered: total,
            correct,
            wrong,
            skipped: rows?.filter(r => r.status === 'skipped').length || 0,
            rate: total > 0 ? Math.round(correct / total * 100) : 0,
          })
          setLoading(false)
        })
    })
  }, [])

  if (loading) return <LoadingSpinner />

  if (!stats) return <div className="text-center py-12 text-gray-500">请先登录以查看统计</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">学习统计</h1>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-6 text-center shadow-sm">
          <p className="text-3xl font-bold text-blue-600">{stats.totalAnswered}</p>
          <p className="text-gray-500 mt-1">已答题数</p>
        </div>
        <div className="bg-white rounded-xl p-6 text-center shadow-sm">
          <p className="text-3xl font-bold text-green-600">{stats.rate}%</p>
          <p className="text-gray-500 mt-1">正确率</p>
        </div>
        <div className="bg-white rounded-xl p-6 text-center shadow-sm">
          <p className="text-3xl font-bold text-green-500">{stats.correct}</p>
          <p className="text-gray-500 mt-1">答对</p>
        </div>
        <div className="bg-white rounded-xl p-6 text-center shadow-sm">
          <p className="text-3xl font-bold text-red-500">{stats.wrong}</p>
          <p className="text-gray-500 mt-1">答错</p>
        </div>
      </div>
    </div>
  )
}
