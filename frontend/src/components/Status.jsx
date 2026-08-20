export function Loading() { return <div className="status-card"><span className="spinner" />正在整理你的句子…</div> }

export function Empty({ title, children }) {
  return <div className="empty"><span>空</span><h3>{title}</h3>{children && <p>{children}</p>}</div>
}

export function ErrorMessage({ message }) { return message ? <div className="alert">{message}</div> : null }

