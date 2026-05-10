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
