import { useState } from 'react'
import { supabase } from '../lib/supabase'

const DEEPSEEK_BASE = 'https://api.deepseek.com/v1'

function apiKey() {
  return localStorage.getItem('deepseek_api_key')
}

async function callDeepSeek(messages) {
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({ model: 'deepseek-chat', messages, temperature: 0.3, max_tokens: 1024 }),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const data = await res.json()
  return JSON.parse(data.choices[0].message.content)
}

export function useMockSession() {
  const [session, setSession] = useState(null)
  const [responses, setResponses] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const currentQuestion = session?.generated_questions?.[currentIndex] || null

  async function createSession({ jdText, company, resumeText, topics, duration, questions }) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('请先登录')

    const { data, error: err } = await supabase.from('interview_sessions').insert({
      user_id: user.id,
      jd_text: jdText,
      company: company || null,
      resume_text: resumeText || null,
      topics,
      duration,
      generated_questions: questions,
    }).select().single()

    if (err) throw new Error(err.message)
    setSession(data)
    setResponses([])
    setCurrentIndex(0)
    return data.id
  }

  async function loadSession(sessionId) {
    setError(null)
    const { data: s, error: se } = await supabase.from('interview_sessions')
      .select('*').eq('id', sessionId).single()
    if (se) { setError(se.message); return }

    const { data: r } = await supabase.from('interview_responses')
      .select('*').eq('session_id', sessionId).order('order_num')

    setSession(s)
    setResponses(r || [])
    setCurrentIndex(r?.length || 0)
  }

  async function submitAnswer(userAnswer) {
    if (!currentQuestion || !session) return null
    const key = apiKey()
    if (!key) { setError('请先在设置中填入 DeepSeek API Key'); return null }

    setSubmitting(true)
    setError(null)
    try {
      const result = await callDeepSeek([
        {
          role: 'system',
          content: '你是面试官。根据问题和参考答案评分。返回 JSON: {"score": 1-10, "feedback": "...", "followup": "追问内容或空字符串"}',
        },
        {
          role: 'user',
          content: `问题：${currentQuestion.question}\n参考答案：${currentQuestion.expected_answer}\n用户答案：${userAnswer}`,
        },
      ])

      const { data, error: ie } = await supabase.from('interview_responses').insert({
        session_id: session.id,
        question: currentQuestion.question,
        expected_answer: currentQuestion.expected_answer,
        topic: currentQuestion.topic,
        user_answer: userAnswer,
        ai_score: result.score,
        ai_feedback: result.feedback,
        ai_followup: result.followup || null,
        order_num: currentIndex,
      }).select().single()

      if (ie) throw new Error(ie.message)
      setResponses(prev => [...prev, data])
      return result
    } catch (e) {
      setError('评分失败：' + e.message)
      return null
    } finally {
      setSubmitting(false)
    }
  }

  async function submitFollowup(userFollowup) {
    const last = responses[responses.length - 1]
    if (!last) return
    const { error: ue } = await supabase.from('interview_responses')
      .update({ user_followup: userFollowup }).eq('id', last.id)
    if (!ue) {
      setResponses(prev => prev.map(r => r.id === last.id ? { ...r, user_followup: userFollowup } : r))
    }
  }

  function goNext() {
    setCurrentIndex(i => i + 1)
  }
  const skipQuestion = goNext

  async function finishSession() {
    if (!session) return
    const total = responses.reduce((s, r) => s + r.ai_score, 0)
    const avg = responses.length > 0 ? +(total / responses.length).toFixed(1) : null

    const key = apiKey()
    let summaryText = null
    if (key && responses.length > 0) {
      try {
        const weakTopics = [...new Set(responses.filter(r => r.ai_score < 6).map(r => r.topic))]
        const result = await callDeepSeek([
          {
            role: 'system',
            content: '生成面试总结，指出薄弱点和改进方向。50字以内。返回 JSON: {"summary": "..."}',
          },
          {
            role: 'user',
            content: `各题得分：${responses.map(r => `${r.topic}:${r.ai_score}/10`).join(', ')}。薄弱话题：${weakTopics.join(', ')}`,
          },
        ])
        summaryText = result?.summary || null
      } catch {}
    }

    const { error: ue } = await supabase.from('interview_sessions')
      .update({ status: 'completed', total_score: avg, summary: summaryText })
      .eq('id', session.id)
    if (ue) { setError(ue.message); return }
    setSession(prev => ({ ...prev, status: 'completed', total_score: avg, summary: summaryText }))
  }

  return {
    session, responses, currentIndex, currentQuestion, submitting, error,
    createSession, submitAnswer, submitFollowup, skipQuestion, goNext, finishSession, loadSession,
  }
}
