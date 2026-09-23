import { useAppearance, useUiText } from '../components/Appearance'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import SpeakButton from '../components/SpeakButton'
import TagInput from '../components/TagInput'
import { ErrorMessage, Loading } from '../components/Status'
import { formatDate, LANGUAGES, MASTERY, PARTS_OF_SPEECH } from '../constants'

export default function WordDetail() {
  const t = useUiText()
  const { workbench } = useAppearance()
  const { id } = useParams(); const location = useLocation(); const navigate = useNavigate()
  const [item, setItem] = useState(null); const [editing, setEditing] = useState(false); const [error, setError] = useState('')
  const load = () => api.get(`/words/${id}`).then(setItem).catch((err) => setError(err.message))
  useEffect(() => {
    void load()
  }, [id])

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
    if (!window.confirm(workbench ? `Move “${item.word}” to trash? Source sentences will be kept.` : `确定把单词“${item.word}”移至回收站吗？来源句不会被删除。`)) return
    await api.delete(`/words/${id}`); navigate('/words', { state: { notice: t('单词已移至回收站。') } })
  }
  if (!item && !error) return <Loading />
  if (!item) return <ErrorMessage message={error} />
  const tagNames = item.tags.map((tag) => typeof tag === 'string' ? tag : tag.name)
  const fromSentenceId = String(location.state?.fromSentenceId ?? '')
  const hasSentenceOrigin = /^[1-9]\d*$/.test(fromSentenceId)

  return <div className="detail-page word-detail-page">
    <Link className="back-link" to={hasSentenceOrigin ? `/sentences/${fromSentenceId}` : '/words'}>{hasSentenceOrigin ? t('← 返回刚才的句子') : t('← 返回单词库')}</Link>
    <article className="detail-card">
      {!editing ? <>
        <div className="detail-kicker"><span className="language-badge">{t(LANGUAGES[item.language].short)}</span><span>{t(LANGUAGES[item.language].label)} · {t(item.part_of_speech)}</span><span className={`mastery ${MASTERY[item.mastery].className}`}>{t(MASTERY[item.mastery].label)}</span></div>
        <div className="speak-line"><h1 lang={item.language}>{item.word}</h1><SpeakButton text={item.word} language={item.language} label={t('朗读单词')} /></div><p className="word-meaning">{item.meaning}</p>
        {item.notes && <div className="notes-panel"><span>{t('注释 / 讲解')}</span><p>{item.notes}</p></div>}
        <div className="tag-list">{item.tags.map((tag) => <span className="tag" key={tag.id}>{tag.name}</span>)}</div>
        <div className="detail-stats"><div><span>{t('复习次数')}</span><strong>{item.review_count}</strong></div><div><span>{t('最近复习')}</span><strong>{formatDate(item.last_reviewed_at, workbench)}</strong></div><div><span>{t('收录时间')}</span><strong>{formatDate(item.created_at, workbench)}</strong></div></div>
        <div className="detail-actions"><button className="button button-quiet" onClick={() => setEditing(true)}>{t('编辑单词')}</button><button className="button button-danger-quiet" onClick={remove}>{t('移至回收站')}</button></div>
      </> : <form onSubmit={save}>
        <div className="section-heading"><h2>{t('编辑单词')}</h2><button className="icon-button" type="button" onClick={() => { setEditing(false); load() }}>×</button></div>
        <ErrorMessage message={error} />
        <div className="form-row"><label><span>{t('单词')}</span><input required value={item.word} onChange={(e) => setItem({ ...item, word: e.target.value })} /></label><label><span>{t('中文意思')}</span><input required value={item.meaning} onChange={(e) => setItem({ ...item, meaning: e.target.value })} /></label></div>
        <label><span>{t('注释 / 讲解')} <small>{t('可选')}</small></span><textarea rows="4" value={item.notes} onChange={(e) => setItem({ ...item, notes: e.target.value })} placeholder={t('记录变形、搭配、语感或容易混淆的用法。')} /></label>
        <div className="form-row"><label><span>{t('词性')}</span><select value={t(item.part_of_speech)} onChange={(e) => setItem({ ...item, part_of_speech: e.target.value })}>{PARTS_OF_SPEECH.map((part) => <option key={part} value={part}>{t(part)}</option>)}</select></label><label><span>{t('熟练度')}</span><select value={item.mastery} onChange={(e) => setItem({ ...item, mastery: e.target.value })}>{Object.entries(MASTERY).map(([value, data]) => <option value={value} key={value}>{t(data.label)}</option>)}</select></label></div>
        <label><span>{t('标签')}</span><TagInput value={tagNames} onChange={(tags) => setItem({ ...item, tags })} /></label>
        <div className="form-actions"><button type="button" className="button button-quiet" onClick={() => { setEditing(false); load() }}>{t('取消')}</button><button className="button button-primary">{t('保存修改')}</button></div>
      </form>}
    </article>
    <section className="linked-section"><div className="section-heading"><div><p className="eyebrow">SOURCE SENTENCES</p><h2>{t('这个词出现过的句子')}</h2></div></div>{item.sentences.length ? <div className="sentence-list">{item.sentences.map((sentence) => <Link className="source-sentence" to={`/sentences/${sentence.id}`} key={sentence.id}><div><p>{sentence.chinese_text}</p><strong lang={sentence.language}>{sentence.target_text}</strong></div><span>→</span></Link>)}</div> : <p className="muted-panel">{t('这个单词目前没有来源句。')}</p>}</section>
  </div>
}
