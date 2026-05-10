# 面试刷题工具 MVP 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform interview quiz web app with subjective/MC dual modes, AI answer analysis, and cross-device progress sync.

**Architecture:** Pure frontend SPA (React 18 + Vite + Tailwind CSS 3) backed by Supabase (PostgreSQL + Auth). AI analysis via browser-to-DeepSeek direct API call. No backend server needed.

**Tech Stack:** React 18, Vite 5, Tailwind CSS 3, Supabase JS SDK, React Router 6, highlight.js, DeepSeek API

---

## 项目文件结构

```
/Users/xkkk/Documents/FIRST CC/
├── frontend/                    # React SPA
│   ├── src/
│   │   ├── App.jsx              # Router + Layout
│   │   ├── main.jsx             # Entry point
│   │   ├── index.css            # Tailwind imports
│   │   ├── lib/
│   │   │   ├── supabase.js      # Supabase client
│   │   │   └── deepseek.js      # DeepSeek API helper
│   │   ├── components/
│   │   │   ├── Layout.jsx       # Nav + sidebar
│   │   │   ├── LoadingSpinner.jsx
│   │   │   ├── ErrorBanner.jsx
│   │   │   └── ProgressBar.jsx
│   │   └── pages/
│   │       ├── Home.jsx
│   │       ├── Login.jsx
│   │       ├── Topics.jsx
│   │       ├── Practice.jsx
│   │       ├── Review.jsx
│   │       ├── Stats.jsx
│   │       ├── Search.jsx
│   │       └── Settings.jsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
├── scripts/
│   └── parse-docs.py            # 八股文文档解析脚本
├── supabase/
│   └── schema.sql               # 数据库建表 + RLS
└── docs/superpowers/
    ├── specs/2026-05-10-interview-quiz-tool-design.md
    └── plans/2026-05-10-interview-quiz-tool-plan.md (this file)
```

---

### Task 1: Supabase Schema (建表 + RLS)

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: Write full schema SQL**

```sql
-- 数据来源表
create table sources (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  source_type text not null default 'document',
  description text,
  created_at  timestamptz default now()
);

-- 题库表
create table questions (
  id              uuid primary key default gen_random_uuid(),
  source_id       uuid references sources(id),
  display_order   integer default 0,
  topic           text not null,
  subtopic        text,
  question        text not null,
  answer          text not null,
  choices         jsonb,
  correct_idx     smallint,
  difficulty      smallint default 3,
  tags            jsonb default '[]',
  code_blocks     jsonb default '[]',
  question_type   text default 'quiz',
  created_at      timestamptz default now()
);

create index idx_questions_topic on questions(topic);
create index idx_questions_source on questions(source_id);
create index idx_questions_tags on questions using gin(tags);

-- 用户进度表
create table user_progress (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) not null,
  question_id     uuid references questions(id) not null,
  status          text default 'new',
  attempt_count   integer default 0,
  last_answer     text,
  last_reviewed   timestamptz,
  next_review     timestamptz,
  session_type    text default 'quiz',
  unique(user_id, question_id, session_type)
);

create index idx_user_progress_user on user_progress(user_id);
create index idx_user_progress_review on user_progress(next_review);

-- RLS
alter table questions enable row level security;
alter table sources enable row level security;
alter table user_progress enable row level security;

create policy "Questions are publicly readable"
  on questions for select using (true);

create policy "Sources are publicly readable"
  on sources for select using (true);

create policy "Users can read own progress"
  on user_progress for select using (auth.uid() = user_id);

create policy "Users can insert own progress"
  on user_progress for insert with check (auth.uid() = user_id);

create policy "Users can update own progress"
  on user_progress for update using (auth.uid() = user_id);
```

- [ ] **Step 2: Execute in Supabase Dashboard**
  - Open Supabase Dashboard → SQL Editor
  - Paste and execute `supabase/schema.sql`

---

### Task 2: Parse Documents (八股文解析脚本)

**Files:**
- Create: `scripts/parse-docs.py`

- [ ] **Step 1: Write the parser script**

```python
#!/usr/bin/env python3
"""Parse three 八股文 MD files into JSON for Supabase import."""
import json, re, sys
from pathlib import Path

DOCS_DIR = Path("/Users/xkkk/Documents/FIRST CC")
OUTPUT = DOCS_DIR / "scripts" / "questions.json"

# Map filenames to source names
SOURCES = {
    "八股（上）（C、C++、STL与容器、操作系统）.md": "八股文（上）",
    "八股（中）（计算机网络、STM32、FreeRTOS、通讯协议).md": "八股文（中）",
    "八股（下）（Linux应用、驱动、Bootloader、Rootfs）.md": "八股文（下）",
}

def parse_doc(path, source_name):
    questions = []
    with open(path, "r") as f:
        lines = f.readlines()

    current_topic = ""
    current_q = None
    in_code = False
    code_blocks = []
    answer_lines = []
    display_order = 0

    for line in lines:
        stripped = line.strip()
        # Skip title line
        if stripped.startswith("<title>"):
            continue
        # Code block toggle
        if stripped.startswith("```"):
            in_code = not in_code
            if in_code:
                code_blocks.append("")
            continue
        if in_code:
            code_blocks[-1] += line
            continue

        # Skip images and separators
        if "![](" in stripped or stripped == "---":
            continue

        # Topic header (#)
        if stripped.startswith("# ") and "持续更新" not in stripped:
            current_topic = stripped.lstrip("# ").strip()
            continue

        # Question header (##)
        if stripped.startswith("## "):
            # Flush previous question
            if current_q:
                current_q["answer"] = "".join(answer_lines).strip()
                current_q["code_blocks"] = [b for b in code_blocks if b.strip()]
                questions.append(current_q)
            # Start new question
            answer_lines = []
            code_blocks = []
            question_text = stripped.lstrip("## ").strip()
            # Remove bold markers from question text
            question_text = re.sub(r"\*\*(.*?)\*\*", r"\1", question_text)
            current_q = {
                "source": source_name,
                "topic": current_topic,
                "subtopic": question_text,
                "display_order": display_order,
                "question": question_text + "?",
                "answer": "",
                "code_blocks": [],
                "difficulty": 3,
                "tags": [],
                "choices": None,
                "correct_idx": None,
            }
            display_order += 1
            continue

        # Answer content
        if current_q:
            answer_lines.append(line)

    # Flush last question
    if current_q:
        current_q["answer"] = "".join(answer_lines).strip()
        current_q["code_blocks"] = [b for b in code_blocks if b.strip()]
        questions.append(current_q)

    return questions

all_questions = []
for filename, source_name in SOURCES.items():
    path = DOCS_DIR / filename
    if path.exists():
        qs = parse_doc(path, source_name)
        all_questions.extend(qs)
        print(f"{filename}: {len(qs)} questions parsed")
    else:
        print(f"WARNING: {filename} not found")

with open(OUTPUT, "w") as f:
    json.dump(all_questions, f, ensure_ascii=False, indent=2)

print(f"\nTotal: {len(all_questions)} questions → {OUTPUT}")
```

- [ ] **Step 2: Run the parser and verify output**

```bash
cd "/Users/xkkk/Documents/FIRST CC"
python3 scripts/parse-docs.py
```

Expected output:
```
八股（上）（C、C++、STL与容器、操作系统）.md: ~450 questions parsed
八股（中）（计算机网络、STM32、FreeRTOS、通讯协议).md: ~150 questions parsed
八股（下）（Linux应用、驱动、Bootloader、Rootfs）.md: ~100 questions parsed
Total: ~700 questions → scripts/questions.json
```

- [ ] **Step 3: Import questions to Supabase**

  Open Supabase Dashboard → SQL Editor → run:
  ```sql
  -- First create the source records
  insert into sources (name, source_type) values
    ('八股文（上）', 'document'),
    ('八股文（中）', 'document'),
    ('八股文（下）', 'document');
  ```

  Then import through Supabase Dashboard → Table Editor → Import → select `scripts/questions.json`. Or write a quick import script.

---

### Task 3: Scaffold React Project

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/index.css`

- [ ] **Step 1: Create project with Vite**

```bash
cd "/Users/xkkk/Documents/FIRST CC"
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install @supabase/supabase-js react-router-dom@6
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 2: Configure Tailwind**

Edit `frontend/tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

Edit `frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 3: Setup entry point**

Edit `frontend/src/main.jsx`:
```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

---

### Task 4: Supabase Client + DeepSeek Helper

**Files:**
- Create: `frontend/src/lib/supabase.js`
- Create: `frontend/src/lib/deepseek.js`

- [ ] **Step 1: Create Supabase client**

`frontend/src/lib/supabase.js`:
```js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 2: Create DeepSeek API helper**

`frontend/src/lib/deepseek.js`:
```js
const DEEPSEEK_BASE = 'https://api.deepseek.com/v1'

export async function analyzeAnswer(question, referenceAnswer, userAnswer, apiKey) {
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `你是面试官。分析面试者对技术问题的回答质量。
返回 JSON 格式（不要 markdown 包裹）：
{
  "score": 1-10,
  "feedback": "总体评价",
  "strengths": ["优点1", "优点2"],
  "weaknesses": ["不足1", "不足2"],
  "reference_compared": "与参考答案的对比分析"
}`,
        },
        {
          role: 'user',
          content: `问题：${question}\n参考答案：${referenceAnswer}\n面试者答案：${userAnswer}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    }),
  })

  if (!res.ok) throw new Error(`DeepSeek API error: ${res.status}`)
  const data = await res.json()
  return JSON.parse(data.choices[0].message.content)
}
```

---

### Task 5: App Layout + Routing

**Files:**
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/components/Layout.jsx`
- Create: `frontend/src/components/LoadingSpinner.jsx`
- Create: `frontend/src/components/ErrorBanner.jsx`
- Create: `frontend/src/components/ProgressBar.jsx`

- [ ] **Step 1: Create shared components**

`frontend/src/components/LoadingSpinner.jsx`:
```jsx
export default function LoadingSpinner({ text = '加载中...' }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      <span className="ml-3 text-gray-600">{text}</span>
    </div>
  )
}
```

`frontend/src/components/ErrorBanner.jsx`:
```jsx
export default function ErrorBanner({ message, onRetry }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
      <p className="text-red-700">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-sm text-red-600 underline">
          重试
        </button>
      )}
    </div>
  )
}
```

`frontend/src/components/ProgressBar.jsx`:
```jsx
export default function ProgressBar({ value, max, label }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="w-full">
      {label && <div className="text-sm text-gray-600 mb-1">{label}</div>}
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-blue-500 h-2.5 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create Layout with Nav**

`frontend/src/components/Layout.jsx`:
```jsx
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useState, useEffect } from 'react'

const navItems = [
  { path: '/', label: '首页', icon: '🏠' },
  { path: '/topics', label: '选题', icon: '📚' },
  { path: '/review', label: '错题本', icon: '📝' },
  { path: '/stats', label: '统计', icon: '📊' },
  { path: '/search', label: '搜索', icon: '🔍' },
  { path: '/settings', label: '设置', icon: '⚙️' },
]

export default function Layout({ children }) {
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-blue-600">八股刷题</Link>
          <div className="flex gap-4 text-sm">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-2 py-1 rounded ${
                  location.pathname === item.path
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-blue-600'
                }`}
              >
                {item.icon} {item.label}
              </Link>
            ))}
            {user ? (
              <button onClick={() => supabase.auth.signOut()} className="text-gray-500 hover:text-red-500">
                退出
              </button>
            ) : (
              <Link to="/login" className="text-blue-600">登录</Link>
            )}
          </div>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Wire up App.jsx with Router**

`frontend/src/App.jsx`:
```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import Topics from './pages/Topics'
import Practice from './pages/Practice'
import Review from './pages/Review'
import Stats from './pages/Stats'
import Search from './pages/Search'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/topics" element={<Topics />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/review" element={<Review />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/search" element={<Search />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
```

---

### Task 6: Auth Pages (Login / Signup)

**Files:**
- Create: `frontend/src/pages/Login.jsx`

- [ ] **Step 1: Create Login page with signup support**

`frontend/src/pages/Login.jsx`:
```jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignup, setIsSignup] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const fn = isSignup ? supabase.auth.signUp : supabase.auth.signInWithPassword
    const { error: err } = await fn({ email, password })
    if (err) setError(err.message)
    else navigate('/')
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <h1 className="text-2xl font-bold text-center mb-6">
        {isSignup ? '注册' : '登录'}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email" placeholder="邮箱" required
          value={email} onChange={e => setEmail(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg"
        />
        <input
          type="password" placeholder="密码" required
          value={password} onChange={e => setPassword(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
          {isSignup ? '注册' : '登录'}
        </button>
      </form>
      <p className="text-center mt-4 text-sm text-gray-600">
        {isSignup ? '已有账号？' : '没有账号？'}
        <button onClick={() => setIsSignup(!isSignup)} className="text-blue-600 ml-1">
          {isSignup ? '去登录' : '去注册'}
        </button>
      </p>
    </div>
  )
}
```

---

### Task 7: Home Page

**Files:**
- Create: `frontend/src/pages/Home.jsx`

- [ ] **Step 1: Create Home page**

`frontend/src/pages/Home.jsx`:
```jsx
import { Link } from 'react-router-dom'

const modes = [
  { path: '/topics', title: '专题练习', desc: '按话题选择，系统学习', color: 'bg-blue-500' },
  { path: '/review', title: '错题本', desc: '复习答错的题目', color: 'bg-orange-500' },
  { path: '/search', title: '搜索题库', desc: '关键词搜题', color: 'bg-green-500' },
  { path: '/stats', title: '学习统计', desc: '查看学习进度', color: 'bg-purple-500' },
]

export default function Home() {
  return (
    <div>
      <div className="text-center py-8">
        <h1 className="text-3xl font-bold text-gray-800">八股文面试刷题</h1>
        <p className="text-gray-500 mt-2">C/C++ | 操作系统 | 计算机网络 | 嵌入式 | FreeRTOS | Linux</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        {modes.map(m => (
          <Link key={m.path} to={m.path}
            className={`${m.color} text-white rounded-xl p-6 hover:opacity-90 transition`}>
            <h2 className="text-xl font-bold">{m.title}</h2>
            <p className="mt-1 text-white/80">{m.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

---

### Task 8: Topics Selection Page

**Files:**
- Create: `frontend/src/pages/Topics.jsx`

- [ ] **Step 1: Create Topics page**

`frontend/src/pages/Topics.jsx`:
```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'
import ProgressBar from '../components/ProgressBar'

export default function Topics() {
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState({})
  const navigate = useNavigate()

  useEffect(() => {
    supabase
      .from('questions')
      .select('topic, id')
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); return }
        const map = {}
        data.forEach(q => {
          if (!map[q.topic]) map[q.topic] = { name: q.topic, total: 0 }
          map[q.topic].total += 1
        })
        setTopics(Object.values(map).sort((a, b) => b.total - a.total))
        setLoading(false)
      })
  }, [])

  function toggle(topicName) {
    setSelected(prev => ({ ...prev, [topicName]: !prev[topicName] }))
  }

  function startPractice() {
    const chosen = Object.entries(selected).filter(([, v]) => v).map(([k]) => k)
    if (chosen.length === 0) return
    navigate('/practice?topics=' + encodeURIComponent(chosen.join(',')))
  }

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBanner message={error} onRetry={() => window.location.reload()} />

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">选择话题</h1>
      <div className="space-y-2">
        {topics.map(t => (
          <label key={t.name}
            className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${
              selected[t.name] ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
            }`}>
            <input type="checkbox" checked={!!selected[t.name]} onChange={() => toggle(t.name)}
              className="mr-3 h-5 w-5" />
            <div className="flex-1">
              <span className="font-medium">{t.name}</span>
              <span className="text-gray-500 text-sm ml-2">({t.total} 题)</span>
            </div>
          </label>
        ))}
      </div>
      {Object.values(selected).some(Boolean) && (
        <button onClick={startPractice}
          className="mt-6 w-full bg-blue-600 text-white py-3 rounded-lg text-lg font-bold hover:bg-blue-700">
          开始练习 ({Object.values(selected).filter(Boolean).length} 个话题)
        </button>
      )}
    </div>
  )
}
```

---

### Task 9: Practice Page (Core Quiz)

**Files:**
- Create: `frontend/src/pages/Practice.jsx`

- [ ] **Step 1: Create Practice page**

`frontend/src/pages/Practice.jsx`:
```jsx
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { analyzeAnswer } from '../lib/deepseek'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'

export default function Practice() {
  const [searchParams] = useSearchParams()
  const [questions, setQuestions] = useState([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('subjective') // 'subjective' | 'choice'
  const [userAnswer, setUserAnswer] = useState('')
  const [selectedChoice, setSelectedChoice] = useState(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [user, setUser] = useState(null)

  const topics = searchParams.get('topics')?.split(',') || []

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null))
  }, [])

  useEffect(() => {
    if (topics.length === 0) return
    supabase
      .from('questions')
      .select('*')
      .in('topic', topics)
      .order('display_order')
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); return }
        setQuestions(data)
        setLoading(false)
      })
  }, [topics.join(',')])

  const question = questions[index]

  async function handleAiAnalysis() {
    if (!userAnswer.trim()) return
    setAiLoading(true)
    setAiError(null)
    const apiKey = localStorage.getItem('deepseek_api_key')
    if (!apiKey) { setAiError('请先在设置中填入 DeepSeek API Key'); setAiLoading(false); return }
    try {
      const result = await analyzeAnswer(question.question, question.answer, userAnswer, apiKey)
      setAiResult(result)
    } catch (e) {
      setAiError('AI 分析失败：' + e.message)
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSelfEval(status) {
    if (!user) return
    const { data: existing } = await supabase
      .from('user_progress')
      .select('id, attempt_count')
      .eq('user_id', user.id)
      .eq('question_id', question.id)
      .eq('session_type', 'quiz')
      .single()

    if (existing) {
      await supabase.from('user_progress').update({
        status, attempt_count: existing.attempt_count + 1,
        last_answer: userAnswer, last_reviewed: new Date().toISOString()
      }).eq('id', existing.id)
    } else {
      await supabase.from('user_progress').insert({
        user_id: user.id, question_id: question.id, status,
        attempt_count: 1, last_answer: userAnswer, session_type: 'quiz'
      })
    }
    goNext()
  }

  function goNext() {
    if (index < questions.length - 1) setIndex(i => i + 1)
    resetState()
  }

  function goPrev() {
    if (index > 0) setIndex(i => i - 1)
    resetState()
  }

  function resetState() {
    setUserAnswer('')
    setSelectedChoice(null)
    setShowAnswer(false)
    setAiResult(null)
    setAiError(null)
  }

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBanner message={error} onRetry={() => window.location.reload()} />
  if (questions.length === 0) return (
    <div className="text-center py-12 text-gray-500">请先选择话题</div>
  )

  const hasChoices = question.choices && question.choices.length > 0

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-gray-500">
          {question.topic} {question.subtopic && `> ${question.subtopic}`}
        </span>
        <span className="text-sm text-gray-500">第 {index + 1}/{questions.length} 题</span>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setMode('subjective')}
          className={`px-3 py-1 rounded text-sm ${mode === 'subjective' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
          主观模式
        </button>
        {hasChoices && (
          <button onClick={() => setMode('choice')}
            className={`px-3 py-1 rounded text-sm ${mode === 'choice' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
            选择题模式
          </button>
        )}
      </div>

      {/* Question */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h2 className="text-lg font-medium mb-4">{question.question}</h2>

        {/* Code blocks */}
        {question.code_blocks?.map((code, i) => (
          <pre key={i} className="bg-gray-900 text-gray-100 rounded-lg p-4 mb-4 overflow-x-auto text-sm">
            <code>{code}</code>
          </pre>
        ))}
      </div>

      {/* Subjective Mode */}
      {mode === 'subjective' && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <textarea value={userAnswer} onChange={e => setUserAnswer(e.target.value)}
            placeholder="输入你的答案..."
            className="w-full h-32 p-3 border rounded-lg resize-y mb-3"
          />
          <div className="flex gap-2">
            <button onClick={handleAiAnalysis} disabled={aiLoading || !userAnswer.trim()}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
              {aiLoading ? '分析中...' : '🧠 AI 分析'}
            </button>
            <button onClick={() => setShowAnswer(!showAnswer)}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300">
              {showAnswer ? '隐藏答案' : '📖 显示参考答案'}
            </button>
          </div>

          {aiError && <p className="text-red-500 mt-2 text-sm">{aiError}</p>}

          {aiResult && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <p className="text-lg font-bold">评分：{aiResult.score}/10</p>
              <p className="mt-2">{aiResult.feedback}</p>
              {aiResult.strengths?.length > 0 && (
                <div className="mt-2"><strong>优点：</strong>
                  <ul className="list-disc ml-5">{aiResult.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              {aiResult.weaknesses?.length > 0 && (
                <div className="mt-2"><strong>不足：</strong>
                  <ul className="list-disc ml-5 text-orange-700">{aiResult.weaknesses.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </div>
              )}
            </div>
          )}

          {showAnswer && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <strong>参考答案：</strong>
              <div className="mt-1 whitespace-pre-wrap">{question.answer}</div>
            </div>
          )}

          {user && (
            <div className="flex gap-2 mt-4">
              <button onClick={() => handleSelfEval('correct')} className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600">✅ 答对了</button>
              <button onClick={() => handleSelfEval('wrong')} className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600">❌ 答错了</button>
              <button onClick={() => handleSelfEval('skipped')} className="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500">🤷 跳过</button>
            </div>
          )}
        </div>
      )}

      {/* Choice Mode */}
      {mode === 'choice' && hasChoices && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <div className="space-y-2">
            {question.choices.map((c, i) => (
              <label key={i} className={`block p-3 border rounded-lg cursor-pointer ${
                selectedChoice === i ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
              }`}>
                <input type="radio" name="choice" checked={selectedChoice === i}
                  onChange={() => setSelectedChoice(i)} className="mr-2" />
                {c}
              </label>
            ))}
          </div>
          {selectedChoice !== null && (
            <div className={`mt-4 p-3 rounded-lg ${
              selectedChoice === question.correct_idx ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {selectedChoice === question.correct_idx ? '✅ 回答正确！' : `❌ 正确答案是：${question.choices[question.correct_idx]}`}
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button onClick={() => { setShowAnswer(true) }} className="bg-gray-200 px-4 py-2 rounded-lg">📖 查看解析</button>
          </div>
          {showAnswer && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <strong>解析：</strong>
              <div className="mt-1 whitespace-pre-wrap">{question.answer}</div>
            </div>
          )}
          {user && selectedChoice !== null && (
            <div className="flex gap-2 mt-4">
              <button onClick={() => handleSelfEval(selectedChoice === question.correct_idx ? 'correct' : 'wrong')}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg">下一题</button>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={goPrev} disabled={index === 0}
          className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-300">
          ← 上一题
        </button>
        <button onClick={goNext} disabled={index >= questions.length - 1}
          className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-300">
          下一题 →
        </button>
      </div>
    </div>
  )
}
```

---

### Task 10: Review Page (错题本)

**Files:**
- Create: `frontend/src/pages/Review.jsx`

- [ ] **Step 1: Create Review page**

`frontend/src/pages/Review.jsx`:
```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorBanner from '../components/ErrorBanner'

export default function Review() {
  const [wrongAnswers, setWrongAnswers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) { navigate('/login'); return }
      supabase.from('user_progress')
        .select('*, questions(*)')
        .eq('user_id', data.user.id)
        .eq('status', 'wrong')
        .eq('session_type', 'quiz')
        .then(({ data: rows, error: err }) => {
          if (err) { setError(err.message); return }
          setWrongAnswers(rows)
          setLoading(false)
        })
    })
  }, [])

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBanner message={error} onRetry={() => window.location.reload()} />

  const filtered = filter
    ? wrongAnswers.filter(w => w.questions?.topic === filter)
    : wrongAnswers

  const topics = [...new Set(wrongAnswers.map(w => w.questions?.topic).filter(Boolean))]

  if (wrongAnswers.length === 0) return (
    <div className="text-center py-12">
      <p className="text-gray-500 text-lg">暂无错题，继续加油！</p>
    </div>
  )

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">错题本（{wrongAnswers.length} 题）</h1>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilter('')}
          className={`px-3 py-1 rounded text-sm ${!filter ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>全部</button>
        {topics.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1 rounded text-sm ${filter === t ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>{t}</button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(w => (
          <div key={w.id} className="bg-white rounded-lg p-4 border hover:shadow-sm">
            <p className="font-medium">{w.questions?.question}</p>
            <p className="text-sm text-gray-500 mt-1">
              {w.questions?.topic} · 答错 {w.attempt_count} 次 · 上次 {new Date(w.last_reviewed).toLocaleDateString()}
            </p>
            <button onClick={() => navigate(`/practice?topics=${encodeURIComponent(w.questions?.topic)}`)}
              className="text-blue-600 text-sm mt-2">再练一次 →</button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

### Task 11: Stats Page

**Files:**
- Create: `frontend/src/pages/Stats.jsx`

- [ ] **Step 1: Create Stats page**

`frontend/src/pages/Stats.jsx`:
```jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Stats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) { setLoading(false); return }
      Promise.all([
        supabase.from('user_progress').select('*', { count: 'exact' }).eq('user_id', data.user.id).eq('session_type', 'quiz'),
        supabase.from('questions').select('topic', { count: 'exact', head: true }),
      ]).then(([progress, _]) => {
        const rows = progress.data || []
        const total = rows.length
        const correct = rows.filter(r => r.status === 'correct').length
        const wrong = rows.filter(r => r.status === 'wrong').length
        setStats({
          totalAnswered: total,
          correct,
          wrong,
          skipped: rows.filter(r => r.status === 'skipped').length,
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
```

---

### Task 12: Search Page

**Files:**
- Create: `frontend/src/pages/Search.jsx`

- [ ] **Step 1: Create Search page**

`frontend/src/pages/Search.jsx`:
```jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    const { data } = await supabase
      .from('questions')
      .select('question, topic, subtopic')
      .or(`question.ilike.%${query}%,answer.ilike.%${query}%`)
      .limit(20)
    setResults(data || [])
    setLoading(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">搜索题库</h1>
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="输入关键词搜索..."
          className="flex-1 px-4 py-2 border rounded-lg" />
        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
          搜索
        </button>
      </form>

      {loading && <LoadingSpinner />}

      {results.length === 0 && query && !loading && (
        <p className="text-gray-500 text-center py-8">未找到相关题目</p>
      )}

      <div className="space-y-3">
        {results.map((q, i) => (
          <div key={i} className="bg-white rounded-lg p-4 border">
            <p className="font-medium">{q.question}</p>
            <p className="text-sm text-gray-500 mt-1">{q.topic}{q.subtopic ? ` > ${q.subtopic}` : ''}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

### Task 13: Settings Page

**Files:**
- Create: `frontend/src/pages/Settings.jsx`

- [ ] **Step 1: Create Settings page**

`frontend/src/pages/Settings.jsx`:
```jsx
import { useState } from 'react'

export default function Settings() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('deepseek_api_key') || '')
  const [saved, setSaved] = useState(false)

  function handleSave() {
    localStorage.setItem('deepseek_api_key', apiKey)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleClear() {
    localStorage.removeItem('deepseek_api_key')
    setApiKey('')
    setSaved(true)
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">设置</h1>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <label className="block font-medium mb-2">DeepSeek API Key</label>
        <input value={apiKey} onChange={e => setApiKey(e.target.value)}
          type="password" placeholder="sk-..."
          className="w-full px-4 py-2 border rounded-lg mb-3" />
        <p className="text-sm text-gray-500 mb-4">
          API Key 仅存在你的浏览器中，不会上传到任何服务器。
          可在 <a href="https://platform.deepseek.com/api_keys" target="_blank"
            className="text-blue-600">platform.deepseek.com</a> 获取
        </p>
        <div className="flex gap-2">
          <button onClick={handleSave} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
            保存
          </button>
          <button onClick={handleClear} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300">
            清除
          </button>
        </div>
        {saved && <p className="text-green-600 mt-2 text-sm">已保存</p>}
      </div>
    </div>
  )
}
```

---

### Task 14: Environment Config & Deployment

**Files:**
- Modify: `frontend/.env.example`
- Create: `frontend/.env`

- [ ] **Step 1: Setup environment variables**

`frontend/.env.example`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

`frontend/.env` (user fills from Supabase Dashboard):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

- [ ] **Step 2: Test locally**

```bash
cd frontend
npm run dev
```

Expected: App running at `http://localhost:5173`

- [ ] **Step 3: Build for production**

```bash
npm run build
```

Expected: `dist/` folder with static files.

- [ ] **Step 4: Deploy to GitHub Pages (or Vercel)**

For GitHub Pages:
```bash
# In repo settings, enable GitHub Pages from gh-pages branch
npm install --save-dev gh-pages
# Add "deploy": "gh-pages -d dist" to package.json scripts
npm run deploy
```

For Vercel:
```bash
# Install Vercel CLI
npx vercel --prod
# Or connect GitHub repo to Vercel dashboard
```

---

## Self-Review Checklist

- **Spec coverage:**
  - [x] Data model (sources, questions, user_progress tables) → Task 1
  - [x] RLS + Auth → Task 1 (RLS policies) + Task 6 (login page)
  - [x] Data ingestion from 3 MD docs → Task 2 (parse-docs.py)
  - [x] Topic selection → Task 8
  - [x] Practice page with dual modes → Task 9
  - [x] AI analysis (DeepSeek direct call) → Task 9 (handleAiAnalysis) + Task 4 (deepseek.js)
  - [x] Review page → Task 10
  - [x] Stats page → Task 11
  - [x] Search page → Task 12
  - [x] Settings page → Task 13
  - [x] Loading/error/empty states → Included in each page
  - [x] Home page → Task 7
  - [x] Deployment → Task 14

- **Placeholder check:** No TBD, TODO, or incomplete sections. All code is real and complete.

- **Type consistency:** All component names, file paths, and imports match across tasks. No naming conflicts.
