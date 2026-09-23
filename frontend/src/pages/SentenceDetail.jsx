import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import SpeakButton from '../components/SpeakButton'
import TagInput from '../components/TagInput'
import { ErrorMessage, Loading } from '../components/Status'
import { formatDate, LANGUAGES, MASTERY, PARTS_OF_SPEECH } from '../constants'
import { useAppearance, useUiText } from '../components/Appearance'

export default function SentenceDetail() {
  const t = useUiText()
  const { workbench } = useAppearance()
  const { id } = useParams(); const location = useLocation(); const navigate = useNavigate()
  const [item, setItem] = useState(null); const [showWord, setShowWord] = useState(location.state?.justCreated || false)
  const emptyWord = { word: '', meaning: '', notes: '', part_of_speech: '动词', tags: [] }
  const [word, setWord] = useState(emptyWord); const [existingWords, setExistingWords] = useState([])
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [saving, setSaving] = useState(false)
  const load = () => api.get(`/sentences/${id}`).then(setItem).catch((err) => setError(err.message))
  useEffect(() => { load() }, [id])
  useEffect(() => {
    if (showWord && item) api.get(`/words?language=${item.language}`).then(setExistingWords).catch((err) => setError(err.message))
  }, [showWord, item?.language])

  const openWordForm = async () => {
    const next = !showWord; setShowWord(next); setNotice('')
    if (next && item) {
      try { setExistingWords(await api.get(`/words?language=${item.language}`)) } catch (err) { setError(err.message) }
    }
  }

  const addWord = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    const keepAdding = event.nativeEvent.submitter?.value === 'continue'
    try {
      const result = await api.post(`/sentences/${id}/words`, { ...word, language: item.language, mastery: 'unknown', source_sentence_ids: [] })
      const reused = existingWords.some((entry) => entry.id === result.id)
      const alreadyLinked = item.words.some((entry) => entry.id === result.id)
      setNotice(workbench ? alreadyLinked ? `“${result.word}” is already linked.` : `“${result.word}” saved and linked.` : alreadyLinked ? `“${result.word}”已经与当前句子关联，无需重复添加。` : reused ? `“${result.word}”已在单词库中，本次只添加了来源关联。` : `“${result.word}”已加入单词库。`)
      setWord(emptyWord); setShowWord(keepAdding)
      await load(); setExistingWords(await api.get(`/words?language=${item.language}`))
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const linkWord = async (entry) => {
    setSaving(true); setError(''); setNotice('')
    try {
      await api.post(`/sentences/${id}/words/${entry.id}`, {})
      setNotice(workbench ? `“${entry.word}” linked to this sentence.` : `已把“${entry.word}”与当前句子关联。`); setWord(emptyWord); await load()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }
  const remove = async () => {
    if (!window.confirm(t('确定把这句话移至回收站吗？关联单词不会被删除。'))) return
    await api.delete(`/sentences/${id}`); navigate('/sentences', { state: { notice: t('句子已移至回收站。') } })
  }
  if (!item && !error) return <Loading />
  if (!item) return <ErrorMessage message={error} />
  return (
    <div className="detail-page">
      <Link className="back-link" to="/sentences">{t('← 返回句子库')}</Link>
      {location.state?.justCreated && <div className="success-banner"><b>{t('句子已保存。')}</b> {workbench ? 'You can link words now or come back later.' : '现在可以挑出值得单独记忆的词，也可以稍后再做。'}</div>}
      <article className="detail-card">
        <div className="detail-kicker"><span className="language-badge">{t(LANGUAGES[item.language].short)}</span><span>{t(LANGUAGES[item.language].label)}</span><span className={`mastery ${MASTERY[item.mastery].className}`}>{t(MASTERY[item.mastery].label)}</span></div>
        <p className="detail-chinese">{item.chinese_text}</p>
        {item.language === 'es' && <div className="notes-panel"><span>{workbench ? 'English Translation' : '英文翻译'}</span>{item.english_text ? <p lang="en">{item.english_text}</p> : <p><Link to={`/sentences/${id}/edit`}>{workbench ? 'Add a translation to use English prompts' : '补充英文翻译后可使用英文提示复习'}</Link></p>}</div>}
        <div className="speak-line"><h1 lang={item.language}>{item.target_text}</h1><SpeakButton text={item.target_text} language={item.language} label={t('朗读句子')} /></div>
        {item.notes && <div className="notes-panel"><span>{t('注释 / 讲解')}</span><p>{item.notes}</p></div>}
        <div className="tag-list">{item.tags.map((tag) => <span className="tag" key={tag.id}>{tag.name}</span>)}</div>
        <div className="detail-stats"><div><span>{t('复习次数')}</span><strong>{item.review_count}</strong></div><div><span>{t('最近复习')}</span><strong>{formatDate(item.last_reviewed_at, workbench)}</strong></div><div><span>{t('收录时间')}</span><strong>{formatDate(item.created_at, workbench)}</strong></div></div>
        <div className="detail-actions"><Link className="button button-quiet" to={`/sentences/${id}/edit`}>{t('编辑句子')}</Link><button className="button button-danger-quiet" onClick={remove}>{t('移至回收站')}</button></div>
      </article>

      <section className="linked-section">
        <div className="section-heading"><div><p className="eyebrow">WORDS IN CONTEXT</p><h2>{t('从这句话收下的单词')}</h2></div><button className="button button-primary" onClick={openWordForm}>{t('＋ 添加单词')}</button></div>
        {notice && <div className="success-banner">{notice}</div>}
        {showWord && <form className="inline-form" onSubmit={addWord}>
          <ErrorMessage message={error} />
          <div className="form-row"><label><span>{t('单词')}</span><input required autoFocus value={word.word} onChange={(e) => setWord({ ...word, word: e.target.value })} placeholder={t('例如：別れる')} /></label><label><span>{t('中文意思')}</span><input required value={word.meaning} onChange={(e) => setWord({ ...word, meaning: e.target.value })} placeholder={t('例如：分手')} /></label></div>
          {word.word.trim() && <ExistingWordMatches words={existingWords} linkedIds={new Set(item.words.map((entry) => entry.id))} query={word.word} onLink={linkWord} saving={saving} />}
          <label><span>{t('注释 / 讲解')} <small>{t('可选')}</small></span><textarea rows="3" value={word.notes} onChange={(e) => setWord({ ...word, notes: e.target.value })} placeholder={t('记录变形、搭配、语感或容易混淆的用法。')} /></label>
          <div className="form-row"><label><span>{t('词性')}</span><select value={word.part_of_speech} onChange={(e) => setWord({ ...word, part_of_speech: e.target.value })}>{PARTS_OF_SPEECH.map((part) => <option key={part} value={part}>{t(part)}</option>)}</select></label><label><span>{t('标签')}</span><TagInput value={word.tags} onChange={(tags) => setWord({ ...word, tags })} /></label></div>
          <p className="source-note"><b>{t('来源句：')}</b>{item.target_text}</p>
          <div className="form-actions"><button type="button" className="button button-quiet" onClick={() => setShowWord(false)}>{t('完成')}</button><button className="button button-quiet" name="nextAction" value="finish" disabled={saving}>{saving ? t('保存中…') : t('保存并关闭')}</button><button className="button button-primary" name="nextAction" value="continue" disabled={saving}>{saving ? t('保存中…') : t('保存并继续添加')}</button></div>
        </form>}
        {item.words.length ? <div className="word-chip-list">{item.words.map((entry) => <Link to={`/words/${entry.id}`} state={{ fromSentenceId: id }} className="word-chip" key={entry.id}><strong>{entry.word}</strong><span>{entry.meaning}</span><small>{t(entry.part_of_speech)}　→</small></Link>)}</div> : <p className="muted-panel">{t('还没有添加单词。只挑那些你真的想主动使用的词。')}</p>}
      </section>
    </div>
  )
}

function ExistingWordMatches({ words, linkedIds, query, onLink, saving }) {
  const t = useUiText()
  const normalized = query.trim().toLocaleLowerCase()
  const matches = words.filter((entry) => !linkedIds.has(entry.id) && entry.word.toLocaleLowerCase().includes(normalized)).slice(0, 5)
  if (!matches.length) return null
  const exact = matches.some((entry) => entry.word.trim().toLocaleLowerCase() === normalized)
  return <div className={`existing-words ${exact ? 'exact-match' : ''}`}><span>{exact ? t('这个单词已存在，请直接关联') : t('单词库中可能已有')}</span>{matches.map((entry) => <div key={entry.id}><div><strong>{entry.word}</strong><small>{entry.meaning} · {t(entry.part_of_speech)}</small></div><button type="button" disabled={saving} onClick={() => onLink(entry)}>{t('关联已有单词')}</button></div>)}</div>
}
