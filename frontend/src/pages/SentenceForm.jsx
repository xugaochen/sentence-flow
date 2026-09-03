import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import TagInput from '../components/TagInput'
import { ErrorMessage, Loading } from '../components/Status'
import { LANGUAGES, MASTERY } from '../constants'

const SENTENCE_PLACEHOLDERS = {
  ja: '別れてから、彼女は前より明るくなった。',
  es: 'Escribe aquí la frase completa.',
  en: 'Write the complete sentence here.',
}

export default function SentenceForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState({ chinese_text: '', target_text: '', notes: '', language: 'ja', mastery: 'unknown', tags: [] })
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/tags').then(setTags).catch(() => {})
    if (editing) api.get(`/sentences/${id}`).then((item) => {
      setForm({ ...item, tags: item.tags.map((tag) => tag.name) })
    }).catch((err) => setError(err.message)).finally(() => setLoading(false))
  }, [editing, id])

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const result = editing ? await api.put(`/sentences/${id}`, form) : await api.post('/sentences', form)
      navigate(`/sentences/${result.id}`, { state: { justCreated: !editing } })
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  if (loading) return <Loading />
  return (
    <div className="narrow-page">
      <Link className="back-link" to={editing ? `/sentences/${id}` : '/sentences'}>← 返回句子库</Link>
      <div className="page-title"><p className="eyebrow">COLLECT</p><h1>{editing ? '编辑句子' : '收下一句想说的话'}</h1><p>先记下完整表达。单词可以在保存后，从句子详情中手动添加。</p></div>
      <form className="paper-form" onSubmit={submit}>
        <ErrorMessage message={error} />
        <label><span>中文意思 <b>*</b></span><textarea rows="3" autoFocus required placeholder="例如：分手以后，她比以前开朗了。" value={form.chinese_text} onChange={(e) => setForm({ ...form, chinese_text: e.target.value })} /></label>
        <label><span>目标语言句子 <b>*</b></span><textarea rows="4" required lang={form.language} placeholder={SENTENCE_PLACEHOLDERS[form.language]} value={form.target_text} onChange={(e) => setForm({ ...form, target_text: e.target.value })} /></label>
        <label><span>注释 / 讲解 <small>可选</small></span><textarea rows="4" placeholder="记录语法、使用场景、容易混淆的地方或自己的理解。" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        <div className="form-row">
          <fieldset><legend>语言</legend><div className="segmented">{Object.entries(LANGUAGES).map(([value, item]) => <button className={form.language === value ? 'active' : ''} type="button" key={value} onClick={() => setForm({ ...form, language: value })}>{item.label}</button>)}</div></fieldset>
          {editing && <label><span>熟练度</span><select value={form.mastery} onChange={(e) => setForm({ ...form, mastery: e.target.value })}>{Object.entries(MASTERY).map(([value, item]) => <option value={value} key={value}>{item.label}</option>)}</select></label>}
        </div>
        <label><span>标签 <small>可选</small></span><TagInput value={form.tags} onChange={(value) => setForm({ ...form, tags: value })} suggestions={tags} /></label>
        <div className="form-actions"><Link className="button button-quiet" to={editing ? `/sentences/${id}` : '/sentences'}>取消</Link><button className="button button-primary" disabled={saving}>{saving ? '正在保存…' : '保存句子'} <span>→</span></button></div>
      </form>
    </div>
  )
}
