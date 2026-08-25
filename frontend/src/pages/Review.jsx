import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, queryString } from '../api'
import AnswerDiff from '../components/AnswerDiff'
import SpeakButton from '../components/SpeakButton'
import { Empty, ErrorMessage, Loading } from '../components/Status'
import { LANGUAGES, PARTS_OF_SPEECH } from '../constants'
import { normalizeAnswer } from '../utils/textDiff'

export default function Review({ type }) {
  const isSentence = type === 'sentences'
  const [phase, setPhase] = useState('setup')
  const [settings, setSettings] = useState({ language: '', tag: '', part_of_speech: '', limit: '10' })
  const [tags, setTags] = useState([]); const [items, setItems] = useState([]); const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState(''); const [submitted, setSubmitted] = useState(false); const [error, setError] = useState('')
  const [results, setResults] = useState({ unknown: 0, fuzzy: 0, known: 0 }); const inputRef = useRef(null)

  useEffect(() => { api.get(`/tags?kind=${isSentence ? 'sentence' : 'word'}`).then(setTags).catch(() => {}) }, [isSentence])
  useEffect(() => { setPhase('setup'); setItems([]); setIndex(0); setAnswer(''); setSubmitted(false); setError('') }, [type])
  const start = async (event) => {
    event.preventDefault(); setPhase('loading'); setError('')
    const params = { language: settings.language, tag: settings.tag, limit: settings.limit === 'all' ? 1000 : settings.limit }
    if (!isSentence) params.part_of_speech = settings.part_of_speech
    try {
      const data = await api.get(`/reviews/${type}${queryString(params)}`)
      setItems(data); setIndex(0); setResults({ unknown: 0, fuzzy: 0, known: 0 }); setPhase(data.length ? 'review' : 'empty')
      setTimeout(() => inputRef.current?.focus(), 0)
    } catch (err) { setError(err.message); setPhase('setup') }
  }
  const current = items[index]
  const expected = current ? (isSentence ? current.target_text : current.word) : ''
  const matches = normalizeAnswer(answer) === normalizeAnswer(expected)
  const submitAnswer = (event) => { event.preventDefault(); if (answer.trim()) setSubmitted(true) }
  const assess = async (mastery) => {
    try {
      await api.post(`/reviews/${type}/${current.id}`, { mastery })
      setResults({ ...results, [mastery]: results[mastery] + 1 })
      if (index + 1 >= items.length) setPhase('done')
      else { setIndex(index + 1); setAnswer(''); setSubmitted(false); setTimeout(() => inputRef.current?.focus(), 0) }
    } catch (err) { setError(err.message) }
  }

  if (phase === 'loading') return <Loading />
  if (phase === 'setup') return <Setup isSentence={isSentence} settings={settings} setSettings={setSettings} tags={tags} start={start} error={error} />
  if (phase === 'empty') return <div className="review-page"><Empty title={isSentence ? '没有符合条件的句子' : '没有符合条件的单词'}>返回修改筛选条件，或先去收录一些内容。</Empty><div className="center"><button className="button button-primary" onClick={() => setPhase('setup')}>返回设置</button></div></div>
  if (phase === 'done') return <Done isSentence={isSentence} total={items.length} results={results} restart={() => setPhase('setup')} />

  return (
    <div className="review-page">
      <div className="review-topline"><button className="back-link plain-button" onClick={() => setPhase('setup')}>← 结束本轮</button><span>{index + 1} / {items.length}</span></div>
      <div className="progress"><span style={{ width: `${((index + (submitted ? 1 : 0)) / items.length) * 100}%` }} /></div>
      <section className="review-card">
        <div className="review-label"><span>{isSentence ? '中文提示' : '中文意思'}</span><b>{LANGUAGES[current.language].label}</b></div>
        <h1>{isSentence ? current.chinese_text : current.meaning}</h1>
        {!submitted ? <form onSubmit={submitAnswer} className="answer-form">
          <label htmlFor="answer">请输入完整{isSentence ? LANGUAGES[current.language].label + '句子' : LANGUAGES[current.language].label}</label>
          {isSentence ? <textarea id="answer" ref={inputRef} rows="4" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="在这里写下你的答案…" onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submitAnswer(e) }} /> : <input id="answer" ref={inputRef} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="在这里写下你的答案…" />}
          <p className="input-hint">{isSentence ? 'Ctrl + Enter 提交' : 'Enter 提交'} · 提交前不会显示答案</p>
          <button className="button button-primary button-wide" disabled={!answer.trim()}>提交答案 <span>→</span></button>
        </form> : <div className="answer-result">
          <AnswerDiff actual={answer} expected={expected} />
          <div className={`match-result ${matches ? 'match' : 'mismatch'}`}>{matches ? '✓ 完全一致' : '请对照高亮部分检查差异'}</div>
          <div className="answer-tools"><SpeakButton text={expected} language={current.language} label={isSentence ? '朗读标准答案' : '朗读单词'} /></div>
          {current.notes && <div className="context-box notes-context"><span>注释 / 讲解</span><p>{current.notes}</p></div>}
          {!isSentence && current.sentences?.length > 0 && <div className="context-box"><span>来源句</span>{current.sentences.map((sentence) => <div key={sentence.id}><p lang={sentence.language}>{sentence.target_text}</p><small>{sentence.chinese_text}</small>{sentence.notes && <small className="source-notes">讲解：{sentence.notes}</small>}</div>)}</div>}
          {isSentence && current.words?.length > 0 && <div className="context-box"><span>这句话中的单词</span><div className="tag-list">{current.words.map((word) => <span className="tag" key={word.id}>{word.word} · {word.meaning}</span>)}</div></div>}
          <div className="assessment"><p>这一次，你掌握得怎么样？</p><div><button className="assess-unknown" onClick={() => assess('unknown')}><b>不会</b><small>需要多出现</small></button><button className="assess-fuzzy" onClick={() => assess('fuzzy')}><b>模糊</b><small>想起来但不稳</small></button><button className="assess-known" onClick={() => assess('known')}><b>会了</b><small>可以主动说出</small></button></div></div>
        </div>}
        <ErrorMessage message={error} />
      </section>
    </div>
  )
}

function Setup({ isSentence, settings, setSettings, tags, start, error }) {
  return <div className="review-page setup-page">
    <div className="page-title"><p className="eyebrow">{isSentence ? 'SENTENCE REVIEW' : 'WORD REVIEW'}</p><h1>{isSentence ? '句子复习' : '单词复习'}</h1><p>{isSentence ? '只看中文，主动写出完整句子。' : '从中文回忆单词，提交后查看原句。'}</p></div>
    <form className="setup-card" onSubmit={start}>
      <ErrorMessage message={error} />
      <fieldset><legend>语言</legend><div className="choice-row">{[['', '全部'], ['ja', '日语'], ['es', '西班牙语']].map(([value, label]) => <button type="button" className={settings.language === value ? 'active' : ''} key={label} onClick={() => setSettings({ ...settings, language: value })}>{label}</button>)}</div></fieldset>
      {!isSentence && <label><span>词性</span><select value={settings.part_of_speech} onChange={(e) => setSettings({ ...settings, part_of_speech: e.target.value })}><option value="">全部词性</option>{PARTS_OF_SPEECH.map((part) => <option key={part}>{part}</option>)}</select></label>}
      <label><span>标签</span><select value={settings.tag} onChange={(e) => setSettings({ ...settings, tag: e.target.value })}><option value="">全部标签</option>{tags.map((tag) => <option key={tag}>{tag}</option>)}</select></label>
      <fieldset><legend>本轮数量</legend><div className="choice-row">{[['10', '10'], ['20', '20'], ['30', '30'], ['all', '不限']].map(([value, label]) => <button type="button" className={settings.limit === value ? 'active' : ''} key={value} onClick={() => setSettings({ ...settings, limit: value })}>{label}</button>)}</div></fieldset>
      <div className="weight-note"><span>5</span><span>3</span><span>1</span><p>不会的内容会更常出现，模糊次之，会了最少。</p></div>
      <button className="button button-primary button-wide">开始复习 <span>→</span></button>
    </form>
  </div>
}

function Done({ isSentence, total, results, restart }) {
  return <div className="review-page done-page"><div className="done-mark">✓</div><p className="eyebrow">SESSION COMPLETE</p><h1>本轮完成</h1><p>你刚刚完成了 {total} 次主动回忆。</p><div className="result-stats"><div><strong>{results.unknown}</strong><span>不会</span></div><div><strong>{results.fuzzy}</strong><span>模糊</span></div><div><strong>{results.known}</strong><span>会了</span></div></div><div className="hero-actions"><button className="button button-primary" onClick={restart}>再来一轮</button><Link className="button button-quiet" to={isSentence ? '/sentences' : '/words'}>返回{isSentence ? '句子' : '单词'}库</Link></div></div>
}
