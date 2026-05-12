import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DEEPSEEK_BASE = 'https://api.deepseek.com/v1'

function apiKey() {
  return localStorage.getItem('deepseek_api_key')
}

async function callDeepSeek(messages, temperature = 0.3, maxTokens = 2048) {
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  })
  if (!res.ok) throw new Error(`DeepSeek API error: ${res.status}`)
  const data = await res.json()
  return JSON.parse(data.choices[0].message.content)
}

export function useMockInterview() {
  const [topics, setTopics] = useState([])
  const [suggestedTopics, setSuggestedTopics] = useState([])
  const [companyInfo, setCompanyInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.from('questions').select('topic').then(({ data }) => {
      if (!data) return
      const set = new Set()
      data.forEach(q => set.add(q.topic))
      setTopics([...set].sort())
    })
  }, [])

  async function analyzeJd(jdText) {
    const key = apiKey()
    if (!key) { setError('请先在设置中填入 DeepSeek API Key'); return }

    const truncated = jdText.length > 3000 ? jdText.slice(0, 3000) : jdText
    setLoading(true)
    setError(null)
    setSuggestedTopics([])

    try {
      const available = topics.length > 0 ? topics : []
      const result = await callDeepSeek([
        {
          role: 'system',
          content: `你是技术面试官。分析 JD 中的技术要求，返回 JSON: {"topics": ["C++", "RTOS", ...]}。
话题只能从以下列表中选择：${available.join(', ') || 'C, C++, STM32, FreeRTOS, Linux, 驱动, Bootloader, Rootfs, 计算机网络, 操作系统, STL与容器, 通讯协议'}`,
        },
        { role: 'user', content: `分析以下 JD 的技术要求：\n${truncated}` },
      ])
      setSuggestedTopics(Array.isArray(result?.topics) ? result.topics : [])
    } catch (e) {
      setError('JD 分析失败：' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function fetchCompanyInfo(companyName) {
    const key = apiKey()
    if (!key || !companyName.trim()) return

    setLoading(true)
    setError(null)
    try {
      const result = await callDeepSeek([
        {
          role: 'system',
          content: '你是一个公司信息助手。根据公开已知信息介绍该公司。返回 JSON: {"name": "...", "business": "...", "scale": "...", "techStack": "..."}。注意：标注信息来源为 AI 生成。',
        },
        { role: 'user', content: `介绍这家公司：${companyName}` },
      ])
      setCompanyInfo(result ? { ...result, aiGenerated: true } : null)
    } catch (e) {
      setError('查询公司信息失败：' + e.message)
    } finally {
      setLoading(false)
    }
  }

  function generatePrompt(jdText, resumeText, selectedTopics) {
    const jdSummary = jdText.slice(0, 500)
    const resumeSummary = resumeText ? resumeText.slice(0, 300) : '(未提供)'
    return `你是一名嵌入式/C++ 面试官。请根据以下要求进行面试：
岗位要求：${jdSummary}
候选人背景：${resumeSummary}
重点考察方向：${selectedTopics.join('、')}
面试风格：先问基础，根据回答情况深入追问或换题。
每题给出评分（1-10）和简短反馈。
全部结束后给出总结评价。`
  }

  async function generateQuestions(jdText, resumeText, selectedTopics, count) {
    const key = apiKey()
    if (!key) throw new Error('请先在设置中填入 DeepSeek API Key')

    const truncatedJd = jdText.length > 2000 ? jdText.slice(0, 2000) : jdText
    const truncatedResume = resumeText ? resumeText.slice(0, 1000) : ''

    return callDeepSeek(
      [
        {
          role: 'system',
          content: `你是一名嵌入式/C++ 面试官。根据岗位要求和候选人背景出${count}道面试题，话题范围：${selectedTopics.join(', ')}。返回 JSON 数组：[{"question": "...", "expected_answer": "...", "topic": "..."}]`,
        },
        {
          role: 'user',
          content: `岗位要求：${truncatedJd}\n候选人背景：${truncatedResume || '(未提供)'}`,
        },
      ],
      0.7,
      4096
    )
  }

  return {
    topics,
    suggestedTopics,
    companyInfo,
    loading,
    error,
    analyzeJd,
    fetchCompanyInfo,
    generatePrompt,
    generateQuestions,
    setError,
    setCompanyInfo,
  }
}
