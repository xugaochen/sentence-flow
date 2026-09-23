import { useEffect, useState } from 'react'
import { api } from '../api'
import { Empty, ErrorMessage, Loading } from '../components/Status'
import { LANGUAGES } from '../constants'
import { useAppearance, useUiText } from '../components/Appearance'

function deletedDate(value, workbench) {
  return new Intl.DateTimeFormat(workbench ? 'en' : 'zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function DataManagement() {
  const t = useUiText()
  const { workbench } = useAppearance()
  const [trash, setTrash] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')

  const load = async () => {
    try { setTrash(await api.get('/trash')); setError('') } catch (err) { setError(err.message) }
  }
  useEffect(() => { void load() }, [])

  const restore = async (kind, id) => {
    setBusy(`${kind}-${id}`); setError(''); setNotice('')
    try {
      await api.post(`/trash/${kind}s/${id}/restore`, {})
      setNotice(kind === 'sentence' ? t('句子已恢复，原有单词关联也已恢复。') : t('单词已恢复，原有来源句关联也已恢复。'))
      await load()
    } catch (err) { setError(err.message) } finally { setBusy('') }
  }

  const purge = async (kind, id, label) => {
    if (!window.confirm(workbench ? `Permanently delete “${label}”? This cannot be undone.` : `永久删除“${label}”吗？此操作无法从回收站恢复。`)) return
    setBusy(`${kind}-${id}`); setError(''); setNotice('')
    try { await api.delete(`/trash/${kind}s/${id}`); setNotice(t('已永久删除。')); await load() }
    catch (err) { setError(err.message) } finally { setBusy('') }
  }

  const emptyTrash = async () => {
    if (!window.confirm(t('确定清空整个回收站吗？其中的句子、单词和对应复习记录将永久删除。'))) return
    setBusy('empty'); setError(''); setNotice('')
    try {
      const result = await api.delete('/trash')
      setNotice(workbench ? `Permanently deleted ${result.sentences} sentences and ${result.words} words.` : `已永久删除 ${result.sentences} 个句子和 ${result.words} 个单词。`)
      await load()
    } catch (err) { setError(err.message) } finally { setBusy('') }
  }

  const download = async (format) => {
    setBusy(`download-${format}`); setError(''); setNotice('')
    try {
      const { blob, filename } = await api.download(`/export/${format}`)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setNotice(workbench ? `${format === 'json' ? 'JSON' : 'CSV ZIP'} export downloaded.` : `已生成 ${format === 'json' ? 'JSON' : 'CSV ZIP'} 导出文件。`)
    } catch (err) { setError(err.message) } finally { setBusy('') }
  }

  if (!trash && !error) return <Loading />
  const sentenceCount = trash?.sentences.length || 0
  const wordCount = trash?.words.length || 0
  const total = sentenceCount + wordCount

  return <div className="data-page">
    <div className="library-header"><div className="page-title"><p className="eyebrow">DATA & SAFETY</p><h1>{workbench ? 'Data & Backup' : '数据管理'}</h1><p>{workbench ? 'Export your data or restore deleted items.' : '恢复误删内容，或导出一份不包含任何密钥的学习数据。'}</p></div></div>
    <ErrorMessage message={error} />
    {notice && <div className="success-banner">{notice}</div>}

    <section className="export-panel">
      <div><h2>{t('导出学习数据')}</h2><p>{t('JSON 保留完整关系；CSV 压缩包适合使用 Excel 或其他表格工具查看。')}</p></div>
      <div className="export-actions"><button className="button button-quiet" disabled={Boolean(busy)} onClick={() => download('json')}>{busy === 'download-json' ? t('正在生成…') : t('下载完整 JSON')}</button><button className="button button-primary" disabled={Boolean(busy)} onClick={() => download('csv')}>{busy === 'download-csv' ? t('正在生成…') : t('下载 CSV 压缩包')}</button></div>
    </section>

    <section className="trash-section">
      <div className="section-heading"><div><p className="eyebrow">TRASH</p><h2>{t('回收站')} <small>{total} {workbench ? 'items' : '项'}</small></h2></div>{total > 0 && <button className="button button-danger-quiet" disabled={Boolean(busy)} onClick={emptyTrash}>{busy === 'empty' ? t('正在清空…') : t('清空回收站')}</button>}</div>
      {!total ? <Empty title={t('回收站是空的')}>{t('删除的句子和单词会保留在这里，直到你手动永久删除。')}</Empty> : <>
        {sentenceCount > 0 && <div className="trash-group"><h3>{t('句子')}</h3>{trash.sentences.map((item) => <article className="trash-row" key={`sentence-${item.id}`}><span className="language-badge">{t(LANGUAGES[item.language].short)}</span><div><p>{item.chinese_text}</p><strong lang={item.language}>{item.target_text}</strong><small>{workbench ? 'Deleted' : '删除于'} {deletedDate(item.deleted_at, workbench)}</small></div><div className="trash-actions"><button disabled={Boolean(busy)} onClick={() => restore('sentence', item.id)}>{t('恢复')}</button><button className="text-danger" disabled={Boolean(busy)} onClick={() => purge('sentence', item.id, item.target_text)}>{t('永久删除')}</button></div></article>)}</div>}
        {wordCount > 0 && <div className="trash-group"><h3>{t('单词')}</h3>{trash.words.map((item) => <article className="trash-row" key={`word-${item.id}`}><span className="language-badge">{t(LANGUAGES[item.language].short)}</span><div><strong lang={item.language}>{item.word}</strong><p>{item.meaning}</p><small>{workbench ? 'Deleted' : '删除于'} {deletedDate(item.deleted_at, workbench)}</small></div><div className="trash-actions"><button disabled={Boolean(busy)} onClick={() => restore('word', item.id)}>{t('恢复')}</button><button className="text-danger" disabled={Boolean(busy)} onClick={() => purge('word', item.id, item.word)}>{t('永久删除')}</button></div></article>)}</div>}
      </>}
    </section>
  </div>
}
