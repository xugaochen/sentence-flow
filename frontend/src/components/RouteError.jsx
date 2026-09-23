import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { useAppearance, useUiText } from './Appearance'

export default function RouteError() {
  const t = useUiText()
  const { workbench, toggleAppearance } = useAppearance()
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : t('页面遇到了未知错误')

  return (
    <main className="route-error-page">
      <div className="route-error-mark">!</div>
      <p className="eyebrow">PAGE ERROR</p>
      <h1>{t('这个页面暂时无法显示')}</h1>
      <p className="route-error-message">{message}</p>
      <div className="hero-actions">
        <button className="button button-primary" onClick={() => window.location.reload()}>{t('重新加载')}</button>
        <Link className="button button-quiet" to="/">{t('返回首页')}</Link>
        {workbench && <button className="button button-quiet" onClick={toggleAppearance}>{t('恢复标准界面')}</button>}
      </div>
    </main>
  )
}
