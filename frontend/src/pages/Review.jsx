import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, queryString } from '../api'
import AnswerDiff from '../components/AnswerDiff'
import ReviewSentenceTools from '../components/ReviewSentenceTools'
import SpeakButton from '../components/SpeakButton'
import { Empty, ErrorMessage, Loading } from '../components/Status'
import { LANGUAGES, PARTS_OF_SPEECH, PARTS_OF_SPEECH_EN } from '../constants'
import { canLeaveReview, splitCurrentAndFutureMatches } from '../utils/reviewQueue'
import { getReviewShortcut } from '../utils/reviewShortcuts'
import { normalizeAnswer } from '../utils/textDiff'
import { useAppearance } from '../components/Appearance'
import { reviewPromptLanguage, reviewPromptText } from '../utils/reviewPrompt'

const REVIEW_MODES = [
  { value: 'recent', label: '近期巩固', englishLabel: 'Recent Practice', description: '练习最近 7 天还不熟悉的内容，以及从未复习且尚未掌握的内容。先覆盖今天没练过的题，再安排第二遍。' },
  { value: 'older', label: '久未复习', englishLabel: 'Not Reviewed Recently', description: '回顾至少 7 天没复习的内容。间隔越久越优先，同一天数内随机；今天已经练过的题先休息。' },
]
const EMPTY_REASONS = {
  no_items: ['没有符合条件的内容', '可以更换语言或词性，或先去收录一些内容。'],
  all_known: ['近期内容已经会了', '已会的内容先休息；练过的内容距上次复习满 7 天后会进入“久未复习”。'],
  no_recent: ['暂时没有需要近期巩固的内容', '可以切换到“久未复习”，回顾一段时间没练过的内容。'],
  no_older: ['暂时没有久未复习的内容', '距上次复习满 7 天的内容才会进入这里，可以先练习“近期巩固”。'],
  daily_limit: ['今天已达到重复上限', '当前候选内容今天已经各完成两次，明天再来巩固吧。'],
  already_reviewed_today: ['这些内容今天已经复习过了', '今天先休息，或切换到“近期巩固”练习还不熟悉的内容。'],
  missing_translation: ['还没有可用的英文翻译', '请在句子编辑页填写英文翻译，或改用中文提示。'],
}
const WORKSPACE_EMPTY_REASONS = {
  no_items: ['Nothing to review', 'Change your filters or add some content.'],
  all_known: ['You know these already', 'Reviewed items become available again after 7 days.'],
  no_recent: ['No recent items to practice', 'Try reviewing items you have not practiced recently.'],
  no_older: ['Nothing is due after a break', 'Items appear here at least 7 days after their last review.'],
  daily_limit: ['Daily limit reached', 'You have reviewed each available item twice today. Come back tomorrow.'],
  already_reviewed_today: ['Already reviewed today', 'Try Recent Practice for items you are still learning.'],
  missing_translation: ['English translations are missing', 'Add English translations in the sentence editor, or use Chinese prompts.'],
}
const emptyResults = () => ({ unknown: 0, fuzzy: 0, known: 0, skipped: 0 })

export default function Review({ type }) {
  const { workbench } = useAppearance()
  const isSentence = type === 'sentences'
  const [phase, setPhaseState] = useState('setup')
  const [settings, setSettings] = useState({ language: '', prompt_language: 'zh', part_of_speech: '', limit: '10', mode: 'recent' })
  const [overview, setOverview] = useState(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [overviewError, setOverviewError] = useState('')
  const [items, setItems] = useState([])
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [trashStatus, setTrashStatus] = useState(null)
  const [questionInstance, setQuestionInstance] = useState(0)
  const [actionPending, setActionPending] = useState(false)
  const [editorPending, setEditorPending] = useState(false)
  const [results, setResults] = useState(emptyResults)
  const inputRef = useRef(null)
  const speakRef = useRef(null)
  const activeRunRef = useRef(0)
  const overviewRequestRef = useRef(0)
  const actionPendingRef = useRef(false)
  const itemsRef = useRef(items)
  const phaseRef = useRef(phase)
  itemsRef.current = items
  phaseRef.current = phase
  const setPhase = (nextPhase) => {
    // Trash requests finish independently of assessment; expose transitions
    // immediately so a failed deletion can restore a just-finished round.
    phaseRef.current = nextPhase
    setPhaseState(nextPhase)
  }
  const runId = activeRunRef.current
  const busy = actionPending || editorPending

  const promptLanguage = reviewPromptLanguage(type, settings)
  const overviewPath = `/reviews/${type}/overview${queryString({ language: settings.language, prompt_language: promptLanguage, part_of_speech: isSentence ? undefined : settings.part_of_speech })}`
  const refreshOverview = useCallback(async () => {
    const requestId = ++overviewRequestRef.current
    setOverviewLoading(true); setOverviewError('')
    try {
      const data = await api.get(overviewPath)
      if (requestId === overviewRequestRef.current) setOverview(data)
    } catch (err) {
      if (requestId === overviewRequestRef.current) {
        setOverview(null); setOverviewError(`${workbench ? 'Could not load review counts' : '复习概览加载失败'}: ${err.message}`)
      }
    } finally {
      if (requestId === overviewRequestRef.current) setOverviewLoading(false)
    }
  }, [overviewPath, workbench])

  useEffect(() => {
    activeRunRef.current += 1
    actionPendingRef.current = false
    setActionPending(false); setEditorPending(false); setPhase('setup')
    setItems([]); setIndex(0); setAnswer(''); setSubmitted(false)
    setError(''); setNotice(''); setTrashStatus(null); setOverview(null)
    return () => { activeRunRef.current += 1; overviewRequestRef.current += 1 }
  }, [type])

  useEffect(() => {
    if (!['setup', 'empty', 'done'].includes(phase)) return undefined
    setOverview(null)
    void refreshOverview()
    return () => { overviewRequestRef.current += 1 }
  }, [phase, refreshOverview])

  const start = async (event) => {
    event.preventDefault()
    const startingRun = ++activeRunRef.current
    actionPendingRef.current = false
    setActionPending(false); setEditorPending(false); setPhase('loading')
    setError(''); setNotice(''); setTrashStatus(null)
    setItems([]); setIndex(0); setAnswer(''); setSubmitted(false)
    setQuestionInstance((value) => value + 1)
    const params = {
      language: settings.language,
      prompt_language: promptLanguage,
      part_of_speech: isSentence ? undefined : settings.part_of_speech,
      limit: settings.limit === 'all' ? undefined : settings.limit,
      all_items: settings.limit === 'all' ? true : undefined,
      mode: settings.mode,
    }
    try {
      const [sessionResult, summaryResult] = await Promise.allSettled([
        api.get(`/reviews/${type}${queryString(params)}`),
        api.get(overviewPath),
      ])
      if (activeRunRef.current !== startingRun) return
      if (sessionResult.status === 'rejected') throw sessionResult.reason
      const data = sessionResult.value
      const summary = summaryResult.status === 'fulfilled' ? summaryResult.value : null
      setOverview(summary); setOverviewError(summary ? '' : `${workbench ? 'Could not load review counts' : '复习概览加载失败'}: ${summaryResult.reason.message}`); setOverviewLoading(false)
      setItems(data); setIndex(0); setResults(emptyResults())
      const messages = []
      if (settings.mode === 'recent' && summary) messages.push(summary.recent.round_kind === 'repeat' ? (workbench ? 'You have covered today’s first round. This is your second pass.' : '今天未练过的候选内容已覆盖，本轮是第二遍巩固。') : (workbench ? 'Items you have not practiced today come first.' : '本轮优先覆盖今天还没有练过的内容。'))
      if (settings.limit !== 'all' && data.length < Number(settings.limit)) messages.push(workbench ? `${data.length} items are available for this round.` : `当前可练 ${data.length} 题，本轮已相应缩短。`)
      setNotice(messages.join(' ')); setPhase(data.length ? 'review' : 'empty')
    } catch (err) {
      if (activeRunRef.current !== startingRun) return
      setError(err.message); setPhase('setup')
    }
  }

  const returnToSetup = () => {
    if (!canLeaveReview({ phase, actionPending, editorPending, actionLocked: actionPendingRef.current })) return
    actionPendingRef.current = false
    activeRunRef.current += 1
    setError(''); setNotice(''); setPhase('setup')
  }
  const switchMode = () => {
    setSettings((previous) => ({ ...previous, mode: previous.mode === 'recent' ? 'older' : 'recent' }))
    returnToSetup()
  }
  const current = items[index]
  const expected = (isSentence ? current?.target_text : current?.word) || ''
  const matches = normalizeAnswer(answer) === normalizeAnswer(expected)

  useLayoutEffect(() => {
    if (phase !== 'review' || submitted || !current) return undefined
    actionPendingRef.current = false
    setActionPending(false)
    inputRef.current?.focus({ preventScroll: true })
    return undefined
  }, [phase, submitted, questionInstance])

  const revealAnswer = () => {
    if (actionPendingRef.current || submitted) return
    setNotice(''); setError(''); setSubmitted(true)
  }
  const submitAnswer = (event) => { event.preventDefault(); if (answer.trim()) revealAnswer() }
  const updateCurrent = (updated) => {
    if (activeRunRef.current !== runId) return
    setItems((previous) => previous.map((item) => item.id === updated.id ? updated : item))
  }
  const advance = (nextNotice = '') => {
    if (index + 1 >= itemsRef.current.length) {
      setNotice(''); setPhase('done')
    } else {
      setIndex(index + 1); setAnswer(''); setSubmitted(false); setError(''); setNotice(nextNotice)
      setQuestionInstance((value) => value + 1)
    }
  }
  const skip = () => {
    if (actionPendingRef.current || submitted || editorPending) return
    actionPendingRef.current = true
    setResults((previous) => ({ ...previous, skipped: previous.skipped + 1 }))
    advance(workbench ? 'Skipped. No review result was recorded.' : '上一题已跳过，没有记录复习结果。')
  }
  const removeCurrent = (sentence) => {
    if (actionPendingRef.current || editorPending) return
    const deletingRun = activeRunRef.current
    const { remaining, removed } = splitCurrentAndFutureMatches(itemsRef.current, index, sentence.id)
    itemsRef.current = remaining
    setItems(remaining); setAnswer(''); setSubmitted(false); setError('')
    setTrashStatus({ kind: 'pending', text: workbench ? 'Moving to trash. You can keep answering.' : '正在后台移至回收站，你可以继续作答。' })
    setQuestionInstance((value) => value + 1)
    if (index >= remaining.length) {
      setNotice(''); setPhase('done')
    } else {
      setPhase('review'); setNotice('')
    }
    void api.delete(`/sentences/${sentence.id}`).then(() => {
      if (activeRunRef.current !== deletingRun) return
      setTrashStatus({ kind: 'success', text: workbench ? 'The previous sentence was moved to trash.' : '上一句话已移至回收站。' })
      if (phaseRef.current === 'done') void refreshOverview()
    }).catch((err) => {
      if (activeRunRef.current !== deletingRun) return
      const restoredAt = itemsRef.current.length
      const restored = [...itemsRef.current, ...removed]
      itemsRef.current = restored
      setItems(restored)
      setTrashStatus({ kind: 'error', text: workbench ? `Could not move to trash: ${err.message}. The item is back at the end of this round.` : `移至回收站失败：${err.message}。题目已放回本轮末尾。` })
      if (phaseRef.current === 'done') {
        actionPendingRef.current = false
        setActionPending(false)
        setIndex(restoredAt); setAnswer(''); setSubmitted(false); setPhase('review')
        setQuestionInstance((value) => value + 1)
      }
    })
  }
  const assess = async (mastery) => {
    if (actionPendingRef.current || editorPending || !submitted || !current) return
    const assessingRun = activeRunRef.current
    actionPendingRef.current = true
    setActionPending(true); setError('')
    try {
      const updated = await api.post(`/reviews/${type}/${current.id}`, { mastery })
      if (activeRunRef.current !== assessingRun) return
      updateCurrent(updated)
      setNotice('')
      setResults((previous) => ({ ...previous, [mastery]: previous[mastery] + 1 }))
      advance()
    } catch (err) {
      if (activeRunRef.current !== assessingRun) return
      actionPendingRef.current = false
      setError(err.message)
    } finally {
      if (activeRunRef.current === assessingRun) setActionPending(false)
    }
  }

  useEffect(() => {
    if (phase !== 'review') return undefined
    const handleShortcut = (event) => {
      const shortcut = getReviewShortcut(event, {
        submitted, isSentence, hasAnswer: Boolean(answer.trim()), busy: actionPendingRef.current || editorPending,
      })
      if (!shortcut) return
      event.preventDefault(); event.stopPropagation()
      if (shortcut.type === 'submit') submitAnswer(event)
      else if (shortcut.type === 'reveal') revealAnswer()
      else if (shortcut.type === 'skip') skip()
      else if (shortcut.type === 'assess') void assess(shortcut.mastery)
      else if (shortcut.type === 'speak') speakRef.current?.toggle()
    }
    document.addEventListener('keydown', handleShortcut)
    return () => document.removeEventListener('keydown', handleShortcut)
  }, [phase, submitted, isSentence, answer, current?.id, index, items.length, editorPending, workbench])

  if (phase === 'loading') return <Loading />
  if (phase === 'setup') return <Setup isSentence={isSentence} settings={settings} setSettings={setSettings} start={start} error={error} overview={overview} overviewLoading={overviewLoading} overviewError={overviewError} retry={refreshOverview} switchMode={switchMode} />
  if (phase === 'empty') return <div className="review-page">
    <EmptyState info={overview?.[settings.mode]} loading={overviewLoading} />
    <OverviewError message={overviewError} retry={refreshOverview} />
    <div className="hero-actions"><button className="button button-primary" onClick={switchMode}>{workbench ? 'Try the other review mode' : `切换到${settings.mode === 'recent' ? '久未复习' : '近期巩固'}`}</button><button className="button button-quiet" onClick={returnToSetup}>{workbench ? 'Back to Settings' : '返回设置'}</button></div>
  </div>
  if (phase === 'done') return <Done isSentence={isSentence} results={results} trashStatus={trashStatus} restart={returnToSetup} overview={overview} overviewLoading={overviewLoading} overviewError={overviewError} retry={refreshOverview} mode={settings.mode} switchMode={switchMode} />

  return (
    <div className="review-page">
      <div className="review-topline"><button className="back-link plain-button" disabled={busy} onClick={returnToSetup}>{workbench ? '← End Round' : '← 结束本轮'}</button><span>{workbench && 'Question '}{index + 1} / {items.length}</span></div>
      <div className="progress"><span style={{ width: `${((index + (submitted ? 1 : 0)) / items.length) * 100}%` }} /></div>
      {notice && <div className="success-banner">{notice}</div>}
      {trashStatus?.kind === 'error' ? <ErrorMessage message={trashStatus.text} /> : trashStatus && <div className="success-banner">{trashStatus.text}</div>}
      <section className="review-card">
        <div className="review-label"><span>{workbench ? (promptLanguage === 'en' ? 'English Prompt' : 'Chinese Prompt') : promptLanguage === 'en' ? '英文提示' : isSentence ? '中文提示' : '中文意思'}</span><b>{workbench ? `Answer in ${LANGUAGES[current.language].englishLabel}` : LANGUAGES[current.language].label}</b></div>
        <h1 lang={promptLanguage === 'en' ? 'en' : 'zh'}>{reviewPromptText(current, type, promptLanguage) || (workbench ? 'Translation missing. Skip this question and add a translation.' : '缺少译文，请跳过并补充翻译。')}</h1>
        {!submitted ? <form key={`${type}-${current.id}-${index}-${questionInstance}`} onSubmit={submitAnswer} className="answer-form">
          <label htmlFor="answer">{workbench ? 'Your Answer' : `请输入完整${LANGUAGES[current.language].label}${isSentence ? '句子' : ''}`}</label>
          {isSentence ? <textarea id="answer" ref={inputRef} autoFocus rows="4" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={workbench ? 'Type your answer here…' : '在这里写下你的答案…'} /> : <input id="answer" ref={inputRef} autoFocus value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={workbench ? 'Type your answer here…' : '在这里写下你的答案…'} />}
          <p className="input-hint">{isSentence ? 'Ctrl/Cmd + Enter' : 'Enter / Ctrl/Cmd + Enter'} {workbench ? 'Submit' : '提交'} · Ctrl/Cmd + / {workbench ? 'Show Answer' : '查看答案'} · Ctrl/Cmd + Shift + Enter {workbench ? 'Skip' : '跳过'}</p>
          <button className="button button-primary button-wide" disabled={!answer.trim()}>{workbench ? 'Check Answer' : '提交答案'} <span>→</span></button>
          <div className="review-answer-alternatives"><button type="button" className="review-reveal-button" aria-keyshortcuts="Control+/ Meta+/" title={workbench ? 'Show Answer (Ctrl/Cmd + /)' : '想不起来，查看答案（Ctrl/Cmd + /）'} onClick={revealAnswer}>{workbench ? 'Show Answer' : '想不起来，查看答案'} <kbd>Ctrl/Cmd + /</kbd></button><button type="button" className="review-skip-button" onClick={skip}>{workbench ? 'Skip Question' : '暂时跳过此题'} <span>→</span></button></div>
        </form> : <div className="answer-result">
          <AnswerDiff actual={answer} expected={expected} />
          <div className={`match-result ${matches ? 'match' : 'mismatch'}`}>{workbench ? (!answer.trim() ? 'Read the correct answer, then rate how well you know it.' : matches ? '✓ Exact match' : 'Compare the highlighted differences.') : !answer.trim() ? '先看看标准答案，再如实选择这次的掌握程度。' : matches ? '✓ 完全一致' : '请对照高亮部分检查差异'}</div>
          <div className="answer-tools"><small className="answer-shortcut-hint">{workbench ? 'R　Play / Stop' : 'R　朗读 / 停止'}</small><SpeakButton ref={speakRef} text={expected} language={current.language} label={workbench ? 'Read Aloud' : isSentence ? '朗读标准答案' : '朗读单词'} /></div>
          {isSentence ? <fieldset className="review-tools-lock" disabled={actionPending} aria-label="句子编辑"><ReviewSentenceTools key={`${current.id}-${questionInstance}`} sentence={current} onUpdate={updateCurrent} onDelete={removeCurrent} onSavingChange={setEditorPending} /></fieldset> : <>
            {current.notes && <div className="context-box notes-context"><span>{workbench ? 'Notes' : '注释 / 讲解'}</span><p>{current.notes}</p></div>}
            {current.sentences?.length > 0 && <div className="context-box"><span>{workbench ? 'Source Sentences' : '来源句'}</span>{current.sentences.map((sentence) => <div key={sentence.id}><p lang={sentence.language}>{sentence.target_text}</p><small>{sentence.chinese_text}</small>{sentence.notes && <small className="source-notes">{sentence.notes}</small>}</div>)}</div>}
          </>}
          <div className="assessment"><p>{workbench ? (busy ? 'Saving changes…' : 'How well do you know it? Press 1, 2 or 3 to continue.') : editorPending ? '正在保存句子修改…' : actionPending ? '正在记录本次复习…' : '这一次，你掌握得怎么样？按数字键可直接进入下一题。'}</p><div><button className="assess-known" disabled={busy} onClick={() => assess('known')}><b>{workbench ? '1　Know it' : '1　会了'}</b><small>{workbench ? 'I can say it myself' : '可以主动说出'}</small></button><button className="assess-fuzzy" disabled={busy} onClick={() => assess('fuzzy')}><b>{workbench ? '2　Unsure' : '2　模糊'}</b><small>{workbench ? 'I need more practice' : '想起来但不稳'}</small></button><button className="assess-unknown" disabled={busy} onClick={() => assess('unknown')}><b>{workbench ? '3　Not yet' : '3　不会'}</b><small>{workbench ? 'I could not recall it' : '还需要巩固'}</small></button></div></div>
        </div>}
        <ErrorMessage message={error} />
      </section>
    </div>
  )
}

function TodayCoverage({ today, loading, filtered = false }) {
  const { workbench } = useAppearance()
  if (loading) return <p className="review-today" role="status">{workbench ? 'Updating today’s progress…' : '正在更新今日复习…'}</p>
  if (!today) return null
  if (workbench) return <p className="review-today">{filtered && 'With these filters · '}Today: <b>{today.sentence_count}</b> sentences, <b>{today.word_count}</b> words · <b>{today.review_count}</b> answers in total.</p>
  return <p className="review-today">{filtered && <small>当前筛选范围 · </small>}今日覆盖 <b>{today.sentence_count}</b> 个句子、<b>{today.word_count}</b> 个单词；共作答 <b>{today.review_count}</b> 次。</p>
}

function OverviewError({ message, retry }) {
  const { workbench } = useAppearance()
  if (!message) return null
  return <div className="review-overview-error"><ErrorMessage message={message} /><button type="button" className="plain-button" onClick={() => void retry()}>{workbench ? 'Try Again' : '重新加载'}</button></div>
}

function EmptyState({ info, loading }) {
  const { workbench } = useAppearance()
  if (loading) return <p className="review-mode-note" role="status">{workbench ? 'Checking available items…' : '正在检查可练内容…'}</p>
  const [title, description] = (workbench ? WORKSPACE_EMPTY_REASONS : EMPTY_REASONS)[info?.empty_reason] || (workbench ? ['Nothing to review this round', 'Change your filters or try the other review mode.'] : ['本轮没有可练内容', '可以返回设置，调整筛选条件或切换复习模式。'])
  return <Empty title={title}>{description}</Empty>
}

function Setup({ isSentence, settings, setSettings, start, error, overview, overviewLoading, overviewError, retry, switchMode }) {
  const { workbench } = useAppearance()
  const selectedMode = REVIEW_MODES.find((mode) => mode.value === settings.mode) || REVIEW_MODES[0]
  const info = overview?.[settings.mode]
  const isEmpty = !overviewLoading && info?.available_count === 0
  return <div className="review-page setup-page">
    <div className="page-title"><p className="eyebrow">PRACTICE</p><h1>{workbench ? (isSentence ? 'Sentence Review' : 'Word Review') : isSentence ? '句子复习' : '单词复习'}</h1><p>{workbench ? 'Read the prompt, write your answer, then rate your recall.' : isSentence ? '看翻译提示，主动写出完整句子。西语支持中文或英文提示。' : '从中文回忆单词，提交后查看原句。'}</p></div>
    <form className="setup-card" onSubmit={start}>
      <ErrorMessage message={error} />
      <fieldset><legend>{workbench ? 'Language' : '语言'}</legend><div className="choice-row">{[['', { label: '全部', englishLabel: 'All' }], ...Object.entries(LANGUAGES)].map(([value, item]) => <button type="button" className={settings.language === value ? 'active' : ''} key={value || 'all'} onClick={() => setSettings({ ...settings, language: value })}>{workbench ? item.englishLabel : item.label}</button>)}</div></fieldset>
      {isSentence && settings.language === 'es' && <fieldset><legend>{workbench ? 'Prompt Language' : '提示语言'}</legend><div className="choice-row">{[['zh', '中文 → 西语', 'Chinese → Spanish'], ['en', '英语 → 西语', 'English → Spanish']].map(([value, label, englishLabel]) => <button type="button" key={value} aria-pressed={settings.prompt_language === value} className={settings.prompt_language === value ? 'active' : ''} onClick={() => setSettings({ ...settings, prompt_language: value })}>{workbench ? englishLabel : label}</button>)}</div><p className="review-mode-note">{workbench ? 'Both prompt languages share your progress and daily limits.' : '两种提示方式共用熟练度、复习记录和每日次数。'}</p></fieldset>}
      {overview?.missing_english_count > 0 && <p className="review-mode-note" role="status">{workbench ? `${overview.missing_english_count} sentences have no English translation and are excluded. Add translations in the sentence editor or choose Chinese prompts.` : `${overview.missing_english_count} 条句子尚无英文翻译，已从英文提示模式中排除。可在句子编辑页补充，或改用中文提示。`}</p>}
      {!isSentence && <label><span>{workbench ? 'Part of Speech' : '词性'}</span><select value={settings.part_of_speech} onChange={(e) => setSettings({ ...settings, part_of_speech: e.target.value })}><option value="">{workbench ? 'All types' : '全部词性'}</option>{PARTS_OF_SPEECH.map((part) => <option key={part} value={part}>{workbench ? PARTS_OF_SPEECH_EN[part] : part}</option>)}</select></label>}
      <fieldset><legend>{workbench ? 'Review Mode' : '复习方式'}</legend><div className="review-mode-grid">{REVIEW_MODES.map((mode) => <button type="button" aria-pressed={settings.mode === mode.value} className={settings.mode === mode.value ? 'active' : ''} key={mode.value} onClick={() => setSettings({ ...settings, mode: mode.value })}><b>{workbench ? mode.englishLabel : mode.label}</b><small>{overviewLoading || !overview ? overviewError ? (workbench ? 'unavailable' : '暂时无法统计') : (workbench ? 'loading…' : '正在统计…') : workbench ? `${overview[mode.value].available_count} available` : `本轮可练 ${overview[mode.value].available_count} 题`}</small></button>)}</div></fieldset>
      <p className="review-mode-note">{workbench ? settings.mode === 'recent' ? 'Practice items you have not mastered: reviewed within 7 days or never reviewed. Items not practiced today come first.' : 'Review items last practiced at least 7 days ago, longest breaks first. Items completed today rest.' : selectedMode.description}</p>
      <TodayCoverage today={overview?.today} loading={overviewLoading} filtered />
      <OverviewError message={overviewError} retry={retry} />
      <fieldset><legend>{workbench ? 'Questions per Round' : '本轮数量'}</legend><div className="choice-row">{[['10', '10'], ['20', '20'], ['30', '30'], ['all', workbench ? 'All available' : '本轮全部']].map(([value, label]) => <button type="button" className={settings.limit === value ? 'active' : ''} key={value} onClick={() => setSettings({ ...settings, limit: value })}>{label}</button>)}</div></fieldset>
      <p className="review-mode-note">{workbench ? `No repeats within a round. Up to two completed reviews per item each day.${info?.round_kind === 'repeat' ? ' This is your second pass today.' : ''}` : <>每轮不重复，数量不足时自动缩短。{settings.mode === 'recent' ? info?.round_kind === 'repeat' ? '当前可练内容今天都已练过一遍，本轮安排第二遍；每题今天最多两次。' : '先覆盖今天没练过的内容；第二遍留到后续轮次，每题今天最多两次。' : '本轮只练习今天尚未完成、至少 7 天没复习的内容。'}</>}</p>
      {isEmpty && <><EmptyState info={info} /><button type="button" className="button button-quiet button-wide" onClick={switchMode}>{workbench ? 'Try the other review mode' : `切换到${settings.mode === 'recent' ? '久未复习' : '近期巩固'}`}</button></>}
      <button className="button button-primary button-wide" disabled={overviewLoading}>{workbench ? (isEmpty ? 'Check Again' : 'Start Review') : isEmpty ? '重新检查可练内容' : '开始复习'} <span>→</span></button>
    </form>
  </div>
}

function Done({ isSentence, results, trashStatus, restart, overview, overviewLoading, overviewError, retry, mode, switchMode }) {
  const { workbench } = useAppearance()
  const reviewed = results.unknown + results.fuzzy + results.known
  return <div className="review-page done-page">
    <div className="done-mark">✓</div><p className="eyebrow">SESSION COMPLETE</p><h1>{workbench ? 'Round Complete' : '本轮完成'}</h1>
    {trashStatus?.kind === 'error' ? <ErrorMessage message={trashStatus.text} /> : trashStatus && <div className="success-banner">{trashStatus.text}</div>}
    <p>{workbench ? `${reviewed} completed · ${results.skipped} skipped` : `完成了 ${reviewed} 次主动回忆，跳过 ${results.skipped} 题。`}</p>
    <TodayCoverage today={overview?.today} loading={overviewLoading} filtered /><OverviewError message={overviewError} retry={retry} />
    <div className="result-stats"><div><strong>{results.unknown}</strong><span>{workbench ? 'Not yet' : '不会'}</span></div><div><strong>{results.fuzzy}</strong><span>{workbench ? 'Unsure' : '模糊'}</span></div><div><strong>{results.known}</strong><span>{workbench ? 'Know it' : '会了'}</span></div><div><strong>{results.skipped}</strong><span>{workbench ? 'Skipped' : '跳过'}</span></div></div>
    <div className="hero-actions"><button className="button button-primary" onClick={restart}>{workbench ? 'Another Round' : '再来一轮'}</button><button className="button button-quiet" onClick={switchMode}>{workbench ? 'Try the other review mode' : `切换到${mode === 'recent' ? '久未复习' : '近期巩固'}`}</button><Link className="button button-quiet" to={isSentence ? '/sentences' : '/words'}>{workbench ? `Back to ${isSentence ? 'Sentence' : 'Word'} Library` : `返回${isSentence ? '句子' : '单词'}库`}</Link></div>
  </div>
}
