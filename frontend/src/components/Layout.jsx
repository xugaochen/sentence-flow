import { NavLink, Outlet } from 'react-router-dom'

const nav = [
  ['/', '首页'],
  ['/review/sentences', '句子复习'],
  ['/sentences', '句子库'],
  ['/words', '单词库'],
  ['/data', '数据管理'],
]

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="句流首页">
          <span className="brand-mark">句</span>
          <span><strong>句流</strong><small>Sentence Flow</small></span>
        </NavLink>
        <nav>
          {nav.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}
        </nav>
        <NavLink to="/sentences/new" className="button button-small">＋ 添加句子</NavLink>
      </header>
      <main className="page"><Outlet /></main>
      <footer>先说出来，再慢慢熟练。</footer>
    </div>
  )
}
