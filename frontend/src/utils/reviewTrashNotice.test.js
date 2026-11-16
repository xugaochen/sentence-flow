import assert from 'node:assert/strict'
import test from 'node:test'
import { clearTrashNoticeOnAdvance, completeTrashNotice } from './reviewTrashNotice.js'

test('successful deletion notice disappears after completing or skipping the next question', () => {
  const pending = { kind: 'pending', requestId: 1, text: 'Moving…' }
  const success = completeTrashNotice(pending, 1, 'Moved to trash.')
  assert.deepEqual(success, { kind: 'success', requestId: 1, text: 'Moved to trash.' })
  assert.equal(clearTrashNoticeOnAdvance(success), null)
  assert.equal(clearTrashNoticeOnAdvance(null), null)
})

test('slow deletion success cannot bring the notice back after advancing', () => {
  const pending = { kind: 'pending', requestId: 1, text: 'Moving…' }
  const cleared = clearTrashNoticeOnAdvance(pending)
  assert.equal(cleared, null)
  assert.equal(completeTrashNotice(cleared, 1, 'Moved to trash.'), null)
})

test('out-of-order deletions do not overwrite the latest pending notice', () => {
  const latest = { kind: 'pending', requestId: 2, text: 'Moving next sentence…' }
  assert.equal(completeTrashNotice(latest, 1, 'Old sentence deleted.'), latest)
  const success = completeTrashNotice(latest, 2, 'Latest sentence deleted.')
  assert.equal(success.text, 'Latest sentence deleted.')
  assert.equal(completeTrashNotice(success, 1, 'Old sentence deleted.'), success)
})

test('deletion failure stays visible when advancing or another deletion succeeds', () => {
  const failure = { kind: 'error', text: 'Deletion failed. Question restored.' }
  assert.equal(clearTrashNoticeOnAdvance(failure), failure)
  assert.equal(completeTrashNotice(failure, 2, 'Moved to trash.'), failure)
})
