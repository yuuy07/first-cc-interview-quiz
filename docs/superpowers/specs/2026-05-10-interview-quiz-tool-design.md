---
title: "面试刷题工具 - 设计文档"
date: 2026-05-10
status: draft
---

# 面试刷题工具 — 设计文档

## 1. 概述

基于三个飞书提取的八股文文档（C/C++/STL/OS、网络/STM32/FreeRTOS、Linux 嵌入式），构建一个跨平台的交互式面试刷题工具。支持主观题与选择题双模式、AI 答案分析、跨设备进度同步，并预留模拟面试、面经导入、JD 预演等扩展能力。

## 2. 技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| 前端框架 | React 18 + Vite | 组件化、生态最大、AI 编写质量最高；v18 教程最多更稳定 |
| CSS | Tailwind CSS 3 | 响应式、不手写 CSS；v3 有大量中文教程和 AI 训练数据 |
| 后端/BaaS | Supabase (Free Tier) | 数据库 + Auth + SDK，零运维 |
| AI 接口 | 前端直接调 DeepSeek API | 无超时限制、无中间服务、最简架构 |
| 前端托管 | GitHub Pages 或 Vercel | 纯静态无需服务器 |
| 版本控制 | Git + GitHub | 单人开发，免费私有仓库 |

架构要点：
- **无后端服务器**：前端直连 Supabase SDK 读写数据库，直连 DeepSeek API 做 AI 分析
- **无超时问题**：浏览器调 LLM API 没有 10 秒限制，等多久都行
- **API Key 安全**：存浏览器 localStorage，仅个人使用风险可控
- **CORS**：DeepSeek API 支持跨域请求，已验证通过

## 3. 数据模型

### 3.1 核心表

#### `sources` — 数据来源（支持扩展）

```sql
create table sources (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,            -- e.g. "八股文（上）"
  source_type text not null,            -- 'document' | 'resume' | 'experience' | 'jd'
  description text,
  created_at  timestamptz default now()
);
```

#### `questions` — 题库

```sql
create table questions (
  id              uuid primary key default gen_random_uuid(),
  source_id       uuid references sources(id),
  display_order   integer default 0,    -- 文档原始顺序，用于prev/next导航
  topic           text not null,        -- 一级话题: "C语言", "操作系统"
  subtopic        text,                 -- 二级话题: "内存分布模型"
  question        text not null,        -- 问题正文
  answer          text not null,        -- 参考答案
  choices         jsonb,                -- 选择题选项: ["A. ...", "B. ...", ...]
  correct_idx     smallint,             -- 选择题正确答案索引（NULL=无选择题模式）
  difficulty      smallint default 3,   -- 1-5
  tags            jsonb default '[]',   -- 灵活标签 ["指针", "内存", "面试高频"]
  code_blocks     jsonb default '[]',  -- 示例代码数组（多个代码块），用 highlight.js 渲染
  question_type   text default 'quiz',  -- 'quiz' | 'interview' | 'experience'
  created_at      timestamptz default now()
);

create index idx_questions_topic on questions(topic);
create index idx_questions_source on questions(source_id);
create index idx_questions_tags on questions using gin(tags);
```

注意：
- `display_order` 决定题目在刷题时的先后顺序（按文档原有顺序）
- `choices` 和 `correct_idx` 为空时该题只有主观模式，禁用选择题切换
- `question_type` 与 `sources.source_type` 独立命名，避免混淆。二者值域无隐含关联
- `code_blocks` 为字符串数组，支持多段独立代码片段
- MVP 阶段直接在 Supabase Dashboard 的 SQL Editor 中执行 CREATE TABLE，不引入迁移工具

#### `user_progress` — 用户做题进度

```sql
create table user_progress (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) not null,
  question_id     uuid references questions(id) not null,
  status          text default 'new',   -- 'new' | 'seen' | 'correct' | 'wrong' | 'skipped'
  attempt_count   integer default 0,
  last_answer     text,                 -- 用户最近一次主观答案
  last_reviewed   timestamptz,
  next_review     timestamptz,          -- 复习曲线调度
  session_type    text default 'quiz',  -- 'quiz' | 'mock_interview'
  unique(user_id, question_id, session_type)
);

create index idx_user_progress_user on user_progress(user_id);
create index idx_user_progress_review on user_progress(next_review);
```

注意：
- `unique(user_id, question_id, session_type)` 约束表示每道题每个模式一条记录
- `status` 始终反映**最近一次**作答结果；`attempt_count` 递增记录重答次数

#### `mock_sessions` — 模拟面试会话（Phase 2 扩展预留）

```sql
create table mock_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) not null,
  session_type  text not null,          -- 'resume' | 'jd' | 'general'
  context       jsonb,                  -- 导入的 JD/简历原文
  status        text default 'in_progress',
  started_at    timestamptz default now(),
  ended_at      timestamptz
);
```

### 3.2 Row Level Security & Auth 流程

Supabase RLS 策略：
- `questions` / `sources` 公开只读（未登录也可浏览题库）
- `user_progress` / `mock_sessions` 仅本人可读写（`user_id = auth.uid()`）
- 写操作需登录

Auth 流程：
- **登录方式**：Supabase email + password（MVP 阶段）
- **路由保护**：未登录用户可访问 `/`（首页）和 `/topics`（浏览题库），访问 `/practice`、`/review`、`/stats` 时重定向到 `/login`
- **注册**：使用 Supabase Auth UI 组件或简单自定义表单（`/signup` 路由）
- **MVP 阶段不实现**：邮箱验证、密码重置（后续按需添加）

### 3.3 数据导入（题库入库）

三个八股文 MD 文档 → `questions` 表，通过一次性 Python 脚本完成：

```
文档结构：
  # C语言                          → topic = "C语言"
  ## 全局变量和局部变量的区别          → subtopic, question
  正文...                           → answer
  ### 定义位置不同 → 这是正文一部分
  ---                               → 分隔符
  ### **内存分布模型**                → 下一个 subtopic
  ![](图片链接)                      → 忽略（图片无法内联）

脚本逻辑：
  display_order = 0（逐题递增）
  逐行扫描 MD 文件：
    遇到 "# 话题名"        → 设置当前 topic
    遇到 "## 问题标题"     → 新题的起点，subtopic = 标题
      开始累积 answer；display_order += 1
    遇到 ```               → 切换"在代码块内"标记
      代码行追加到 code_blocks 数组，不混入 answer
    遇到 ![]()             → 跳过（图片无法嵌入）
    遇到 "---"             → 跳过
    遇到 "## 下一个话题"   → 当前题结束，flush 到输出
    遇到文件结尾           → flush 最后一题

  输出 JSON 格式示例：
  {
    "source": "八股文（上）",
    "topic": "C语言",
    "subtopic": "全局变量和局部变量的区别",
    "display_order": 0,
    "question": "全局变量和局部变量的区别是什么？",
    "answer": "### 定义位置不同\n1. 全局变量...\n2. 局部变量...",
    "code_blocks": ["int g;\nvoid f() { int l; }"],
    "difficulty": 3,
    "tags": [],
    "choices": null,
    "correct_idx": null
  }

  入库：Python 脚本 → questions.json → Supabase Dashboard SQL Editor 执行 INSERT
  
  注意：
  - 话题名不做归一化，前端聚合时自动合并同一话题
  - 三个文档结构一致（问答格式），同一脚本可处理全部
  - 选择题选项和难度默认留空，后续用脚本或手动添加
```

一次入库后，如需新增文档只需执行同一脚本处理新文件，加一条 `sources` 记录。

## 4. 页面结构

```
/              → 首页（模式选择 + 统计概览）
/practice      → 答题页（主观/选择题切换）
/topics        → 话题选择（自由勾选 + 掌握度显示）
/review        → 错题本（按话题筛选 + 复习模式）
/stats         → 统计面板（正确率/薄弱话题/打卡）
/search        → 搜索（关键词搜题库）
/settings      → 个人设置 + DeepSeek API Key 配置
/login         → 登录/注册
```

### 4.1 话题选择页面（/topics）

```
话题树结构（来源于文档解析，最多两级）：
  C语言 (45题)  ████████░░ 70%
    ├── 内存与指针 (12题)  ████████░░ 75%
    ├── 关键字与预处理 (8题) ██████░░░░ 60%
    └── 数组与字符串 (7题)  █████████░ 85%
  C++ (80题)    ██████░░░░ 50%
  ...
```

每个话题旁显示掌握度进度条。用户勾选话题 → 点击"开始练习" → 按 `display_order` 顺序进入答题。

### 4.2 答题页面（/practice）

```
┌──────────────────────────────────────────┐
│  话题: C语言 > 内存分布模型    第 3/15 题   │
├──────────────────────────────────────────┤
│                                          │
│  全局变量和局部变量的区别是什么？             │
│                                          │
│  ┌─ 模式切换 ──────────────────────┐     │
│  │  [📝 主观模式] [🔘 选择题模式]  │     │
│  └─────────────────────────────────┘     │
│                                          │
│  主观模式：                                │
│  ┌──────────────────────────────────┐    │
│  │ 在这里输入你的答案...              │    │
│  └──────────────────────────────────┘    │
│  [🧠 AI 分析] → 评分 + 反馈               │
│  [📖 显示参考答案]                        │
│                                          │
│  自评：[✅ 对了] [❌ 错了] [🤷 跳过]      │
│                                          │
│  选择题模式（仅当 choices 非空时可用）：     │
│  ○ A. 全局变量在栈上，局部变量在堆上        │
│  ○ B. 全局变量在静态区，局部变量在栈上      │
│  ○ C. 都在栈上                            │
│  ○ D. 都在静态区                          │
│                                          │
│  有代码块时显示（highlight.js 高亮）：      │
│  ┌─ code ───────────────────────────┐    │
│  │ int global_var; // 全局变量        │    │
│  │ void func() { int local; }        │    │
│  └───────────────────────────────────┘    │
├──────────────────────────────────────────┤
│          [ ← 上一题 ]  [ 下一题 → ]       │
└──────────────────────────────────────────┘
```

题目按 `display_order` 顺序展示。选择题模式在 AI 分析按钮旁显示自动判题结果。

### 4.3 错题本（/review）

```
┌──────────────────────────────────────────┐
│  错题本                         总 23 题   │
├──────────────────────────────────────────┤
│  筛选：[全部] [C语言] [C++] [操作系统] ...  │
│                                          │
│  □ C语言 - 指针函数与函数指针的区别         │
│    答错 2 次 | 上次: 2天前     [再练一次]  │
│  □ C++ - 虚函数表原理                     │
│    答错 1 次 | 上次: 5天前     [再练一次]  │
│  ...                                     │
│                                          │
│  [开始复习全部]  [清空已掌握]               │
└──────────────────────────────────────────┘
```

### 4.4 通用状态处理

所有页面均需处理四种状态：

| 状态 | 表现 |
|------|------|
| **加载中** | 骨架屏 / spinner，如答题页顶部显示 "加载中..." |
| **空数据** | 友好提示，如错题本无数据时显示 "暂无错题，继续加油！" |
| **错误** | Toast 或 Banner 提示 + 重试按钮，如 "网络错误，请重试" |
| **AI 分析中** | 按钮变为 spinner + "分析中..."；30 秒无响应显示 "AI 超时，请重试" |

## 5. AI 集成

### 5.1 用途

1. **主观答案分析**：用户输入答案 → 前端直接调 DeepSeek API → 返回评分+反馈
2. **模拟面试生成**（Phase 2）：基于 JD/简历，AI 生成定制问题
3. **面经提取**（Phase 2）：用户粘贴面经 → AI 提取 Q&A → 自动入库

### 5.2 实现方式（前端直调 DeepSeek API）

```
用户在 /settings 填入自己的 DeepSeek API Key → 存 localStorage

用户答题 → 点击"AI 分析" →
  fetch("https://api.deepseek.com/v1/chat/completions", {
    headers: { Authorization: "Bearer " + apiKey },
    body: {
      model: "deepseek-chat",  // 模型名提取为配置常量，DeepSeek 更新时可在 settings 切换
      messages: [
        { role: "system", content: "你是面试官，分析答案质量..." },
        { role: "user", content: "问题: ...\n参考答案: ...\n用户答案: ..." }
      ]
    }
  })
  → 返回 { score, feedback, strengths, weaknesses }

前端将分析结果展示在答题区下方，同时保存到 user_progress(last_answer)
```

**无需后端服务**、**无超时限制**、**CORS 已验证通过**。

### 5.3 成本控制

- 仅主观模式且用户主动点击"AI 分析"时才调用
- 选择题模式直接比对 `correct_idx`，不调 AI
- 用户使用自己的 DeepSeek API Key，无共享池，费用自己控制
- API Key 仅存浏览器 localStorage，不清除则长期有效

## 6. 扩展预留

| 扩展 | 所需变更 | 影响范围 |
|------|---------|---------|
| **导入更多文档** | 执行解析脚本 + `sources` 表加一条记录 | 无代码变更 |
| **模拟面试** | 新增 `mock_sessions` 表 + `/mock-interview` 页面 | 新增页面，不影响现有功能 |
| **导入面经** | 新增面经解析脚本 + 批量 insert `questions` | 后端脚本，不影响前端 |
| **JD 预演** | 同模拟面试流程 + AI 生成定制题 | 扩展 mock_sessions 类型 |
| **复习曲线** | `user_progress.next_review` 字段已预留 | 增加调度算法即可 |
| **文件存储** | 图片/附件 → Supabase Storage（免费 50MB） | 如需则在 Phase 2 引入 |

## 7. 可维护性设计

- **组件化目录结构**：每个页面/功能一个独立文件夹
- **类型安全**：TypeScript（门槛低但能避免低级错误）
- **依赖可控**：React 18 + Tailwind 3 + Supabase SDK + 路由库，不引入多余依赖
- **单个仓库**：frontend/ + scripts/ 分目录，一个 repo 管理
- **注释只写 WHY**：代码本身表达 WHAT，注释只解释为什么这么写
- **DEBUGGING.md**：常见报错排查指南（TypeScript 错误、Vite 启动、Supabase 查询、部署日志）

## 8. 非功能性要求

- **首屏加载 < 4s（MVP）**：React.lazy + Suspense 做路由级代码分割
- **离线可用**：Phase 2 考虑 Service Worker
- **隐私**：用户数据仅存 Supabase，API Key 仅存本地浏览器
- **响应式**：手机（375px）到桌面（1440px）自适应
- **Auth**：MVP 仅 Supabase email+password；未登录可浏览话题但无法答题/保存进度

## 9. 初期范围（MVP）

排除在 MVP 之外：
- 模拟面试 / JD 预演 / 面经导入（留到 Phase 2）
- 复习曲线算法（初期用简单间隔）
- Service Worker / 离线支持
- 数据导出
