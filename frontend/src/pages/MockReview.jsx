import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useMockReport } from '../hooks/useMockReport'
import LoadingSpinner from '../components/LoadingSpinner'

function TopicBar({ topic, avg, maxAvg }) {
  const pct = maxAvg > 0 ? (avg / maxAvg) * 100 : 0
  const color = avg >= 7 ? 'bg-green-400' : avg >= 4 ? 'bg-yellow-400' : 'bg-red-400'
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span>{topic}</span>
        <span className="font-medium">{avg}/10</span>
      </div>
      <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function MockReview() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const sessionId = searchParams.get('id')
  const { session, totalScore, summary, topicScores, responses, loading, error, loadReport } = useMockReport()
  const [expanded, setExpanded] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (sessionId) loadReport(sessionId)
  }, [sessionId])

  if (loading) return <LoadingSpinner />
  if (error) return <div className="text-center py-12 text-red-500">{error}</div>
  if (!session) return <div className="text-center py-12 text-gray-500">未找到面试记录</div>

  const maxAvg = Math.max(...topicScores.map(t => t.avg), 1)

  async function handleCopyReport() {
    const lines = responses.map((r, i) =>
      `Q${i + 1} [${r.topic}] ${r.question}\n答：${r.user_answer}\n评分：${r.ai_score}/10\n反馈：${r.ai_feedback}\n`
    )
    const text = `面试复盘报告\n综合评分：${totalScore}/10\n\n${lines.join('\n')}\n总结：${summary}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">📊 面试复盘</h1>

      {/* Overall score */}
      <div className="bg-white rounded-xl shadow-sm p-6 text-center mb-4">
        <p className="text-5xl font-bold" style={{ color: totalScore >= 7 ? '#16a34a' : totalScore >= 4 ? '#ca8a04' : '#dc2626' }}>
          {totalScore}
        </p>
        <p className="text-gray-500 mt-1">综合评分 / 10</p>
        {summary && <p className="text-sm text-gray-600 mt-3">{summary}</p>}
      </div>

      {/* Topic breakdown */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h2 className="font-semibold mb-3">各话题得分</h2>
        {topicScores.map(t => <TopicBar key={t.topic} topic={t.topic} avg={t.avg} maxAvg={maxAvg} />)}
        {topicScores.length === 0 && <p className="text-gray-400 text-sm">暂无数据</p>}
      </div>

      {/* Weak points */}
      {topicScores.filter(t => t.avg < 6).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <h2 className="font-semibold mb-2 text-orange-700">薄弱环节</h2>
          <div className="flex gap-2 flex-wrap">
            {topicScores.filter(t => t.avg < 6).map(t => (
              <button key={t.topic} onClick={() => navigate(`/practice?topics=${encodeURIComponent(t.topic)}`)}
                className="text-sm bg-orange-100 text-orange-700 px-3 py-1 rounded-full hover:bg-orange-200">
                {t.topic} → 练习
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Question-by-question */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h2 className="font-semibold mb-3">答题记录</h2>
        <div className="space-y-2">
          {responses.map((r, i) => (
            <div key={r.id} className="border rounded-lg">
              <button onClick={() => setExpanded(expanded === i ? null : i)}
                className="w-full flex items-center justify-between p-3 text-left">
                <span className="text-sm font-medium truncate flex-1">
                  <span className={`mr-2 ${r.ai_score >= 7 ? 'text-green-600' : 'text-red-600'}`}>
                    {r.ai_score >= 7 ? '✅' : '❌'}
                  </span>
                  Q{i + 1}. {r.question.slice(0, 60)}...
                </span>
                <span className="text-xs text-gray-400 ml-2">{expanded === i ? '收起' : '展开'}</span>
              </button>
              {expanded === i && (
                <div className="px-3 pb-3 text-sm space-y-2 border-t pt-2">
                  <p><strong>话题：</strong>{r.topic}</p>
                  <p><strong>你的回答：</strong>{r.user_answer}</p>
                  {r.expected_answer && <p><strong>参考答案：</strong>{r.expected_answer}</p>}
                  <p><strong>评分：</strong>{r.ai_score}/10</p>
                  <p><strong>反馈：</strong>{r.ai_feedback}</p>
                  {r.ai_followup && <p><strong>追问：</strong>{r.ai_followup}</p>}
                  {r.user_followup && <p><strong>你的追问回答：</strong>{r.user_followup}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={() => navigate('/mock-interview')}
          className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">🔄 再来一次</button>
        <button onClick={() => navigate('/review')}
          className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300">📝 错题本</button>
        <button onClick={handleCopyReport}
          className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300">
          {copied ? '✅ 已复制' : '📋 导出报告'}
        </button>
      </div>
    </div>
  )
}
