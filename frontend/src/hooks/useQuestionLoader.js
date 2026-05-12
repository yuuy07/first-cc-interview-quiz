import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useQuestionLoader(topics, wrongOnly) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const cancelRef = useRef(false)

  useEffect(() => {
    if (topics.length === 0) { setLoading(false); return }

    setLoading(true)
    setError(null)
    cancelRef.current = false

    async function load() {
      let query = supabase.from('questions').select('*')

      if (wrongOnly) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { if (!cancelRef.current) setLoading(false); return }

        const { data: topicQuestions } = await supabase
          .from('questions').select('id').in('topic', topics)
        const topicIds = topicQuestions?.map(q => q.id) || []

        const { data: wrongRows } = await supabase
          .from('user_progress')
          .select('question_id')
          .eq('user_id', user.id)
          .eq('status', 'wrong')
          .eq('session_type', 'quiz')
          .in('question_id', topicIds)
        const wrongIds = wrongRows?.map(r => r.question_id) || []

        if (cancelRef.current) return
        if (wrongIds.length === 0) {
          setQuestions([]); setLoading(false); return
        }
        query = query.in('id', wrongIds)
      } else {
        query = query.in('topic', topics)
      }

      const { data, error: err } = await query.order('display_order')
      if (cancelRef.current) return
      if (err) { setError(err.message); setLoading(false); return }
      setQuestions(data)
      setLoading(false)
    }

    load()
    return () => { cancelRef.current = true }
  }, [topics.join(','), wrongOnly])

  return { questions, setQuestions, loading, error }
}
