import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'

export default function Home() {
  const [stats, setStats] = useState({ sentence_total: 0, sentence_ja: 0, sentence_es: 0, sentence_en: 0, word_total: 0, word_ja: 0, word_es: 0, word_en: 0, reviewed_today: 0, reviewed_sentences_today: 0, reviewed_words_today: 0 })
  useEffect(() => { api.get('/stats').then(setStats).catch(() => {}) }, [])

  return (
    <div>
      <section className="hero">
        <p className="eyebrow">ACTIVE RECALL · 主动输出</p>
        <h1>把想说的话，<br /><em>练成自己的语言。</em></h1>
        <p className="hero-copy">以主动输出为核心，反复练习真正想表达的句子。单词始终留在语境里。</p>
        <div className="hero-actions">
          <Link className="button button-primary" to="/review/sentences">开始句子复习 <span>→</span></Link>
          <Link className="button button-quiet" to="/sentences/new">添加新句子</Link>
        </div>
      </section>

      <section className="stats-grid" aria-label="学习统计">
        <div className="stat stat-featured"><span>今日作答</span><strong>{stats.reviewed_today}</strong><small>今日覆盖 {stats.reviewed_sentences_today} 个句子、{stats.reviewed_words_today} 个单词；共作答 {stats.reviewed_today} 次</small></div>
        <div className="stat"><span>句子总数</span><strong>{stats.sentence_total}</strong><small>{stats.sentence_ja} 日语 · {stats.sentence_es} 西语 · {stats.sentence_en} 英语</small></div>
        <div className="stat"><span>单词总数</span><strong>{stats.word_total}</strong><small>{stats.word_ja} 日语 · {stats.word_es} 西语 · {stats.word_en} 英语</small></div>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">TODAY</p><h2>今天想练什么？</h2></div></div>
        <div className="action-grid">
          <Link to="/review/sentences" className="action-card accent-red"><span className="action-number">01</span><div><h3>句子复习</h3><p>看中文，完整写出目标语言</p></div><b>→</b></Link>
          <Link to="/review/words" className="action-card accent-blue"><span className="action-number">02</span><div><h3>单词复习</h3><p>巩固词汇，提交后回到原句</p></div><b>→</b></Link>
          <Link to="/sentences" className="action-card"><span className="action-number">03</span><div><h3>浏览句子库</h3><p>搜索、筛选和整理你的表达</p></div><b>→</b></Link>
        </div>
      </section>
    </div>
  )
}
