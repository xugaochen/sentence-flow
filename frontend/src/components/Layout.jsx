import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAppearance } from './Appearance'
import { workspaceFile } from '../utils/appearance'

const nav = [
  ['/', '首页', 'Home'],
  ['/review/sentences', '句子复习', 'Sentence Review'],
  ['/sentences', '句子库', 'Sentence Library'],
  ['/words', '单词库', 'Word Library'],
  ['/data', '数据管理', 'Data & Backup'],
]
const files = [...nav.slice(0, 2), ['/review/words', '单词复习', 'Word Review'], ...nav.slice(2)]

export default function Layout() {
  const { workbench, toggleAppearance } = useAppearance()
  const { pathname } = useLocation()
  const file = workspaceFile(pathname)
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="首页">
          <span className="brand-mark">{workbench ? '⌘' : '句'}</span>
          <span><strong>{workbench ? 'Workspace' : '句流'}</strong><small>{workbench ? 'LOCAL PROJECT' : 'Sentence Flow'}</small></span>
        </NavLink>
        <nav>
          {nav.map(([to, label, filename]) => <NavLink key={to} to={to} end={to === '/'} title={workbench ? filename : label}>{workbench ? filename : label}</NavLink>)}
        </nav>
        <div className="topbar-actions"><button type="button" className="button button-small appearance-toggle" onClick={toggleAppearance} aria-pressed={workbench} title={workbench ? 'Switch to the standard view without losing your answer' : '切换到代码编辑器风格'}>{workbench ? 'Standard View' : '⌘ 工作台'}</button><NavLink to="/sentences/new" className="button button-small">{workbench ? '+ Add Sentence' : '＋ 添加句子'}</NavLink></div>
      </header>
      <div className="workspace-frame">
        {workbench && <aside className="workspace-explorer" aria-label="Navigation"><p>NAVIGATION <span>···</span></p><div className="workspace-folder">⌄ YOUR WORKSPACE</div><nav>{files.map(([to, _label, name], index) => <NavLink key={to} to={to} end={to === '/'} title={name}><span className="file-ts" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{name}</NavLink>)}</nav><div className="workspace-tree-note">All changes are saved<br />on this computer.</div></aside>}
        <div className="workspace-content">
          {workbench && <div className="workspace-editor-chrome"><div className="workspace-tab"><span className="file-ts" aria-hidden="true">◇</span>{file}</div><div className="workspace-breadcrumb">Workspace <span>›</span> {file}</div></div>}
          <main className="page"><Outlet /></main>
        </div>
      </div>
      <footer>{workbench ? <><span>Workspace View</span><span>Saved locally</span><span>{file}</span></> : '先说出来，再慢慢熟练。'}</footer>
    </div>
  )
}
