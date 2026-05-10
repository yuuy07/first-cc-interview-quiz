const DEEPSEEK_BASE = 'https://api.deepseek.com/v1'

export async function generateQuestion({ topic, keywords, questionType, docContext, apiKey }) {
  const typeDesc = questionType === 'choice' ? '选择题（4个选项，标记正确答案索引）' : '主观题'
  const keywordHint = keywords ? `，关键词：${keywords}` : ''
  const docHint = docContext
    ? `\n\n请参考以下文档内容出题，确保题目和答案贴合这些参考资料：\n${docContext}`
    : ''

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
          content: `你是一名嵌入式/C++/操作系统面试官。根据用户要求出一{typeDesc}。
返回纯 JSON，不要 markdown 包裹。
${questionType === 'choice'
  ? '{"question": "...", "choices": ["A", "B", "C", "D"], "correct_idx": 0, "answer": "正确选项解析"}'
  : '{"question": "...", "answer": "参考答案"}'}`,
        },
        {
          role: 'user',
          content: `话题：${topic}${keywordHint}。请出一道嵌入式/C++/操作系统方向的面试题。${docHint}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  })

  if (!res.ok) throw new Error(`DeepSeek API error: ${res.status}`)
  const data = await res.json()
  return JSON.parse(data.choices[0].message.content)
}

export async function evaluateAnswer(question, answer, userAnswer, apiKey) {
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
  "weaknesses": ["不足1", "不足2"]
}`,
        },
        {
          role: 'user',
          content: `问题：${question}\n参考答案：${answer}\n面试者答案：${userAnswer}`,
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
