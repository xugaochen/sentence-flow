import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import TagInput from '../components/TagInput'
import { ErrorMessage, Loading } from '../components/Status'
import { formatDate, LANGUAGES, MASTERY, PARTS_OF_SPEECH } from '../constants'

export default function WordDetail() {
  const { id } = useParams(); const navigate = useNavigate()
  const [item, setItem] = useState(null); const [editing, setEditing] = useState(false); const [error, setError] = useState('')
  const load = () => api.get(`/words/${id}`).then(setItem).catch((err) => setError(err.message))
  useEffect(load, [id])

  const save = async (event) => {
    event.preventDefault(); setError('')
    try {
      const updated = await api.put(`/words/${id}`, {
        ...item,
        tags: item.tags.map((tag) => typeof tag === 'string' ? tag : tag.name),
        source_sentence_ids: item.sentences.map((sentence) => sentence.id),
      })
      setItem(updated); setEditing(false)
    } catch (err) { setError(err.message) }
  }
  const remove = async () => {
    if (!window.confirm(`确定删除单词“${item.word}”吗？来源句不会被删除。`)) return
    await api.delete(`/words/${id}`); navigate('/words')
  }
  if (!item && !error) return <Loading />
  if (!item) return <ErrorMessage message={error} />
  const tagNames = item.tags.map((tag) => typeof tag === 'string' ? tag : tag.name)

  return <div className="detail-page word-detail-page">
    <Link className="back-link" to="/words">← 返回单词库</Link>
    <article className="detail-card">
      {!editing ? <>
        <div className="detail-kicker"><span className="language-badge">{LANGUAGES[item.language].short}</span><span>{LANGUAGES[item.language].label} · {item.part_of_speech}</span><span className={`mastery ${MASTERY[item.mastery].className}`}>{MASTERY[item.mastery].label}</span></div>
        <h1 lang={item.language}>{item.word}</h1><p className="word-meaning">{item.meaning}</p>
        {item.notes && <div className="notes-panel"><span>注释 / 讲解</span><p>{item.notes}</p></div>}
        <div className="tag-list">{item.tags.map((tag) => <span className="tag" key={tag.id}>{tag.name}</span>)}</div>
        <div className="detail-stats"><div><span>复习次数</span><strong>{item.review_count}</strong></div><div><span>最近复习</span><strong>{formatDate(item.last_reviewed_at)}</strong></div><div><span>收录时间</span><strong>{formatDate(item.created_at)}</strong></div></div>
        <div className="detail-actions"><button className="button button-quiet" onClick={() => setEditing(true)}>编辑单词</button><button className="button button-danger-quiet" onClick={remove}>删除</button></div>
      </> : <form onSubmit={save}>
        <div className="section-heading"><h2>编辑单词</h2><button className="icon-button" type="button" onClick={() => { setEditing(false); load() }}>×</button></div>
        <ErrorMessage message={error} />
        <div className="form-row"><label><span>单词</span><input required value={item.word} onChange={(e) => setItem({ ...item, word: e.target.value })} /></label><label><span>中文意思</span><input required value={item.meaning} onChange={(e) => setItem({ ...item, meaning: e.target.value })} /></label></div>
        <label><span>注释 / 讲解 <small>可选</small></span><textarea rows="4" value={item.notes} onChange={(e) => setItem({ ...item, notes: e.target.value })} placeholder="记录变形、搭配、语感或容易混淆的用法。" /></label>
        <div className="form-row"><label><span>词性</span><select value={item.part_of_speech} onChange={(e) => setItem({ ...item, part_of_speech: e.target.value })}>{PARTS_OF_SPEECH.map((part) => <option key={part}>{part}</option>)}</select></label><label><span>熟练度</span><select value={item.mastery} onChange={(e) => setItem({ ...item, mastery: e.target.value })}>{Object.entries(MASTERY).map(([value, data]) => <option value={value} key={value}>{data.label}</option>)}</select></label></div>
        <label><span>标签</span><TagInput value={tagNames} onChange={(tags) => setItem({ ...item, tags })} /></label>
        <div className="form-actions"><button type="button" className="button button-quiet" onClick={() => { setEditing(false); load() }}>取消</button><button className="button button-primary">保存修改</button></div>
      </form>}
    </article>
    <section className="linked-section"><div className="section-heading"><div><p className="eyebrow">SOURCE SENTENCES</p><h2>这个词出现过的句子</h2></div></div>{item.sentences.length ? <div className="sentence-list">{item.sentences.map((sentence) => <Link className="source-sentence" to={`/sentences/${sentence.id}`} key={sentence.id}><div><p>{sentence.chinese_text}</p><strong lang={sentence.language}>{sentence.target_text}</strong></div><span>→</span></Link>)}</div> : <p className="muted-panel">这个单词目前没有来源句。</p>}</section>
  </div>
}
