import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'

const TOPIC_LABELS = {
  'C': 'C语言',
  'C++': 'C++',
  'STM32': 'STM32',
  'FreeRTOS': 'FreeRTOS',
  'Linux': 'Linux应用',
  '驱动': '驱动开发',
  'Bootloader': 'Bootloader',
  'Rootfs': 'Rootfs',
  '计算机网络': '计算机网络',
  '操作系统': '操作系统',
  'STL与容器': 'STL/容器',
  '通讯协议': '通讯协议',
}

export default function Stats() {
  const [stats, setStats] = useState(null)
  const [topicStats, setTopicStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) { setLoading(false); return }

      supabase.from('user_progress')
        .select('status, questions!inner(topic)')
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

          // Per-topic breakdown
          const map = {}
          rows?.forEach(r => {
            const topic = r.questions?.topic || '未分类'
            if (!map[topic]) map[topic] = { total: 0, correct: 0, wrong: 0 }
            map[topic].total++
            if (r.status === 'correct') map[topic].correct++
            else if (r.status === 'wrong') map[topic].wrong++
          })

          const topicList = Object.entries(map)
            .map(([topic, data]) => ({
              topic,
              ...data,
              rate: Math.round(data.correct / data.total * 100),
            }))
            .sort((a, b) => b.total - a.total)

          setTopicStats(topicList)
          setLoading(false)
        })
    })
  }, [])

  if (loading) return <LoadingSpinner />

  if (!stats) return <div className="text-center py-12 text-gray-500">请先登录以查看统计</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">学习统计</h1>

      {/* Overall stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="bg-white rounded-xl p-4 sm:p-6 text-center shadow-sm">
          <p className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.totalAnswered}</p>
          <p className="text-gray-500 mt-1 text-sm">总答题</p>
        </div>
        <div className="bg-white rounded-xl p-4 sm:p-6 text-center shadow-sm">
          <p className="text-2xl sm:text-3xl font-bold text-green-600">{stats.rate}%</p>
          <p className="text-gray-500 mt-1 text-sm">正确率</p>
        </div>
        <div className="bg-white rounded-xl p-4 sm:p-6 text-center shadow-sm">
          <p className="text-2xl sm:text-3xl font-bold text-green-500">{stats.correct}</p>
          <p className="text-gray-500 mt-1 text-sm">答对</p>
        </div>
        <div className="bg-white rounded-xl p-4 sm:p-6 text-center shadow-sm">
          <p className="text-2xl sm:text-3xl font-bold text-red-500">{stats.wrong}</p>
          <p className="text-gray-500 mt-1 text-sm">答错</p>
        </div>
      </div>

      {/* Per-topic breakdown */}
      <h2 className="text-lg font-semibold mb-3">按话题统计</h2>
      {topicStats.length === 0 ? (
        <p className="text-gray-500 text-center py-8">暂无数据</p>
      ) : (
        <div className="space-y-3">
          {topicStats.map(t => {
            return (
              <div key={t.topic} className="bg-white rounded-lg p-4 border">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-sm">{TOPIC_LABELS[t.topic] || t.topic}</span>
                  <span className="text-sm text-gray-500">
                    {t.correct}/{t.total}
                    <span className={`ml-2 font-medium ${t.rate >= 70 ? 'text-green-600' : t.rate >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {t.rate}%
                    </span>
                  </span>
                </div>
                {/* Bar: green = correct, red = wrong */}
                <div className="w-full h-5 bg-gray-100 rounded-full overflow-hidden flex">
                  {t.correct > 0 && (
                    <div
                      className="h-full bg-green-400 transition-all duration-500"
                      style={{ width: `${t.rate}%` }}
                      title={`正确 ${t.correct} 题`}
                    />
                  )}
                  {t.wrong > 0 && (
                    <div
                      className="h-full bg-red-400 transition-all duration-500"
                      style={{ width: `${100 - t.rate}%` }}
                      title={`错误 ${t.wrong} 题`}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
