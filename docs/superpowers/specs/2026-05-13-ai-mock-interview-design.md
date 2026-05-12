# AI 模拟面试功能设计

> **目标：** 在现有刷题工具基础上，增加 AI 模拟面试功能。用户上传 JD + 简历，AI 作为面试官逐题提问、评分、给出复盘报告。

**定位：** 小而美的嵌入式/C++ 面试工具。Phase 1 为文字版，仅使用现有 DeepSeek API。

---

## 用户流程

```
配置页 (/mock-interview)
  ├─ 粘贴 JD 文本（必填）
  ├─ 上传简历文件（可选，本地存储）
  ├─ 输入公司名（可选，AI 搜索公开信息）
  ├─ AI 自动提取技术标签、推荐话题
  ├─ 手动调整话题 × 面试时长（15/30/60min）
  └─ [开始面试] / [复制 prompt 去豆包]

面试页 (/mock-interview/session)
  ├─ AI 逐题提问（面试官语气）
  ├─ 用户提交文字答案
  ├─ AI 即时评分（1-10）+ 追问
  ├─ 全部答完 或 时间到 → 结束
  └─ 跳转复盘报告

复盘报告
  ├─ 总评分 + 各话题得分（雷达图/柱状图）
  ├─ 逐题记录（题目 + 用户答案 + AI 评分 + 反馈）
  ├─ 薄弱点分析 + 建议复习方向
  └─ [再来一次] / [查看错题]
```

---

## 配置页详细设计

### 输入区

**JD 输入（必填）**
- 多行文本框，placeholder: "粘贴岗位 JD..."
- AI 提取技术要求关键词 → 自动勾选匹配的话题
- Phase 1 只支持单个 JD，多个 JD 输入推迟到岗位对比功能做

**简历上传（可选）**
- 支持 `.pdf` / `.md` / `.txt`，文件大小限制 5MB
- Phase 1 `.pdf` 使用客户端 `pdf.js` 解析文本（不支持扫描件/图片 PDF）
- 解析后存 IndexedDB（沿用 `docStore.js` 模式），不上传服务器
- 解析失败提示用户"无法解析此文件，请尝试 .md 或 .txt 格式"
- AI 分析简历背景，与 JD 对比找出差距方向

**公司名（可选）**
- 输入公司名 → DeepSeek 根据训练数据生成公司信息摘要
- 提取：主营业务、规模、技术栈、融资/上市情况
- ⚠️ AI 生成的信息可能不准确或过时，展示时标注"AI 生成，仅供参考"
- 用户可编辑/删除 AI 生成的信息

### 配置区

**话题选择**
- AI 根据 JD 自动推荐话题标签（可取消/新增）
- 默认全选推荐话题

**面试时长**
- 15 分钟 / 30 分钟 / 60 分钟
- AI 根据时长决定出题数量（约 3/6/10 题 + 追问）

**豆包 prompt 导出**
- 生成本次面试的 prompt，包含：JD 摘要 + 简历摘要 + 话题列表 + 面试要求
- 用户一键复制（需显示"已复制"反馈），粘贴到豆包 app 使用
- 导出 prompt 后面试会话标记为 `pending`，用户可回到应用手动录入豆包面试结果或放弃
- prompt 模板：

```
你是一名嵌入式/C++ 面试官。请根据以下要求进行面试：
岗位要求：{JD摘要}
候选人背景：{简历摘要}
重点考察方向：{话题列表}
面试风格：先问基础，根据回答情况深入追问或换题。
每题给出评分（1-10）和简短反馈。
全部结束后给出总结评价。
```

### 状态与校验

| 状态 | 处理 |
|------|------|
| JD 为空 | [开始面试] 按钮 disabled，提示"请粘贴 JD" |
| 话题为空 | 提示"至少选择一个话题" |
| 正在分析 JD | 按钮显示"分析中..."，loading |
| AI 分析 JD 失败 | 显示错误信息 + [重试] 按钮，允许用户手动选择话题作为备选 |
| JD 超过 token 限制 | 前端截断至 3000 字并提示"JD 过长，已截断分析" |
| AI 未匹配到任何话题 | 展示全部话题供用户手动选择，提示"AI 未能识别技术方向，请手动选择" |
| 分析完成 | 按钮恢复，话题已自动勾选 |
| 用户对 AI 推荐不满意 | 提供[重新分析]按钮 |

---

## 面试页面设计

### 布局

```
┌─────────────────────────────────────┐
│ 面试进行中  第 3/8 题  ████████░░  │ ← 进度条
├─────────────────────────────────────┤
│                                     │
│ 面试官：                            │
│ "请解释一下 std::vector 的内存管理  │
│  机制，push_back 在什么情况下会     │
│  触发 reallocation？"              │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 你的回答：                       │ │
│ │                                 │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [提交]  [跳过 → 下一题]             │
│                                     │
│ ── 上一题反馈 ──                    │
│ 评分: 7/10                          │
│ 追问: 那 emplace_back 和 push_back  │
│       有什么区别？                  │
│                                     │
└─────────────────────────────────────┘
```

### 交互流程

1. AI 出题（首次加载生成全部题目列表，逐题展示）
2. 用户作答 → 点击提交
3. AI 评分（1-10）+ 反馈 + 可选追问
4. 用户回答追问 或 选择下一题
5. 重复 2-5 直到完成或时间到

### 追问机制

- AI 根据用户回答质量决定是否追问
- 回答好（≥8 分）：深入追问，考察上限
- 回答一般（4-7 分）：纠正 + 补问相关点
- 回答差（<4 分）：给出参考答案，进入下一题

### 边界情况

| 情况 | 处理 |
|------|------|
| 用户提交空白答案 | 禁用提交，提示"请输入回答" |
| AI 评分请求超时 | 重试一次，仍失败则跳过该题 |
| 面试时间到 | 强制结束当前题，进入复盘 |
| 网络断开 | 显示断网提示，本地缓存已答记录 |
| 用户刷新页面 | 从 Supabase 恢复面试会话进度 |

---

## 复盘报告设计

### 数据展示

**顶部：总评分 + 各维度得分**
```
┌──────────────────────────────┐
│  综合评分                     │
│      6.8 / 10                │
│                              │
│  C++     ████████░░  8/10    │
│  RTOS    ██████░░░░  6/10    │
│  驱动    ████░░░░░░  4/10    │
│  网络    █████░░░░░  5/10    │
└──────────────────────────────┘
```

**逐题记录**
- 可展开/收起的题目列表
- 每题显示：题目、用户答案、AI 评分、AI 反馈、参考答案

**薄弱点分析**
- AI 总结 2-3 个最需要加强的方向
- 每个方向附带建议复习资源（链接到现有题库话题）

**操作按钮**
- [再来一次] — 使用相同配置重新面试
- [查看错题本] — 跳转 `/review`
- [导出报告] — 复制文本版报告

---

## 数据模型（Supabase）

### interview_sessions

```sql
create table interview_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users not null,
  status              text not null default 'in_progress', -- in_progress | completed | cancelled | pending
  jd_text             text not null,
  company             text,
  resume_text         text,              -- 简历解析后的纯文本
  topics              text[] not null,   -- 面试话题列表
  duration            int not null default 30, -- 分钟
  generated_questions jsonb,             -- 出题结果缓存 [{question, expected_answer, topic}]
  total_score         numeric(4,1),      -- 综合评分
  summary             text,              -- AI 生成的总结
  created_at          timestamptz default now()
);

-- RLS: 用户只能看到自己的面试记录
alter table interview_sessions enable row level security;
create policy "Users can manage own sessions"
  on interview_sessions for all
  using (auth.uid() = user_id);
```

### interview_responses

```sql
create table interview_responses (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid references interview_sessions not null,
  question        text not null,
  expected_answer text,                  -- 参考答案（用于评分和复盘展示）
  topic           text not null,         -- 关联到话题，用于按话题统计得分
  user_answer     text not null,
  ai_score        int not null,          -- 1-10
  ai_feedback     text,                  -- AI 评语
  ai_followup     text,                  -- AI 追问（如果有）
  user_followup   text,                  -- 用户对追问的回答
  order_num       int not null,          -- 题目顺序
  created_at      timestamptz default now()
);

-- RLS: 回答通过所属会话级联控制
alter table interview_responses enable row level security;
create policy "Users can manage own responses"
  on interview_responses for all
  using (exists (
    select 1 from interview_sessions
    where id = session_id and user_id = auth.uid()
  ));
```

---

## 技术实现

### 新增文件

```
src/
  pages/
    MockInterview.jsx        — 面试配置页
    MockSession.jsx          — 面试进行页
    MockReview.jsx           — 复盘报告页
  hooks/
    useMockInterview.js      — 面试配置 + 出题逻辑
    useMockSession.js        — 面试会话管理
    useMockReport.js         — 复盘报告生成
  lib/
    resumeParser.js          — 简历解析（文本提取）
```

### 核心 API 调用（复用 DeepSeek）

**出题 prompt：**
```
你是一名嵌入式/C++ 面试官。
岗位要求：{JD摘要}
用户背景：{简历摘要}
要求出{n}道面试题，话题范围：{话题列表}。
返回 JSON 数组：[{"question": "...", "expected_answer": "...", "topic": "..."}]
```

**评分 prompt（复用现有 `evaluateAnswer`）：**
```
问题：{question}
参考答案：{expected_answer}
用户答案：{userAnswer}
评分并给出反馈。
```

### 简历解析

- `.md` / `.txt`：直接读取文本
- `.pdf`：使用客户端 `pdf.js` 提取文本。不支持扫描件/图片 PDF（需要 OCR 服务，Phase 1 不做）
- 提取：教育背景、技术栈、工作经历、项目经验
- 简历文件存 IndexedDB（沿用 `docStore.js`），不存服务端

---

## Phase 1 范围确认

### 本期做
- 文字 AI 面试（配置 + 答题 + 评分 + 追问）
- 复盘报告（逐题记录 + 薄弱分析）
- JD 解析 + 话题自动匹配
- 简历上传 + 解析（md/txt/pdf）
- 公司信息查询 + 摘要（标注 AI 生成，仅供参考）
- 豆包 prompt 导出

### 本期不做
- 语音/视频面试（Phase 2/3）
- 公司评估报告（后续讨论）
- 岗位对比分析（后续讨论）
- 面试历史列表/搜索（后续迭代）

---

## UI 设计原则

- 与现有设计语言一致（Tailwind CSS，圆角卡片，灰白背景）
- 面试页聚焦内容，减少干扰（无侧边导航展示）
- 移动端适配面试对话流
