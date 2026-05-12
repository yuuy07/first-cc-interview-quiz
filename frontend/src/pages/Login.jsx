import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignup, setIsSignup] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: err } = isSignup
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password })
      if (err) setError(err.message)
      else navigate('/')
    } catch (e) {
      setError('操作失败：' + (e.message || '请检查网络连接'))
    } finally {
      setLoading(false)
    }
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
        <button type="submit" disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {loading ? '处理中...' : (isSignup ? '注册' : '登录')}
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
