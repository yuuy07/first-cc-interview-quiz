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
