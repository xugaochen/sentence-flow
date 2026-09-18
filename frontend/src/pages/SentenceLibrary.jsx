import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api, queryString } from '../api'
import { Empty, ErrorMessage, Loading } from '../components/Status'
import { LANGUAGES, MASTERY } from '../constants'

export default function SentenceLibrary() {
  const location = useLocation()
  const [filters, setFilters] = useState({ q: '', language: '', mastery: '', tag: '' })
  const [items, setItems] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(location.state?.notice || '')
  const [savingMastery, setSavingMastery] = useState(null)

  const load = () => {
    setLoading(true)
    api.get(`/sentences${queryString(filters)}`).then(setItems).catch((err) => setError(err.message)).finally(() => setLoading(false))
  }
  useEffect(load, [filters.q, filters.language, filters.mastery, filters.tag])
  useEffect(() => { api.get('/tags?kind=sentence').then(setTags).catch(() => {}) }, [])

  const remove = async (event, item) => {
    event.preventDefault(); event.stopPropagation()
    if (!window.confirm(`确定把这句话移至回收站吗？\n${item.target_text}`)) return
    await api.delete(`/sentences/${item.id}`); setError(''); setNotice('句子已移至回收站。'); load()
  }

  const updateMastery = async (event, item) => {
    event.preventDefault(); event.stopPropagation()
    const mastery = event.target.value
    if (mastery === item.mastery || savingMastery === item.id) return

    const previousMastery = item.mastery
    setError('')
    setSavingMastery(item.id)
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, mastery } : entry))
    try {
      const updated = await api.put(`/sentences/${item.id}`, {
        chinese_text: item.chinese_text,
        target_text: item.target_text,
        notes: item.notes,
        language: item.language,
        mastery,
        tags: item.tags.map((tag) => tag.name),
      })
      setItems((current) => current
        .map((entry) => entry.id === item.id ? updated : entry)
        .filter((entry) => !filters.mastery || entry.mastery === filters.mastery))
    } catch (err) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, mastery: previousMastery } : entry))
      setError(err.message)
    } finally {
      setSavingMastery(null)
    }
  }

  return (
    <div>
      <div className="library-header"><div className="page-title"><p className="eyebrow">SENTENCE LIBRARY</p><h1>句子库</h1><p>每一句，都是你真正想说的话。</p></div><Link className="button button-primary" to="/sentences/new">＋ 添加句子</Link></div>
      <div className="filterbar">
        <label className="search"><span>⌕</span><input aria-label="搜索句子" placeholder="搜索中文或目标语言…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} /></label>
        <select aria-label="语言筛选" value={filters.language} onChange={(e) => setFilters({ ...filters, language: e.target.value })}><option value="">全部语言</option>{Object.entries(LANGUAGES).map(([v, x]) => <option key={v} value={v}>{x.label}</option>)}</select>
        <select aria-label="标签筛选" value={filters.tag} onChange={(e) => setFilters({ ...filters, tag: e.target.value })}><option value="">全部标签</option>{tags.map((tag) => <option key={tag}>{tag}</option>)}</select>
        <select aria-label="熟练度筛选" value={filters.mastery} onChange={(e) => setFilters({ ...filters, mastery: e.target.value })}><option value="">全部熟练度</option>{Object.entries(MASTERY).map(([v, x]) => <option key={v} value={v}>{x.label}</option>)}</select>
      </div>
      <ErrorMessage message={error} />
      {notice && <div className="success-banner">{notice} <Link to="/data">前往回收站</Link></div>}
      {loading ? <Loading /> : items.length === 0 ? <Empty title="还没有找到句子">换一个筛选条件，或添加第一句想说的话。</Empty> : (
        <div className="sentence-list">
          {items.map((item, index) => <div className="sentence-row" key={item.id}>
            <Link className="sentence-copy-link" to={`/sentences/${item.id}`}>
              <span className="row-index">{String(index + 1).padStart(2, '0')}</span>
              <div className="sentence-copy"><p>{item.chinese_text}</p><h3 lang={item.language}>{item.target_text}</h3><div className="tag-list">{item.tags.map((tag) => <span className="tag" key={tag.id}>{tag.name}</span>)}</div></div>
            </Link>
            <div className="row-meta"><select className={`mastery mastery-select ${MASTERY[item.mastery].className}`} aria-label={`修改“${item.target_text}”的熟练度`} title="点击修改熟练度" value={item.mastery} disabled={savingMastery === item.id} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} onChange={(event) => updateMastery(event, item)}>{Object.entries(MASTERY).map(([value, data]) => <option value={value} key={value}>{data.label}</option>)}</select><small>{LANGUAGES[item.language].label} · 复习 {item.review_count} 次</small><button className="text-danger" onClick={(event) => remove(event, item)}>移至回收站</button></div>
            <Link className="row-arrow" aria-label={`查看句子：${item.target_text}`} to={`/sentences/${item.id}`}>→</Link>
          </div>)}
        </div>
      )}
    </div>
  )
}
