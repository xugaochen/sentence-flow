import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, queryString } from '../api'
import AnswerDiff from '../components/AnswerDiff'
import ReviewSentenceTools from '../components/ReviewSentenceTools'
import SpeakButton from '../components/SpeakButton'
import { Empty, ErrorMessage, Loading } from '../components/Status'
import { LANGUAGES, PARTS_OF_SPEECH } from '../constants'
import { getReviewStartNotice, splitCurrentAndFutureMatches } from '../utils/reviewQueue'
import { normalizeAnswer } from '../utils/textDiff'

const REVIEW_MODES = [
  { value: 'smart', label: '智能间隔', markers: ['熟', '距', '次'], description: '综合熟练度、距离上次复习的时间和累计次数，并保留随机性。' },
  { value: 'weighted', label: '加权随机', markers: ['5', '3', '1'], description: '不会、模糊、会了按 5 / 3 / 1 加权，一轮内不会重复。' },
  { value: 'uniform', label: '均匀有放回', markers: ['=', '↻', '='], description: '每次等概率抽取，同一内容本轮可能再次出现，但候选超过一个时不会连续出现。' },
  { value: 'new_first', label: '新题优先', markers: ['新', '新', '旧'], description: '复习次数为 0 的内容严格排在前面，新题不足时再用旧题补足。' },
]

export default function Review({ type }) {
  const isSentence = type === 'sentences'
  const [phase, setPhase] = useState('setup')
  const [settings, setSettings] = useState({ language: '', tag: '', part_of_speech: '', limit: '10', mode: 'smart' })
  const [tags, setTags] = useState([]); const [items, setItems] = useState([]); const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState(''); const [submitted, setSubmitted] = useState(false); const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [trashStatus, setTrashStatus] = useState(null)
  const [questionInstance, setQuestionInstance] = useState(0)
  const [results, setResults] = useState({ unknown: 0, fuzzy: 0, known: 0, skipped: 0 }); const inputRef = useRef(null)
  const activeRunRef = useRef(0)
  const itemsRef = useRef(items)
  const phaseRef = useRef(phase)
  itemsRef.current = items
  phaseRef.current = phase

  useEffect(() => { api.get(`/tags?kind=${isSentence ? 'sentence' : 'word'}`).then(setTags).catch(() => {}) }, [isSentence])
  useEffect(() => { activeRunRef.current += 1; setPhase('setup'); setItems([]); setIndex(0); setAnswer(''); setSubmitted(false); setError(''); setNotice(''); setTrashStatus(null) }, [type])
  const start = async (event) => {
    event.preventDefault(); activeRunRef.current += 1; setPhase('loading'); setError(''); setNotice(''); setTrashStatus(null); setItems([]); setIndex(0); setAnswer(''); setSubmitted(false); setQuestionInstance((value) => value + 1)
    const params = {
      language: settings.language,
      tag: settings.tag,
      limit: settings.limit === 'all' ? undefined : settings.limit,
      all_items: settings.limit === 'all' ? true : undefined,
      mode: settings.mode,
    }
    if (!isSentence) params.part_of_speech = settings.part_of_speech
    try {
      const data = await api.get(`/reviews/${type}${queryString(params)}`)
      setItems(data); setIndex(0); setResults({ unknown: 0, fuzzy: 0, known: 0, skipped: 0 }); setNotice(getReviewStartNotice(settings.mode, data)); setPhase(data.length ? 'review' : 'empty')
    } catch (err) { setError(err.message); setPhase('setup') }
  }
  const current = items[index]
  const expected = current ? (isSentence ? current.target_text : current.word) : ''
  const matches = normalizeAnswer(answer) === normalizeAnswer(expected)
  useLayoutEffect(() => {
    if (phase !== 'review' || submitted || !current) return undefined
    inputRef.current?.focus({ preventScroll: true })
    return undefined
  }, [phase, submitted, questionInstance])
  const submitAnswer = (event) => { event.preventDefault(); if (answer.trim()) { setNotice(''); setSubmitted(true) } }
  const updateCurrent = (updated) => setItems((previous) => previous.map((item) => item.id === updated.id ? updated : item))
  const advance = (nextNotice = '') => {
    if (index + 1 >= items.length) {
      setNotice(''); setPhase('done')
    } else {
      setIndex(index + 1); setAnswer(''); setSubmitted(false); setError(''); setNotice(nextNotice)
      setQuestionInstance((value) => value + 1)
    }
  }
  const skip = () => {
    setResults((previous) => ({ ...previous, skipped: previous.skipped + 1 }))
    advance('上一题已跳过，没有记录复习结果。')
  }
  const removeCurrent = (sentence) => {
    const runId = activeRunRef.current
    const { remaining, removed } = splitCurrentAndFutureMatches(items, index, sentence.id)
    setItems(remaining); setAnswer(''); setSubmitted(false); setError('')
    setTrashStatus({ kind: 'pending', text: '正在后台移至回收站，你可以继续作答。' })
    setQuestionInstance((value) => value + 1)
    if (index >= remaining.length) {
      setNotice(''); setPhase('done')
    }
    else {
      setIndex(Math.min(index, remaining.length - 1)); setPhase('review')
      setNotice('')
    }
    void api.delete(`/sentences/${sentence.id}`).then(() => {
      if (activeRunRef.current === runId) setTrashStatus({ kind: 'success', text: '上一句话已移至回收站。' })
    }).catch((err) => {
      if (activeRunRef.current !== runId) return
      const restoredAt = itemsRef.current.length
      const restored = [...itemsRef.current, ...removed]
      itemsRef.current = restored
      setItems(restored)
      setTrashStatus({ kind: 'error', text: `移至回收站失败：${err.message}。题目已放回本轮末尾。` })
      if (phaseRef.current === 'done') {
        setIndex(restoredAt); setAnswer(''); setSubmitted(false); setPhase('review')
        setQuestionInstance((value) => value + 1)
      }
    })
  }
  const assess = async (mastery) => {
    try {
      const updated = await api.post(`/reviews/${type}/${current.id}`, { mastery })
      updateCurrent(updated)
      setNotice('')
      setResults((previous) => ({ ...previous, [mastery]: previous[mastery] + 1 }))
      advance()
    } catch (err) { setError(err.message) }
  }

  if (phase === 'loading') return <Loading />
  if (phase === 'setup') return <Setup isSentence={isSentence} settings={settings} setSettings={setSettings} tags={tags} start={start} error={error} />
  if (phase === 'empty') return <div className="review-page"><Empty title={isSentence ? '没有符合条件的句子' : '没有符合条件的单词'}>返回修改筛选条件，或先去收录一些内容。</Empty><div className="center"><button className="button button-primary" onClick={() => setPhase('setup')}>返回设置</button></div></div>
  if (phase === 'done') return <Done isSentence={isSentence} total={Object.values(results).reduce((sum, count) => sum + count, 0)} results={results} trashStatus={trashStatus} restart={() => setPhase('setup')} />

  return (
    <div className="review-page">
      <div className="review-topline"><button className="back-link plain-button" onClick={() => setPhase('setup')}>← 结束本轮</button><span>{index + 1} / {items.length}</span></div>
      <div className="progress"><span style={{ width: `${((index + (submitted ? 1 : 0)) / items.length) * 100}%` }} /></div>
      {notice && <div className="success-banner">{notice}</div>}
      {trashStatus?.kind === 'error' ? <ErrorMessage message={trashStatus.text} /> : trashStatus && <div className="success-banner">{trashStatus.text}</div>}
      <section className="review-card">
        <div className="review-label"><span>{isSentence ? '中文提示' : '中文意思'}</span><b>{LANGUAGES[current.language].label}</b></div>
        <h1>{isSentence ? current.chinese_text : current.meaning}</h1>
        {!submitted ? <form key={`${type}-${current.id}-${index}-${questionInstance}`} onSubmit={submitAnswer} className="answer-form">
          <label htmlFor="answer">请输入完整{isSentence ? LANGUAGES[current.language].label + '句子' : LANGUAGES[current.language].label}</label>
          {isSentence ? <textarea id="answer" ref={inputRef} autoFocus rows="4" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="在这里写下你的答案…" onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submitAnswer(e) }} /> : <input id="answer" ref={inputRef} autoFocus value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="在这里写下你的答案…" />}
          <p className="input-hint">{isSentence ? 'Ctrl + Enter 提交' : 'Enter 提交'} · 提交前不会显示答案</p>
          <button className="button button-primary button-wide" disabled={!answer.trim()}>提交答案 <span>→</span></button>
          <button type="button" className="review-skip-button" onClick={skip}>暂时跳过此题 <span>→</span></button>
        </form> : <div className="answer-result">
          <AnswerDiff actual={answer} expected={expected} />
          <div className={`match-result ${matches ? 'match' : 'mismatch'}`}>{matches ? '✓ 完全一致' : '请对照高亮部分检查差异'}</div>
          <div className="answer-tools"><SpeakButton text={expected} language={current.language} label={isSentence ? '朗读标准答案' : '朗读单词'} /></div>
          {isSentence ? <ReviewSentenceTools sentence={current} onUpdate={updateCurrent} onDelete={removeCurrent} /> : <>
            {current.notes && <div className="context-box notes-context"><span>注释 / 讲解</span><p>{current.notes}</p></div>}
            {current.sentences?.length > 0 && <div className="context-box"><span>来源句</span>{current.sentences.map((sentence) => <div key={sentence.id}><p lang={sentence.language}>{sentence.target_text}</p><small>{sentence.chinese_text}</small>{sentence.notes && <small className="source-notes">讲解：{sentence.notes}</small>}</div>)}</div>}
          </>}
          <div className="assessment"><p>这一次，你掌握得怎么样？</p><div><button className="assess-unknown" onClick={() => assess('unknown')}><b>不会</b><small>需要多出现</small></button><button className="assess-fuzzy" onClick={() => assess('fuzzy')}><b>模糊</b><small>想起来但不稳</small></button><button className="assess-known" onClick={() => assess('known')}><b>会了</b><small>可以主动说出</small></button></div></div>
        </div>}
        <ErrorMessage message={error} />
      </section>
    </div>
  )
}

function Setup({ isSentence, settings, setSettings, tags, start, error }) {
  const selectedMode = REVIEW_MODES.find((mode) => mode.value === settings.mode) || REVIEW_MODES[0]
  return <div className="review-page setup-page">
    <div className="page-title"><p className="eyebrow">{isSentence ? 'SENTENCE REVIEW' : 'WORD REVIEW'}</p><h1>{isSentence ? '句子复习' : '单词复习'}</h1><p>{isSentence ? '只看中文，主动写出完整句子。' : '从中文回忆单词，提交后查看原句。'}</p></div>
    <form className="setup-card" onSubmit={start}>
      <ErrorMessage message={error} />
      <fieldset><legend>语言</legend><div className="choice-row">{[['', { label: '全部' }], ...Object.entries(LANGUAGES)].map(([value, item]) => <button type="button" className={settings.language === value ? 'active' : ''} key={value || 'all'} onClick={() => setSettings({ ...settings, language: value })}>{item.label}</button>)}</div></fieldset>
      {!isSentence && <label><span>词性</span><select value={settings.part_of_speech} onChange={(e) => setSettings({ ...settings, part_of_speech: e.target.value })}><option value="">全部词性</option>{PARTS_OF_SPEECH.map((part) => <option key={part}>{part}</option>)}</select></label>}
      <label><span>标签</span><select value={settings.tag} onChange={(e) => setSettings({ ...settings, tag: e.target.value })}><option value="">全部标签</option>{tags.map((tag) => <option key={tag}>{tag}</option>)}</select></label>
      <fieldset><legend>抽题方式</legend><div className="review-mode-grid">{REVIEW_MODES.map((mode) => <button type="button" className={settings.mode === mode.value ? 'active' : ''} key={mode.value} onClick={() => setSettings({ ...settings, mode: mode.value })}>{mode.label}</button>)}</div></fieldset>
      <fieldset><legend>本轮数量</legend><div className="choice-row">{[['10', '10'], ['20', '20'], ['30', '30'], ['all', '不限']].map(([value, label]) => <button type="button" className={settings.limit === value ? 'active' : ''} key={value} onClick={() => setSettings({ ...settings, limit: value })}>{label}</button>)}</div></fieldset>
      <div className="weight-note">{selectedMode.markers.map((marker, index) => <span key={`${marker}-${index}`}>{marker}</span>)}<p>{selectedMode.description}</p></div>
      <button className="button button-primary button-wide">开始复习 <span>→</span></button>
    </form>
  </div>
}

function Done({ isSentence, total, results, trashStatus, restart }) {
  const reviewed = total - results.skipped
  return <div className="review-page done-page"><div className="done-mark">✓</div><p className="eyebrow">SESSION COMPLETE</p><h1>本轮完成</h1>{trashStatus?.kind === 'error' ? <ErrorMessage message={trashStatus.text} /> : trashStatus && <div className="success-banner">{trashStatus.text}</div>}<p>完成了 {reviewed} 次主动回忆{results.skipped ? `，跳过 ${results.skipped} 题` : ''}。</p><div className="result-stats"><div><strong>{results.unknown}</strong><span>不会</span></div><div><strong>{results.fuzzy}</strong><span>模糊</span></div><div><strong>{results.known}</strong><span>会了</span></div><div><strong>{results.skipped}</strong><span>跳过</span></div></div><div className="hero-actions"><button className="button button-primary" onClick={restart}>再来一轮</button><Link className="button button-quiet" to={isSentence ? '/sentences' : '/words'}>返回{isSentence ? '句子' : '单词'}库</Link></div></div>
}
