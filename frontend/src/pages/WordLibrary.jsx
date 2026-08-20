import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, queryString } from '../api'
import TagInput from '../components/TagInput'
import { Empty, ErrorMessage, Loading } from '../components/Status'
import { LANGUAGES, MASTERY, PARTS_OF_SPEECH } from '../constants'

export default function WordLibrary() {
  const [filters, setFilters] = useState({ q: '', language: '', part_of_speech: '', mastery: '', tag: '' })
  const [items, setItems] = useState([]); const [tags, setTags] = useState([]); const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null); const [error, setError] = useState('')
  const load = () => { setLoading(true); api.get(`/words${queryString(filters)}`).then(setItems).catch((err) => setError(err.message)).finally(() => setLoading(false)) }
  useEffect(load, [filters.q, filters.language, filters.part_of_speech, filters.mastery, filters.tag])
  useEffect(() => { api.get('/tags?kind=word').then(setTags).catch(() => {}) }, [])

  const startEdit = (item) => setEditing({ ...item, tags: item.tags.map((tag) => tag.name), source_sentence_ids: item.sentences.map((sentence) => sentence.id) })
  const save = async (event) => {
    event.preventDefault()
    try { await api.put(`/words/${editing.id}`, editing); setEditing(null); load() } catch (err) { setError(err.message) }
  }
  const remove = async (item) => {
    if (!window.confirm(`确定删除单词“${item.word}”吗？`)) return
    await api.delete(`/words/${item.id}`); load()
  }
  return (
    <div>
      <div className="library-header"><div className="page-title"><p className="eyebrow">WORD LIBRARY</p><h1>单词库</h1><p>词汇留在句子里，才有真正可用的意义。</p></div><Link className="button button-primary" to="/review/words">复习单词 →</Link></div>
      <div className="filterbar filterbar-wide">
        <label className="search"><span>⌕</span><input placeholder="搜索单词或中文…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} /></label>
        <select value={filters.language} onChange={(e) => setFilters({ ...filters, language: e.target.value })}><option value="">全部语言</option>{Object.entries(LANGUAGES).map(([v, x]) => <option key={v} value={v}>{x.label}</option>)}</select>
        <select value={filters.part_of_speech} onChange={(e) => setFilters({ ...filters, part_of_speech: e.target.value })}><option value="">全部词性</option>{PARTS_OF_SPEECH.map((part) => <option key={part}>{part}</option>)}</select>
        <select value={filters.tag} onChange={(e) => setFilters({ ...filters, tag: e.target.value })}><option value="">全部标签</option>{tags.map((tag) => <option key={tag}>{tag}</option>)}</select>
        <select value={filters.mastery} onChange={(e) => setFilters({ ...filters, mastery: e.target.value })}><option value="">全部熟练度</option>{Object.entries(MASTERY).map(([v, x]) => <option key={v} value={v}>{x.label}</option>)}</select>
      </div>
      <ErrorMessage message={error} />
      {loading ? <Loading /> : items.length === 0 ? <Empty title="单词库还是空的">进入一个句子的详情页，手动挑选值得记忆的词。</Empty> : <div className="word-grid">
        {items.map((item) => <article className="word-card" key={item.id}>
          <div className="word-card-top"><span className="language-badge">{LANGUAGES[item.language].short}</span><span className={`mastery ${MASTERY[item.mastery].className}`}>{MASTERY[item.mastery].label}</span></div>
          <Link to={`/words/${item.id}`}><h2 lang={item.language}>{item.word}</h2></Link><p>{item.meaning}</p><span className="pos">{item.part_of_speech}</span>
          {item.notes && <p className="notes-preview">{item.notes}</p>}
          <div className="tag-list">{item.tags.map((tag) => <span className="tag" key={tag.id}>{tag.name}</span>)}</div>
          {item.sentences[0] && <Link className="source-link" to={`/sentences/${item.sentences[0].id}`}><small>来源句</small><span>{item.sentences[0].target_text}</span><b>→</b></Link>}
          <div className="card-actions"><button onClick={() => startEdit(item)}>编辑</button><button className="text-danger" onClick={() => remove(item)}>删除</button><small>复习 {item.review_count} 次</small></div>
        </article>)}
      </div>}
      {editing && <div className="modal-backdrop" onMouseDown={() => setEditing(null)}><form className="modal" onSubmit={save} onMouseDown={(e) => e.stopPropagation()}><div className="section-heading"><h2>编辑单词</h2><button type="button" className="icon-button" onClick={() => setEditing(null)}>×</button></div><div className="form-row"><label><span>单词</span><input required value={editing.word} onChange={(e) => setEditing({ ...editing, word: e.target.value })} /></label><label><span>中文意思</span><input required value={editing.meaning} onChange={(e) => setEditing({ ...editing, meaning: e.target.value })} /></label></div><label><span>注释 / 讲解 <small>可选</small></span><textarea rows="4" value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></label><div className="form-row"><label><span>词性</span><select value={editing.part_of_speech} onChange={(e) => setEditing({ ...editing, part_of_speech: e.target.value })}>{PARTS_OF_SPEECH.map((part) => <option key={part}>{part}</option>)}</select></label><label><span>熟练度</span><select value={editing.mastery} onChange={(e) => setEditing({ ...editing, mastery: e.target.value })}>{Object.entries(MASTERY).map(([v, x]) => <option key={v} value={v}>{x.label}</option>)}</select></label></div><label><span>标签</span><TagInput value={editing.tags} onChange={(tags) => setEditing({ ...editing, tags })} /></label><div className="form-actions"><button type="button" className="button button-quiet" onClick={() => setEditing(null)}>取消</button><button className="button button-primary">保存修改</button></div></form></div>}
    </div>
  )
}
