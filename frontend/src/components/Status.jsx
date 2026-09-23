import { useUiText } from './Appearance'

export function Loading() {
  const t = useUiText()
  return <div className="status-card"><span className="spinner" />{t('正在整理你的句子…')}</div>
}

export function Empty({ title, children }) {
  const t = useUiText()
  return <div className="empty"><span>{t('空')}</span><h3>{title}</h3>{children && <p>{children}</p>}</div>
}

export function ErrorMessage({ message }) { return message ? <div className="alert">{message}</div> : null }
