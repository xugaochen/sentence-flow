export const APPEARANCE_KEY = 'sentence-flow.appearance'

export function readAppearance(storage) {
  try {
    const target = storage ?? (typeof window === 'undefined' ? null : window.localStorage)
    return target?.getItem(APPEARANCE_KEY) === 'workbench' ? 'workbench' : 'standard'
  } catch {
    return 'standard'
  }
}

export function saveAppearance(mode, storage) {
  try {
    const target = storage ?? (typeof window === 'undefined' ? null : window.localStorage)
    target?.setItem(APPEARANCE_KEY, mode === 'workbench' ? 'workbench' : 'standard')
  } catch {
    // The current tab still works when browser storage is unavailable.
  }
}

export function applyAppearance(mode, doc = document) {
  const workbench = mode === 'workbench'
  doc.documentElement.dataset.appearance = workbench ? 'workbench' : 'standard'
  doc.title = workbench ? 'workspace — Code Workspace' : '句流 · 外语学习'
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', workbench ? '#181b22' : '#f6f4ee')
}

export function workspaceFile(pathname) {
  if (pathname === '/review/sentences') return 'Sentence Review'
  if (pathname === '/review/words') return 'Word Review'
  if (pathname === '/sentences/new') return 'Add Sentence'
  if (/^\/sentences\/\d+\/edit$/.test(pathname)) return `Edit Sentence #${pathname.split('/')[2]}`
  if (/^\/sentences\/\d+$/.test(pathname)) return `Sentence #${pathname.split('/')[2]}`
  if (/^\/words\/\d+$/.test(pathname)) return `Word #${pathname.split('/')[2]}`
  return { '/': 'Home', '/sentences': 'Sentence Library', '/words': 'Word Library', '/data': 'Data & Backup' }[pathname] || 'Workspace'
}
