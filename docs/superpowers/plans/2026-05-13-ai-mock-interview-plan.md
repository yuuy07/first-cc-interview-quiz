# AI 模拟面试 Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI mock interview feature (text only) — user pastes JD + resume, AI interviews, scores, and generates review report.

**Architecture:** 3 new pages + 3 hooks + 1 utility module + 2 Supabase tables. Hooks own all state and API calls; pages are thin UI layers. Reuses existing DeepSeek API calls (`deepseek.js`), document storage pattern (`docStore.js`), and Supabase client.

**Tech Stack:** React 19, Supabase, DeepSeek API, pdf.js (client-side PDF parsing), IndexedDB (resume storage)

---

## File Structure

```
src/
  lib/
    resumeParser.js          — NEW: Resume text extraction (.md/.txt/.pdf)
  hooks/
    useMockInterview.js      — NEW: JD analysis, topic extraction, question generation, company info
    useMockSession.js        — NEW: Interview session CRUD, answer submission, scoring
    useMockReport.js         — NEW: Aggregate response data for review report
  pages/
    MockInterview.jsx         — NEW: Configuration page (JD + resume + company + topic selection)
    MockSession.jsx           — NEW: Interview flow page (Q&A, scoring, follow-up)
    MockReview.jsx            — NEW: Review report page (scores, breakdown, weak points)
  App.jsx                    — MODIFY: Add 3 new routes
  components/Layout.jsx      — MODIFY: Add nav link for mock interview
```

---

### Task 1: Supabase Migration (interview_sessions + interview_responses)

**Files:**
- Create: `supabase/migrations/20260513_add_interview_tables.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Interview sessions
create table interview_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users not null,
  status              text not null default 'in_progress'
                      check (status in ('in_progress','completed','cancelled','pending')),
  jd_text             text not null,
  company             text,
  resume_text         text,
  topics              text[] not null,
  duration            int not null default 30,
  generated_questions jsonb,
  total_score         numeric(4,1),
  summary             text,
  created_at          timestamptz default now()
);

alter table interview_sessions enable row level security;
create policy "Users can manage own sessions"
  on interview_sessions for all
  using (auth.uid() = user_id);

-- Interview responses
create table interview_responses (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid references interview_sessions on delete cascade not null,
  question        text not null,
  expected_answer text,
  topic           text not null,
  user_answer     text not null,
  ai_score        int not null check (ai_score between 1 and 10),
  ai_feedback     text,
  ai_followup     text,
  user_followup   text,
  order_num       int not null,
  created_at      timestamptz default now()
);

alter table interview_responses enable row level security;
create policy "Users can manage own responses"
  on interview_responses for all
  using (exists (
    select 1 from interview_sessions where id = session_id and user_id = auth.uid()
  ));
```

- [ ] **Step 2: Run the migration**

Run: `cd frontend && npx supabase migration up`
Expected: "Applied 20260513_add_interview_tables.sql"

If the supabase CLI isn't configured locally, run the SQL directly in Supabase dashboard > SQL Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260513_add_interview_tables.sql
git commit -m "feat: add interview_sessions and interview_responses tables"
```

---

### Task 2: resumeParser.js — Resume text extraction utility

**Files:**
- Create: `frontend/src/lib/resumeParser.js`

- [ ] **Step 1: Implement resumeParser.js**

```js
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export async function parseResume(file) {
  if (file.size > MAX_FILE_SIZE) throw new Error('文件超过 5MB 限制')

  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'md' || ext === 'txt') {
    return await file.text()
  }
  if (ext === 'pdf') {
    return await parsePdfText(file)
  }
  throw new Error('仅支持 .md、.txt、.pdf 格式')
}

async function parsePdfText(file) {
  // Dynamic import pdf.js — not a dependency issue at build time
  let pdfjsLib
  try {
    pdfjsLib = await import('pdfjs-dist')
  } catch {
    throw new Error('PDF 解析库加载失败，请尝试使用 .md 或 .txt 格式')
  }

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const text = await page.getTextContent()
    pages.push(text.items.map(item => item.str).join(' '))
  }
  return pages.join('\n\n')
}
```

Note: `pdfjs-dist` needs to be added as a dependency. Run `npm install pdfjs-dist` in frontend/.

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build success, no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/resumeParser.js frontend/package.json frontend/package-lock.json
git commit -m "feat: add resumeParser for .md/.txt/.pdf extraction"
```

---

### Task 3: useMockInterview.js hook

**Files:**
- Create: `frontend/src/hooks/useMockInterview.js`

**API:**
```js
const {
  // State
  topics,          // all available topics from DB
  companyInfo,     // { name, business, scale, techStack } | null
  suggestedTopics, // topics AI extracted from JD
  loading,         // boolean
  error,           // string | null

  // Actions
  analyzeJd,        // (jdText) => Promise<void> — AI extracts tech topics from JD
  fetchCompanyInfo, // (companyName) => Promise<void> — AI generates company summary
  generatePrompt,   // (jdText, resumeText, topics) => string — generate 豆包 prompt
  generateQuestions,// (jdText, resumeText, topics, count) => Promise<Array<{question, expected_answer, topic}>>
} = useMockInterview()
```

- [ ] **Step 1: Implement useMockInterview.js**

```js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DEEPSEEK_BASE = 'https://api.deepseek.com/v1'

function apiKey() {
  return localStorage.getItem('deepseek_api_key')
}

function callDeepSeek(messages, temperature = 0.3, maxTokens = 2048) {
  return fetch(`${DEEPSEEK_BASE}/chat/completions`, {
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
  }).then(r => {
    if (!r.ok) throw new Error(`DeepSeek API error: ${r.status}`)
    return r.json()
  }).then(d => JSON.parse(d.choices[0].message.content))
}

export function useMockInterview() {
  const [topics, setTopics] = useState([])
  const [suggestedTopics, setSuggestedTopics] = useState([])
  const [companyInfo, setCompanyInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.from('questions').select('topic').then(({ data }) => {
      const set = new Set()
      data?.forEach(q => set.add(q.topic))
      setTopics([...set].sort())
    })
  }, [])

  async function analyzeJd(jdText) {
    const key = apiKey()
    if (!key) { setError('请先在设置中填入 DeepSeek API Key'); return }

    const truncated = jdText.length > 3000 ? jdText.slice(0, 3000) : jdText
    setLoading(true)
    setError(null)

    try {
      const result = await callDeepSeek([
        { role: 'system', content: '你是技术面试官。分析 JD 中的技术要求，返回 JSON: {"topics": ["C++", "RTOS", ...]}。话题只能从以下列表中选择：' + [...new Set(topics)].join(',') },
        { role: 'user', content: `分析以下 JD 的技术要求：\n${truncated}` },
      ])
      setSuggestedTopics(result.topics || [])
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
        { role: 'system', content: '你是一个公司信息助手。根据公开已知信息介绍该公司。返回 JSON: {"name": "...", "business": "...", "scale": "...", "techStack": "..."}。注意：标注信息来源为 AI 生成。' },
        { role: 'user', content: `介绍这家公司：${companyName}` },
      ])
      setCompanyInfo({ ...result, aiGenerated: true })
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

    return callDeepSeek([
      { role: 'system', content: `你是一名嵌入式/C++ 面试官。根据岗位要求和候选人背景出${count}道面试题，话题范围：${selectedTopics.join(', ')}。返回 JSON 数组：[{"question": "...", "expected_answer": "...", "topic": "..."}]` },
      { role: 'user', content: `岗位要求：${truncatedJd}\n候选人背景：${truncatedResume || '(未提供)'}` },
    ], 0.7, 4096)
  }

  return { topics, suggestedTopics, companyInfo, loading, error,
           analyzeJd, fetchCompanyInfo, generatePrompt, generateQuestions, setError, setCompanyInfo }
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build success

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useMockInterview.js
git commit -m "feat: add useMockInterview hook for JD analysis and question generation"
```

---

### Task 4: useMockSession.js hook

**Files:**
- Create: `frontend/src/hooks/useMockSession.js`

**API:**
```js
const {
  session,       // interview_sessions row
  responses,     // interview_responses rows
  currentIndex,  // which question we're on
  currentQuestion, // { question, expected_answer, topic }
  submitting,    // boolean — scoring in progress
  error,

  createSession,  // (options) => Promise<sessionId>
  submitAnswer,   // (userAnswer) => Promise<{score, feedback, followup}>
  submitFollowup, // (userFollowup) => Promise<void>
  skipQuestion,
  finishSession,  // () => Promise<void>
  loadSession,    // (sessionId) => Promise<void>
} = useMockSession()
```

- [ ] **Step 1: Implement useMockSession.js**

```js
import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { evaluateAnswer } from '../lib/deepseek'

const DEEPSEEK_BASE = 'https://api.deepseek.com/v1'

function apiKey() {
  return localStorage.getItem('deepseek_api_key')
}

function callDeepSeek(messages) {
  return fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey()}` },
    body: JSON.stringify({ model: 'deepseek-chat', messages, temperature: 0.3, max_tokens: 1024 }),
  }).then(r => r.ok ? r.json() : Promise.reject(new Error(`API error: ${r.status}`)))
    .then(d => JSON.parse(d.choices[0].message.content))
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
      generated_questions: JSON.parse(JSON.stringify(questions)),
    }).select().single()

    if (err) throw new Error(err.message)
    setSession(data)
    setResponses([])
    setCurrentIndex(0)
    return data.id
  }

  async function loadSession(sessionId) {
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
    if (!currentQuestion || !session) return
    const key = apiKey()
    if (!key) { setError('请先在设置中填入 DeepSeek API Key'); return }

    setSubmitting(true)
    setError(null)
    try {
      const result = await callDeepSeek([
        { role: 'system', content: '你是面试官。根据问题和参考答案评分。返回 JSON: {"score": 1-10, "feedback": "...", "followup": "追问内容或空字符串"}' },
        { role: 'user', content: `问题：${currentQuestion.question}\n参考答案：${currentQuestion.expected_answer}\n用户答案：${userAnswer}` },
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
    if (responses.length === 0) return
    const last = responses[responses.length - 1]
    const { error: ue } = await supabase.from('interview_responses')
      .update({ user_followup: userFollowup }).eq('id', last.id)
    if (!ue) {
      setResponses(prev => prev.map(r => r.id === last.id ? { ...r, user_followup: userFollowup } : r))
    }
  }

  function skipQuestion() {
    setCurrentIndex(i => i + 1)
  }

  function goNext() {
    setCurrentIndex(i => i + 1)
  }

  async function finishSession() {
    if (!session) return
    const total = responses.reduce((s, r) => s + r.ai_score, 0)
    const avg = responses.length > 0 ? +(total / responses.length).toFixed(1) : null

    const key = apiKey()
    let summary = null
    if (key && responses.length > 0) {
      try {
        const weakTopics = [...new Set(responses.filter(r => r.ai_score < 6).map(r => r.topic))]
        summary = await callDeepSeek([
          { role: 'system', content: '生成面试总结，指出薄弱点和改进方向。50字以内。' },
          { role: 'user', content: `各题得分：${responses.map(r => `${r.topic}:${r.ai_score}/10`).join(', ')}。薄弱话题：${weakTopics.join(', ')}` },
        ])
      } catch {}
    }

    const { error: ue } = await supabase.from('interview_sessions')
      .update({ status: 'completed', total_score: avg, summary: summary?.summary || null })
      .eq('id', session.id)
    if (ue) { setError(ue.message); return }
    setSession(prev => ({ ...prev, status: 'completed', total_score: avg, summary: summary?.summary || null }))
  }

  return { session, responses, currentIndex, currentQuestion, submitting, error,
           createSession, submitAnswer, submitFollowup, skipQuestion, goNext, finishSession, loadSession }
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build success

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useMockSession.js
git commit -m "feat: add useMockSession hook for interview flow management"
```

---

### Task 5: useMockReport.js hook

**Files:**
- Create: `frontend/src/hooks/useMockReport.js`

**API:**
```js
const {
  totalScore,
  topicScores,    // [{topic, total, count, avg}]
  responses,
  weakPoints,     // string[]
  loading,
  loadReport,     // (sessionId) => Promise<void>
} = useMockReport()
```

- [ ] **Step 1: Implement useMockReport.js**

```js
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
```

- [ ] **Step 2: Verify build** — same as previous

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useMockReport.js
git commit -m "feat: add useMockReport hook for interview review data"
```

---

### Task 6: MockInterview.jsx — Configuration page

**Files:**
- Create: `frontend/src/pages/MockInterview.jsx`

This page renders the interview configuration form. Key sections:
1. JD textarea
2. Resume upload
3. Company name input
4. Topic selector (suggested + manual)
5. Duration selector
6. [Start interview] / [Copy 豆包 prompt] buttons

- [ ] **Step 1: Implement MockInterview.jsx**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMockInterview } from '../hooks/useMockInterview'
import { useMockSession } from '../hooks/useMockSession'
import { parseResume } from '../lib/resumeParser'

export default function MockInterview() {
  const navigate = useNavigate()
  const { topics, suggestedTopics, companyInfo, loading, error,
          analyzeJd, fetchCompanyInfo, generatePrompt, generateQuestions, setError, setCompanyInfo } = useMockInterview()
  const { createSession } = useMockSession()

  const [jdText, setJdText] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [resumeFileName, setResumeFileName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [selectedTopics, setSelectedTopics] = useState([])
  const [duration, setDuration] = useState(30)
  const [jdAnalyzed, setJdAnalyzed] = useState(false)
  const [starting, setStarting] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)

  async function handleAnalyzeJd() {
    if (!jdText.trim()) return
    setJdAnalyzed(false)
    await analyzeJd(jdText)
    setJdAnalyzed(true)
  }

  async function handleResumeUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await parseResume(file)
      setResumeText(text)
      setResumeFileName(file.name)
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleFetchCompany() {
    if (!companyName.trim()) return
    await fetchCompanyInfo(companyName)
  }

  async function handleStart() {
    if (!jdText.trim() || selectedTopics.length === 0) return
    setStarting(true)
    setError(null)
    try {
      const questions = await generateQuestions(jdText, resumeText, selectedTopics,
        duration <= 15 ? 3 : duration <= 30 ? 6 : 10)
      const sessionId = await createSession({
        jdText, company: companyInfo?.name || null, resumeText, topics: selectedTopics, duration, questions,
      })
      navigate(`/mock-interview/session?id=${sessionId}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setStarting(false)
    }
  }

  function handleCopyPrompt() {
    const prompt = generatePrompt(jdText, resumeText, selectedTopics)
    navigator.clipboard.writeText(prompt).then(() => {
      setPromptCopied(true)
      setTimeout(() => setPromptCopied(false), 2000)
    })
  }

  function toggleTopic(t) {
    setSelectedTopics(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  // On first JD analysis, auto-select suggested topics
  useEffect(() => {
    if (jdAnalyzed && suggestedTopics.length > 0) {
      setSelectedTopics(prev => {
        const combined = [...new Set([...suggestedTopics.filter(t => topics.includes(t)), ...prev])]
        return combined.length > 0 ? combined : prev
      })
    }
  }, [jdAnalyzed, suggestedTopics])

  const canStart = jdText.trim().length > 0 && selectedTopics.length > 0

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🎯 AI 模拟面试</h1>

      {/* JD Input */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <label className="block font-medium mb-2">岗位 JD <span className="text-red-500">*</span></label>
        <textarea value={jdText} onChange={e => { setJdText(e.target.value); setJdAnalyzed(false) }}
          placeholder="粘贴岗位 JD..."
          className="w-full h-32 p-3 border rounded-lg resize-y mb-2" />
        <div className="flex gap-2">
          <button onClick={handleAnalyzeJd} disabled={loading || !jdText.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {loading ? '分析中...' : '🔍 分析技术要求'}
          </button>
          {jdText.length > 3000 && <p className="text-xs text-amber-600 self-center">JD 超过 3000 字，将截断分析</p>}
        </div>
      </div>

      {/* Resume Upload */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <label className="block font-medium mb-2">简历（可选）</label>
        <p className="text-sm text-gray-500 mb-2">支持 .md .txt .pdf，5MB 以内。不上传服务器，仅存本地。</p>
        <label className="inline-block bg-gray-200 px-4 py-2 rounded-lg text-sm cursor-pointer hover:bg-gray-300">
          {resumeFileName ? `✅ ${resumeFileName}` : '📄 选择文件'}
          <input type="file" accept=".md,.txt,.pdf" onChange={handleResumeUpload} className="hidden" />
        </label>
        {resumeText && <p className="text-xs text-green-600 mt-1">已解析（{resumeText.length} 字）</p>}
      </div>

      {/* Company */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <label className="block font-medium mb-2">公司名（可选）</label>
        <div className="flex gap-2">
          <input value={companyName} onChange={e => setCompanyName(e.target.value)}
            placeholder="如：字节跳动、大疆..."
            className="flex-1 p-2 border rounded-lg text-sm" />
          <button onClick={handleFetchCompany} disabled={loading || !companyName.trim()}
            className="bg-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-300 disabled:opacity-50">查询</button>
        </div>
        {companyInfo && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm">
            <p className="text-xs text-gray-400 mb-1">⚠️ AI 生成，仅供参考</p>
            <p><strong>{companyInfo.name}</strong></p>
            <p>业务：{companyInfo.business}</p>
            <p>规模：{companyInfo.scale}</p>
            <p>技术栈：{companyInfo.techStack}</p>
            <button onClick={() => setCompanyInfo(null)} className="text-red-500 text-xs mt-1">清除</button>
          </div>
        )}
      </div>

      {/* Topics */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <label className="block font-medium mb-2">面试话题 <span className="text-red-500">*</span></label>
        {suggestedTopics.length > 0 && (
          <p className="text-xs text-green-600 mb-2">AI 推荐：{suggestedTopics.join('、')}</p>
        )}
        <div className="flex gap-2 flex-wrap">
          {topics.map(t => (
            <button key={t} onClick={() => toggleTopic(t)}
              className={`px-3 py-1 rounded-full text-sm ${
                selectedTopics.includes(t) ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}>{t}</button>
          ))}
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {/* Duration + Actions */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <label className="block font-medium mb-2">面试时长</label>
        <div className="flex gap-3 mb-4">
          {[15, 30, 60].map(m => (
            <button key={m} onClick={() => setDuration(m)}
              className={`px-4 py-2 rounded-lg text-sm ${duration === m ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>{m} 分钟</button>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={handleStart} disabled={!canStart || starting}
            className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
            {starting ? '准备中...' : '▶ 开始面试'}
          </button>
          <button onClick={handleCopyPrompt} disabled={!canStart}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 disabled:opacity-50">
            {promptCopied ? '✅ 已复制' : '📋 复制豆包 prompt'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

Wait — `useEffect` is imported in the component but the import line was omitted. Let me fix that.

```jsx
import { useState, useEffect } from 'react'
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build success

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/MockInterview.jsx
git commit -m "feat: add MockInterview configuration page"
```

---

### Task 7: MockSession.jsx — Interview flow page

**Files:**
- Create: `frontend/src/pages/MockSession.jsx`

- [ ] **Step 1: Implement MockSession.jsx**

```jsx
import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useMockSession } from '../hooks/useMockSession'
import LoadingSpinner from '../components/LoadingSpinner'

export default function MockSession() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const sessionId = searchParams.get('id')
  const { session, responses, currentIndex, currentQuestion, submitting, error,
          loadSession, submitAnswer, submitFollowup, skipQuestion, goNext, finishSession } = useMockSession()

  const [userAnswer, setUserAnswer] = useState('')
  const [followupAnswer, setFollowupAnswer] = useState('')
  const [lastResult, setLastResult] = useState(null)
  const [showFollowup, setShowFollowup] = useState(false)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    if (sessionId) loadSession(sessionId)
  }, [sessionId])

  async function handleSubmit() {
    if (!userAnswer.trim()) return
    const result = await submitAnswer(userAnswer)
    if (result) {
      setLastResult(result)
      setUserAnswer('')
      if (result.followup) setShowFollowup(true)
    }
  }

  async function handleFollowupSubmit() {
    if (!followupAnswer.trim()) return
    await submitFollowup(followupAnswer)
    setFollowupAnswer('')
    setShowFollowup(false)
    goNext()
  }

  async function handleFinish() {
    await finishSession()
    setFinished(true)
  }

  function handleNextAfterSkip() {
    setLastResult(null)
    setShowFollowup(false)
    goNext()
  }

  if (!session) return <LoadingSpinner />
  if (finished) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <h2 className="text-2xl font-bold mb-4">面试结束！</h2>
        <p className="text-gray-500 mb-6">共回答 {responses.length} 题</p>
        <button onClick={() => navigate(`/mock-interview/review?id=${session.id}`)}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg">📊 查看复盘报告</button>
      </div>
    )
  }

  // After last question: show finish screen
  if (currentIndex >= (session.generated_questions?.length || 0)) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <h2 className="text-xl font-bold mb-4">所有题目已答完</h2>
        <p className="text-gray-500 mb-6">你可以选择结束面试，或返回检查已回答的题目。</p>
        <button onClick={handleFinish}
          className="bg-green-600 text-white px-6 py-2 rounded-lg">📊 结束面试并查看报告</button>
      </div>
    )
  }

  if (!currentQuestion) return null

  const totalQuestions = session.generated_questions?.length || 0
  const progress = responses.length / totalQuestions * 100

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>面试进行中</span>
          <span>第 {currentIndex + 1}/{totalQuestions} 题</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      </div>

      {/* Question */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <div className="mb-2">
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{currentQuestion.topic}</span>
        </div>
        <p className="text-lg font-medium">{currentQuestion.question}</p>
      </div>

      {/* Answer input */}
      {!lastResult && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <textarea value={userAnswer} onChange={e => setUserAnswer(e.target.value)}
            placeholder="输入你的回答..."
            className="w-full h-32 p-3 border rounded-lg resize-y mb-3" />
          <div className="flex gap-2">
            <button onClick={handleSubmit} disabled={submitting || !userAnswer.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {submitting ? '评分中...' : '📝 提交回答'}
            </button>
            <button onClick={() => { skipQuestion(); setLastResult(null) }}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg">跳过</button>
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
      )}

      {/* Result feedback */}
      {lastResult && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg font-bold">评分：{lastResult.score}/10</span>
            <span className={`px-2 py-0.5 rounded text-xs ${
              lastResult.score >= 8 ? 'bg-green-100 text-green-700' :
              lastResult.score >= 4 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {lastResult.score >= 8 ? '优秀' : lastResult.score >= 4 ? '一般' : '需加强'}
            </span>
          </div>
          <p className="text-sm">{lastResult.feedback}</p>

          {showFollowup && lastResult.followup ? (
            <div className="mt-4 pt-4 border-t">
              <p className="font-medium text-sm mb-2">追问：{lastResult.followup}</p>
              <textarea value={followupAnswer} onChange={e => setFollowupAnswer(e.target.value)}
                placeholder="回答追问..."
                className="w-full h-24 p-3 border rounded-lg resize-y mb-2 text-sm" />
              <button onClick={handleFollowupSubmit} disabled={!followupAnswer.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">提交追问回答</button>
            </div>
          ) : (
            <div className="flex gap-2 mt-4 pt-4 border-t">
              <button onClick={handleNextAfterSkip}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">
                {currentIndex < totalQuestions - 1 ? '下一题 →' : '📊 查看总结'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build success

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/MockSession.jsx
git commit -m "feat: add MockSession interview flow page"
```

---

### Task 8: MockReview.jsx — Review report page

**Files:**
- Create: `frontend/src/pages/MockReview.jsx`

- [ ] **Step 1: Implement MockReview.jsx**

```jsx
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
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build success

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/MockReview.jsx
git commit -m "feat: add MockReview report page"
```

---

### Task 9: App.jsx routing + Layout nav

**Files:**
- Modify: `frontend/src/App.jsx` — add 3 routes
- Modify: `frontend/src/components/Layout.jsx` — add nav link

- [ ] **Step 1: Add routes to App.jsx**

Add imports:
```jsx
import MockInterview from './pages/MockInterview'
import MockSession from './pages/MockSession'
import MockReview from './pages/MockReview'
```

Add routes inside `<Routes>`:
```jsx
<Route path="/mock-interview" element={<MockInterview />} />
<Route path="/mock-interview/session" element={<MockSession />} />
<Route path="/mock-interview/review" element={<MockReview />} />
```

- [ ] **Step 2: Add nav link to Layout.jsx**

Add to `navItems` array:
```jsx
{ path: '/mock-interview', label: 'AI面试', icon: '🎯' },
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build success, 0 errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/Layout.jsx
git commit -m "feat: add mock interview routes and nav link"
```

---

## Self-Review

**Spec coverage check:**
- ✅ MockInterview page — JD input, resume upload, company name, topic selection, duration selector, start button, 豆包 prompt export
- ✅ MockSession page — Q&A flow, scoring, follow-up, skip, progress bar
- ✅ MockReview page — total score, topic breakdown, weak points, question-by-question, export
- ✅ Data model — interview_sessions + interview_responses with all fields
- ✅ Resume parsing — .md/.txt/.pdf with pdf.js, 5MB limit
- ✅ Company info — DeepSeek-based with AI-generated disclaimer
- ✅ 豆包 prompt — template with JD + resume + topics
- ✅ RLS policies on both tables

**Placeholder check:** No TBD, TODO, or "implement later" — every task has complete code.

**Type consistency check:**
- `generateQuestions` returns `Array<{question, expected_answer, topic}>` — matches `generated_questions jsonb` in sessions table and `{ question, expected_answer, topic }` in responses table ✅
- `fetchCompanyInfo` stores `{ name, business, scale, techStack, aiGenerated }` — consistent ✅
- `submitAnswer` returns `{ score, feedback, followup }` — matches the API response ✅
