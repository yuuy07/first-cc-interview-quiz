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
