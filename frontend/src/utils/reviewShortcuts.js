const MASTERY_BY_KEY = {
  1: 'known',
  2: 'fuzzy',
  3: 'unknown',
}

export function isEditableReviewTarget(target) {
  if (!target) return false
  const tagName = String(target.tagName || '').toLowerCase()
  if (['input', 'textarea', 'select'].includes(tagName)) return true
  if (target.isContentEditable) return true
  return Boolean(target.closest?.('[contenteditable="true"]'))
}

export function getReviewShortcut(event, { submitted, isSentence, hasAnswer, busy }) {
  if (busy || event.repeat || event.isComposing || event.keyCode === 229 || event.altKey) return null

  const commandKey = event.ctrlKey || event.metaKey
  const isEnter = event.key === 'Enter'

  if (!submitted) {
    if (commandKey && !event.shiftKey && (event.key === '/' || event.code === 'Slash')) return { type: 'reveal' }
    if (isEnter && commandKey && event.shiftKey) return { type: 'skip' }
    if (!hasAnswer || !isEnter || event.shiftKey) return null
    if (commandKey || !isSentence) return { type: 'submit' }
    return null
  }

  if (isEditableReviewTarget(event.target)) return null
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return null
  if (event.key.toLowerCase() === 'r') return { type: 'speak' }
  const mastery = MASTERY_BY_KEY[event.key]
  return mastery ? { type: 'assess', mastery } : null
}
