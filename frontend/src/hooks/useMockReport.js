import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function useMockReport() {
  const [session, setSession] = useState(null)
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function loadReport(sessionId) {
    setLoading(true)
    setError(null)

    const { data: s, error: se } = await supabase.from('interview_sessions')
      .select('*').eq('id', sessionId).single()
    if (se) { setError(se.message); setLoading(false); return }

    const { data: r } = await supabase.from('interview_responses')
      .select('*').eq('session_id', sessionId).order('order_num')

    setSession(s)
    setResponses(r || [])
    setLoading(false)
  }

  const totalScore = session?.total_score || 0
  const summary = session?.summary || ''

  const topicScores = (() => {
    const map = {}
    responses.forEach(r => {
      if (!map[r.topic]) map[r.topic] = { total: 0, count: 0 }
      map[r.topic].total += r.ai_score
      map[r.topic].count++
    })
    return Object.entries(map).map(([topic, d]) => ({
      topic,
      avg: +(d.total / d.count).toFixed(1),
      count: d.count,
    }))
  })()

  const weakPoints = topicScores.filter(t => t.avg < 6).map(t => t.topic)

  return { session, totalScore, summary, topicScores, responses, weakPoints, loading, error, loadReport }
}
