// The per-question lock prevents duplicate actions until a render. It must not
// trap a finished round; pending network writes still block leaving the page.
export function canLeaveReview({ phase, actionPending, editorPending, actionLocked }) {
  return !actionPending && !editorPending && (phase !== 'review' || !actionLocked)
}

export function removeCurrentAndFutureMatches(items, index, itemId) {
  return splitCurrentAndFutureMatches(items, index, itemId).remaining
}

export function splitCurrentAndFutureMatches(items, index, itemId) {
  const completed = items.slice(0, index)
  const pending = items.slice(index)
  const removed = pending.filter((item) => item.id === itemId)
  const remaining = pending.filter((item) => item.id !== itemId)
  return { remaining: [...completed, ...remaining], removed }
}

export function getReviewStartNotice(mode, items) {
  if (mode === 'new_first' && items.length > 0 && items.every((item) => item.review_count > 0)) {
    return '当前筛选范围内没有新题，本轮将复习已经练习过的内容。'
  }
  return ''
}
