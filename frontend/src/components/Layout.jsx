import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useState, useEffect } from 'react'

const navItems = [
  { path: '/', label: '首页', icon: '🏠' },
  { path: '/topics', label: '选题', icon: '📚' },
  { path: '/ai-generate', label: 'AI出题', icon: '🤖' },
  { path: '/review', label: '错题本', icon: '📝' },
  { path: '/stats', label: '统计', icon: '📊' },
  { path: '/search', label: '搜索', icon: '🔍' },
  { path: '/documents', label: '文档', icon: '📄' },
  { path: '/settings', label: '设置', icon: '⚙️' },
]

export default function Layout({ children }) {
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-blue-600">八股刷题</Link>

          {/* Mobile hamburger */}
          <button onClick={() => setMenuOpen(o => !o)} className="sm:hidden p-1 text-gray-600 hover:text-blue-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>

          {/* Desktop nav */}
          <div className="hidden sm:flex gap-4 text-sm">
            {navItems.map(item => (
              <Link key={item.path} to={item.path}
                className={`px-2 py-1 rounded ${
                  location.pathname === item.path
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-blue-600'
                }`}>
                {item.icon} {item.label}
              </Link>
            ))}
            {user ? (
              <button onClick={() => supabase.auth.signOut()} className="text-gray-500 hover:text-red-500">退出</button>
            ) : (
              <Link to="/login" className="text-blue-600">登录</Link>
            )}
          </div>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="sm:hidden border-t bg-white px-4 py-2 space-y-1">
            {navItems.map(item => (
              <Link key={item.path} to={item.path}
                className={`block px-3 py-2 rounded text-sm ${
                  location.pathname === item.path
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}>
                {item.icon} {item.label}
              </Link>
            ))}
            <div className="border-t pt-1 mt-1">
              {user ? (
                <button onClick={() => supabase.auth.signOut()}
                  className="block w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-red-500">退出登录</button>
              ) : (
                <Link to="/login" className="block px-3 py-2 text-sm text-blue-600">登录</Link>
              )}
            </div>
          </div>
        )}
      </nav>
      <main className="max-w-4xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
