export function clearTrashNoticeOnAdvance(status) {
  // Keep failures visible: the removed question has been restored to the queue.
  return status?.kind === 'error' ? status : null
}

export function completeTrashNotice(status, requestId, text) {
  // A late response must not revive a dismissed notice or replace a newer one.
  if (status?.kind !== 'pending' || status.requestId !== requestId) return status
  return { kind: 'success', requestId, text }
}
