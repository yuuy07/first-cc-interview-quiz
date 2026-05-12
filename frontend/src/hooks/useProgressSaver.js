import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function useProgressSaver() {
  const [recordedIds, setRecordedIds] = useState(new Set())
  const [sessionResults, setSessionResults] = useState({ correct: 0, wrong: 0, total: 0, details: [] })

  function reset() {
    setRecordedIds(new Set())
    setSessionResults({ correct: 0, wrong: 0, total: 0, details: [] })
  }

  function recordResult(question, status) {
    if (!question || recordedIds.has(question.id)) return
    setRecordedIds(prev => new Set([...prev, question.id]))
    setSessionResults(prev => ({
      correct: prev.correct + (status === 'correct' ? 1 : 0),
      wrong: prev.wrong + (status === 'wrong' ? 1 : 0),
      total: prev.total + 1,
      details: [...prev.details, { question: question.question, topic: question.topic, status }],
    }))
  }

  async function saveToSupabase(user, questionId, status, answer) {
    if (!user) return
    const { data: existing } = await supabase
      .from('user_progress')
      .select('id, attempt_count')
      .eq('user_id', user.id)
      .eq('question_id', questionId)
      .eq('session_type', 'quiz')
      .single()

    if (existing) {
      await supabase.from('user_progress').update({
        status, attempt_count: existing.attempt_count + 1,
        last_answer: answer, last_reviewed: new Date().toISOString()
      }).eq('id', existing.id)
    } else {
      await supabase.from('user_progress').insert({
        user_id: user.id, question_id: questionId, status,
        attempt_count: 1, last_answer: answer, session_type: 'quiz'
      })
    }
  }

  return { recordedIds, setRecordedIds, sessionResults, setSessionResults, recordResult, saveToSupabase, reset }
}
