import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { generateQuestion, evaluateAnswer } from '../lib/deepseek'
import { searchDocuments } from '../lib/docStore'

export function useAIGenerate(selectedTopic, keywords, questionType, selectedDocs) {
  const [question, setQuestion] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleGenerate() {
    const apiKey = localStorage.getItem('deepseek_api_key')
    if (!apiKey) { setError('请先在设置中填入 DeepSeek API Key'); return }
    if (!selectedTopic) { setError('请选择话题'); return }

    const activeDocIds = Object.entries(selectedDocs).filter(([, v]) => v).map(([k]) => k)
    if (activeDocIds.length === 0) { setError('请至少选择一个参考文档'); return }

    setLoading(true)
    setError(null)
    setQuestion(null)

    try {
      const searchKw = keywords || selectedTopic
      const excerpts = await searchDocuments(activeDocIds, searchKw)
      const docContext = excerpts.length > 0
        ? '以下是参考文档中与题目相关的内容：\n\n' + excerpts.map(e =>
            `[${e.source} - ${e.keyword}]\n${e.excerpt}`
          ).join('\n\n---\n\n')
        : ''

      const result = await generateQuestion({
        topic: selectedTopic, keywords: keywords || undefined,
        questionType, docContext, apiKey,
      })
      setQuestion(result)
    } catch (e) {
      setError('出题失败：' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return { question, setQuestion, loading, error, setError, handleGenerate }
}

export function useAIEval(question, selectedTopic, keywords, questionType) {
  const [evalResult, setEvalResult] = useState(null)
  const [evalLoading, setEvalLoading] = useState(false)

  async function handleSubmit(user, userAnswer, selectedChoice) {
    if (questionType === 'choice') {
      if (selectedChoice === null) return
      const correct = selectedChoice === question.correct_idx
      setEvalResult({
        score: correct ? 10 : 0,
        feedback: correct ? '回答正确！' : `回答错误。正确答案是选项 ${question.correct_idx + 1}：${question.choices[question.correct_idx]}`,
        strengths: correct ? ['正确选择了答案'] : [],
        weaknesses: correct ? [] : ['答案选择错误'],
      })
      if (!correct) {
        const answer = question.choices?.[selectedChoice] || ''
        await saveToReview(user, false, answer)
      }
      return
    }

    if (!userAnswer.trim()) return
    const apiKey = localStorage.getItem('deepseek_api_key')
    if (!apiKey) {
      setEvalResult({ score: 0, feedback: '请先在设置中填入 DeepSeek API Key', strengths: [], weaknesses: ['未配置 API Key'] })
      return
    }
    setEvalLoading(true)
    try {
      const result = await evaluateAnswer(question.question, question.answer, userAnswer, apiKey)
      setEvalResult(result)
      const score = result?.score || 0
      if (score < 5) await saveToReview(user, false, userAnswer)
    } catch (e) {
      console.error('批改失败：' + e.message)
    } finally {
      setEvalLoading(false)
    }
  }

  async function saveToReview(user, wasCorrect, lastAnswer) {
    if (!user || !question) return
    const qType = questionType === 'choice'
      ? (question.choices?.length === 2 ? 'judge' : 'choice')
      : 'subjective'

    const { data: qData } = await supabase.from('questions').insert({
      topic: selectedTopic,
      subtopic: keywords || 'AI出题',
      question: question.question,
      answer: question.answer,
      choices: question.choices || null,
      correct_idx: question.correct_idx ?? null,
      difficulty: 3,
      tags: ['ai_generated'],
      code_blocks: [],
      question_type: qType,
      source_id: null,
      display_order: Date.now(),
    }).select('id').single()

    if (qData) {
      await supabase.from('user_progress').upsert({
        user_id: user.id,
        question_id: qData.id,
        status: wasCorrect ? 'correct' : 'wrong',
        attempt_count: 1,
        last_answer: lastAnswer,
        last_reviewed: new Date().toISOString(),
        session_type: 'quiz',
      }, { onConflict: 'user_id,question_id,session_type' })
    }
  }

  function resetEval() {
    setEvalResult(null)
    setEvalLoading(false)
  }

  return { evalResult, setEvalResult, evalLoading, handleSubmit, resetEval }
}
