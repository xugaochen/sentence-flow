import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAppearance } from '../components/Appearance'

export default function Home() {
  const { workbench, toggleAppearance } = useAppearance()
  const [stats, setStats] = useState({ sentence_total: 0, sentence_ja: 0, sentence_es: 0, sentence_en: 0, word_total: 0, word_ja: 0, word_es: 0, word_en: 0, reviewed_today: 0, reviewed_sentences_today: 0, reviewed_words_today: 0 })
  useEffect(() => { api.get('/stats').then(setStats).catch(() => {}) }, [])

  return (
    <div>
      <section className="hero">
        <p className="eyebrow">{workbench ? 'YOUR WORKSPACE' : 'ACTIVE RECALL · 主动输出'}</p>
        <h1>{workbench ? 'Welcome back' : <>把想说的话，<br /><em>练成自己的语言。</em></>}</h1>
        <p className="hero-copy">{workbench ? 'Review sentences, practice words, and keep your notes in one place.' : '以主动输出为核心，反复练习真正想表达的句子。单词始终留在语境里。'}</p>
        <div className="hero-actions">
          <Link className="button button-primary" to="/review/sentences">{workbench ? 'Start Sentence Review' : '开始句子复习'} <span>→</span></Link>
          <Link className="button button-quiet" to="/sentences/new">{workbench ? '+ Add Sentence' : '添加新句子'}</Link>
          <button type="button" className="button button-quiet appearance-toggle" onClick={toggleAppearance} aria-pressed={workbench}>{workbench ? 'Standard View' : '⌘ 工作台模式'}</button>
        </div>
        {!workbench && <p className="appearance-intro">工作台模式：换成代码编辑器风格，功能和学习进度保持不变。</p>}
      </section>

      <section className="stats-grid" aria-label="学习统计">
        <div className="stat stat-featured"><span>{workbench ? 'Answers Today' : '今日作答'}</span><strong>{stats.reviewed_today}</strong><small>{workbench ? `${stats.reviewed_sentences_today} sentences · ${stats.reviewed_words_today} words reviewed` : `今日覆盖 ${stats.reviewed_sentences_today} 个句子、${stats.reviewed_words_today} 个单词；共作答 ${stats.reviewed_today} 次`}</small></div>
        <div className="stat"><span>{workbench ? 'Total Sentences' : '句子总数'}</span><strong>{stats.sentence_total}</strong><small>{workbench ? `${stats.sentence_ja} Japanese · ${stats.sentence_es} Spanish · ${stats.sentence_en} English` : `${stats.sentence_ja} 日语 · ${stats.sentence_es} 西语 · ${stats.sentence_en} 英语`}</small></div>
        <div className="stat"><span>{workbench ? 'Total Words' : '单词总数'}</span><strong>{stats.word_total}</strong><small>{workbench ? `${stats.word_ja} Japanese · ${stats.word_es} Spanish · ${stats.word_en} English` : `${stats.word_ja} 日语 · ${stats.word_es} 西语 · ${stats.word_en} 英语`}</small></div>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">TODAY</p><h2>{workbench ? 'What would you like to practice?' : '今天想练什么？'}</h2></div></div>
        <div className="action-grid">
          <Link to="/review/sentences" className="action-card accent-red"><span className="action-number">01</span><div><h3>{workbench ? 'Sentence Review' : '句子复习'}</h3><p>{workbench ? 'Read a translation and write the sentence' : '看翻译提示，完整写出目标语言'}</p></div><b>→</b></Link>
          <Link to="/review/words" className="action-card accent-blue"><span className="action-number">02</span><div><h3>{workbench ? 'Word Review' : '单词复习'}</h3><p>{workbench ? 'Practice words in context' : '巩固词汇，提交后回到原句'}</p></div><b>→</b></Link>
          <Link to="/sentences" className="action-card"><span className="action-number">03</span><div><h3>{workbench ? 'Sentence Library' : '浏览句子库'}</h3><p>{workbench ? 'Browse, search, and edit sentences' : '搜索、筛选和整理你的表达'}</p></div><b>→</b></Link>
        </div>
      </section>
    </div>
  )
}
