import { useEffect, useState } from 'react'
import { api } from '../api'
import { PARTS_OF_SPEECH } from '../constants'
import { ErrorMessage } from './Status'
import TagInput from './TagInput'
import { useAppearance, useUiText } from './Appearance'

const emptyWord = () => ({ word: '', meaning: '', notes: '', part_of_speech: '动词', tags: [] })

export default function ReviewSentenceTools({ sentence, onUpdate, onDelete, onSavingChange }) {
  const t = useUiText()
  const { workbench } = useAppearance()
  const [editingOriginal, setEditingOriginal] = useState(false)
  const [original, setOriginal] = useState(sentence.target_text)
  const [editingTranslation, setEditingTranslation] = useState(false)
  const [translation, setTranslation] = useState(sentence.chinese_text)
  const [englishTranslation, setEnglishTranslation] = useState(sentence.english_text || '')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(sentence.notes || '')
  const [addingWord, setAddingWord] = useState(false)
  const [word, setWord] = useState(emptyWord)
  const [existingWords, setExistingWords] = useState([])
  const [saving, setSaving] = useState(false)
  const [confirmingTrash, setConfirmingTrash] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => { onSavingChange?.(saving) }, [saving, onSavingChange])
  useEffect(() => () => { onSavingChange?.(false) }, [onSavingChange])

  useEffect(() => {
    setEditingOriginal(false)
    setOriginal(sentence.target_text)
    setEditingTranslation(false)
    setTranslation(sentence.chinese_text)
    setEnglishTranslation(sentence.english_text || '')
    setEditingNotes(false)
    setNotes(sentence.notes || '')
    setAddingWord(false)
    setWord(emptyWord())
    setExistingWords([])
    setSaving(false)
    setConfirmingTrash(false)
    setError('')
    setNotice('')
  }, [sentence.id])

  const sentencePayload = (changes = {}) => ({
    chinese_text: sentence.chinese_text,
    english_text: sentence.english_text || '',
    target_text: sentence.target_text,
    language: sentence.language,
    notes: sentence.notes,
    mastery: sentence.mastery,
    tags: sentence.tags.map((tag) => tag.name),
    ...changes,
  })

  const saveTranslation = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      const updated = await api.put(`/sentences/${sentence.id}`, sentencePayload({ chinese_text: translation, english_text: englishTranslation }))
      onUpdate(updated); setTranslation(updated.chinese_text); setEnglishTranslation(updated.english_text || ''); setEditingTranslation(false); setNotice(workbench ? 'Translations saved.' : '翻译已保存。')
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const saveOriginal = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      const updated = await api.put(`/sentences/${sentence.id}`, sentencePayload({ target_text: original }))
      onUpdate(updated); setOriginal(updated.target_text); setEditingOriginal(false); setNotice(t('句子原文已保存，当前标准答案已更新。'))
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const saveNotes = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      const updated = await api.put(`/sentences/${sentence.id}`, sentencePayload({ notes }))
      onUpdate(updated); setNotes(updated.notes); setEditingNotes(false); setNotice(t('句子注释已保存。'))
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const toggleWordForm = async () => {
    const next = !addingWord; setAddingWord(next); setError(''); setNotice('')
    if (next && existingWords.length === 0) {
      try { setExistingWords(await api.get(`/words?language=${sentence.language}`)) }
      catch (err) { setError(err.message) }
    }
  }

  const reloadSentence = async () => {
    const updated = await api.get(`/sentences/${sentence.id}`)
    onUpdate(updated)
    return updated
  }

  const addWord = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      const result = await api.post(`/sentences/${sentence.id}/words`, {
        ...word,
        language: sentence.language,
        mastery: 'unknown',
        source_sentence_ids: [],
      })
      const reused = existingWords.some((entry) => entry.id === result.id)
      const alreadyLinked = sentence.words.some((entry) => entry.id === result.id)
      await reloadSentence()
      setExistingWords(await api.get(`/words?language=${sentence.language}`))
      setWord(emptyWord())
      setNotice(workbench ? alreadyLinked ? `“${result.word}” is already linked.` : `“${result.word}” saved and linked.` : alreadyLinked ? `“${result.word}”已经与这句话关联。` : reused ? `已关联词库中的“${result.word}”。` : `“${result.word}”已加入词库并关联当前句子。`)
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const linkWord = async (entry) => {
    setSaving(true); setError(''); setNotice('')
    try {
      await api.post(`/sentences/${sentence.id}/words/${entry.id}`, {})
      await reloadSentence(); setWord(emptyWord()); setNotice(workbench ? `“${entry.word}” linked to this sentence.` : `已关联词库中的“${entry.word}”。`)
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  const moveToTrash = () => {
    setConfirmingTrash(false); setError(''); setNotice('')
    onDelete(sentence)
  }

  return <section className="review-study-tools">
    <div className="review-study-heading">
      <div>
        <div><span>{workbench ? 'Edit This Sentence' : '复习时补充'}</span><small>{workbench ? 'Changes are saved to your library' : '修改内容会同步保存到句子库'}</small></div>
        {!confirmingTrash && <button type="button" className="review-trash-button" disabled={saving} onClick={() => setConfirmingTrash(true)}>{t('移至回收站')}</button>}
      </div>
      {confirmingTrash && <div className="review-trash-confirm" role="alert">
        <span>{t('确定把这句话移至回收站吗？')}</span>
        <div><button type="button" className="button button-small button-quiet" onClick={() => setConfirmingTrash(false)}>{t('取消')}</button><button type="button" className="button button-small button-danger" onClick={moveToTrash}>{t('确认移至回收站')}</button></div>
      </div>}
      <div>
        <button type="button" aria-expanded={editingOriginal} className={`button button-small button-quiet ${editingOriginal ? 'active' : ''}`} onClick={() => { setEditingOriginal(!editingOriginal); setOriginal(sentence.target_text); setError(''); setNotice('') }}>{editingOriginal ? t('收起原文') : t('修改原文')}</button>
        <button type="button" aria-expanded={editingTranslation} className={`button button-small button-quiet ${editingTranslation ? 'active' : ''}`} onClick={() => { setEditingTranslation(!editingTranslation); setTranslation(sentence.chinese_text); setEnglishTranslation(sentence.english_text || ''); setError(''); setNotice('') }}>{workbench ? editingTranslation ? 'Close Translations' : 'Edit Translations' : editingTranslation ? '收起翻译' : '修改翻译'}</button>
        <button type="button" aria-expanded={editingNotes} className={`button button-small button-quiet ${editingNotes ? 'active' : ''}`} onClick={() => { setEditingNotes(!editingNotes); setNotes(sentence.notes || ''); setError(''); setNotice('') }}>{editingNotes ? t('收起注释') : sentence.notes ? t('修改注释') : t('添加注释')}</button>
        <button type="button" aria-expanded={addingWord} className={`button button-small button-quiet ${addingWord ? 'active' : ''}`} onClick={toggleWordForm}>{addingWord ? t('收起单词') : t('关联单词')}</button>
      </div>
    </div>
    <ErrorMessage message={error} />
    {notice && <div className="success-banner">{notice}</div>}

    {editingOriginal && <form className="review-note-form" onSubmit={saveOriginal}>
      <label><span>{t('句子原文')}</span><textarea required autoFocus rows="3" lang={sentence.language} value={original} onChange={(event) => setOriginal(event.target.value)} placeholder={t('输入正确的目标语言原文。')} /></label>
      <p className="source-note">{t('保存后，上方的标准答案和差异高亮会立即按照新原文重新计算。')}</p>
      <div className="form-actions"><button type="button" className="button button-small button-quiet" onClick={() => { setEditingOriginal(false); setOriginal(sentence.target_text) }}>{t('取消')}</button><button className="button button-small button-primary" disabled={saving || !original.trim()}>{saving ? t('保存中…') : t('保存原文')}</button></div>
    </form>}

    {editingTranslation && <form className="review-note-form" onSubmit={saveTranslation}>
      <label><span>{t('中文翻译')}</span><textarea required autoFocus rows="3" value={translation} onChange={(event) => setTranslation(event.target.value)} placeholder={t('输入这句话的中文翻译。')} /></label>
      {sentence.language === 'es' && <label><span>{workbench ? 'English Translation (optional)' : '英文翻译（可选）'}</span><textarea rows="3" lang="en" value={englishTranslation} onChange={(event) => setEnglishTranslation(event.target.value)} placeholder="Enter the English translation." /></label>}
      <div className="form-actions"><button type="button" className="button button-small button-quiet" onClick={() => { setEditingTranslation(false); setTranslation(sentence.chinese_text) }}>{t('取消')}</button><button className="button button-small button-primary" disabled={saving || !translation.trim()}>{saving ? t('保存中…') : t('保存翻译')}</button></div>
    </form>}

    {editingNotes ? <form className="review-note-form" onSubmit={saveNotes}>
      <label><span>{t('句子注释 / 讲解')}</span><textarea autoFocus rows="4" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t('记录语法、语感、使用场景或容易写错的地方。')} /></label>
      <div className="form-actions"><button type="button" className="button button-small button-quiet" onClick={() => { setEditingNotes(false); setNotes(sentence.notes || '') }}>{t('取消')}</button><button className="button button-small button-primary" disabled={saving}>{saving ? t('保存中…') : t('保存注释')}</button></div>
    </form> : sentence.notes && <div className="context-box notes-context"><span>{t('注释 / 讲解')}</span><p>{sentence.notes}</p></div>}

    {addingWord && <form className="review-word-form" onSubmit={addWord}>
      <div className="form-row"><label><span>{t('单词')}</span><input required autoFocus value={word.word} onChange={(event) => setWord({ ...word, word: event.target.value })} placeholder={t('例如：別れます（わかれます）')} /></label><label><span>{t('中文意思')}</span><input required value={word.meaning} onChange={(event) => setWord({ ...word, meaning: event.target.value })} placeholder={t('例如：分手')} /></label></div>
      {word.word.trim() && <ExistingWordMatches words={existingWords} linkedIds={new Set(sentence.words.map((entry) => entry.id))} query={word.word} onLink={linkWord} saving={saving} />}
      <label><span>{t('单词注释 / 讲解')} <small>{t('可选')}</small></span><textarea rows="3" value={word.notes} onChange={(event) => setWord({ ...word, notes: event.target.value })} placeholder={t('记录变形、搭配、语感或容易混淆的用法。')} /></label>
      <div className="form-row"><label><span>{t('词性')}</span><select value={word.part_of_speech} onChange={(event) => setWord({ ...word, part_of_speech: event.target.value })}>{PARTS_OF_SPEECH.map((part) => <option key={part} value={part}>{t(part)}</option>)}</select></label><label><span>{t('标签')}</span><TagInput value={word.tags} onChange={(tags) => setWord({ ...word, tags })} /></label></div>
      <p className="source-note"><b>{t('来源句：')}</b>{sentence.target_text}</p>
      <div className="form-actions"><button type="button" className="button button-small button-quiet" onClick={() => setAddingWord(false)}>{t('完成')}</button><button className="button button-small button-primary" disabled={saving}>{saving ? t('保存中…') : t('保存并继续添加')}</button></div>
    </form>}

    {sentence.words.length > 0 && <div className="context-box review-linked-words"><span>{t('这句话中的单词')}</span><div className="tag-list">{sentence.words.map((entry) => <span className="tag" key={entry.id}>{entry.word} · {entry.meaning}</span>)}</div></div>}
  </section>
}

function ExistingWordMatches({ words, linkedIds, query, onLink, saving }) {
  const t = useUiText()
  const normalized = query.trim().toLocaleLowerCase()
  const matches = words.filter((entry) => !linkedIds.has(entry.id) && entry.word.toLocaleLowerCase().includes(normalized)).slice(0, 5)
  if (!matches.length) return null
  const exact = matches.some((entry) => entry.word.trim().toLocaleLowerCase() === normalized)
  return <div className={`existing-words ${exact ? 'exact-match' : ''}`}><span>{exact ? t('这个单词已存在，请直接关联') : t('词库中可能已有')}</span>{matches.map((entry) => <div key={entry.id}><div><strong>{entry.word}</strong><small>{entry.meaning} · {t(entry.part_of_speech)}</small></div><button type="button" disabled={saving} onClick={() => onLink(entry)}>{t('关联已有单词')}</button></div>)}</div>
}
