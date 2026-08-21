import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'

export default function RouteError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : '页面遇到了未知错误'

  return (
    <main className="route-error-page">
      <div className="route-error-mark">!</div>
      <p className="eyebrow">PAGE ERROR</p>
      <h1>这个页面暂时无法显示</h1>
      <p className="route-error-message">{message}</p>
      <div className="hero-actions">
        <button className="button button-primary" onClick={() => window.location.reload()}>重新加载</button>
        <Link className="button button-quiet" to="/">返回首页</Link>
      </div>
    </main>
  )
}
