import assert from 'node:assert/strict'
import test from 'node:test'

import { getReviewStartNotice, removeCurrentAndFutureMatches, splitCurrentAndFutureMatches } from './reviewQueue.js'


test('removing a repeated current item preserves history and removes future copies', () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 1 }, { id: 3 }, { id: 1 }]
  const result = removeCurrentAndFutureMatches(items, 2, 1)

  assert.deepEqual(result.map((item) => item.id), [1, 2, 3])
  assert.equal(result[2].id, 3)
})


test('removing the final remaining occurrence leaves completed history', () => {
  const items = [{ id: 1 }, { id: 2 }, { id: 2 }]
  const result = removeCurrentAndFutureMatches(items, 2, 2)

  assert.deepEqual(result.map((item) => item.id), [1, 2])
})


test('splitting a repeated item returns every current and future copy for recovery', () => {
  const items = [{ id: 1, value: 'past' }, { id: 2 }, { id: 1, value: 'current' }, { id: 3 }, { id: 1, value: 'future' }]
  const result = splitCurrentAndFutureMatches(items, 2, 1)

  assert.deepEqual(result.remaining.map((item) => item.id), [1, 2, 3])
  assert.deepEqual(result.removed.map((item) => item.value), ['current', 'future'])
})


test('new-first mode explains when the filtered pool has no new items', () => {
  const reviewed = [{ id: 1, review_count: 1 }, { id: 2, review_count: 3 }]
  const withNewItem = [{ id: 1, review_count: 1 }, { id: 2, review_count: 0 }]

  assert.match(getReviewStartNotice('new_first', reviewed), /没有新题/)
  assert.equal(getReviewStartNotice('new_first', withNewItem), '')
  assert.equal(getReviewStartNotice('smart', reviewed), '')
  assert.equal(getReviewStartNotice('new_first', []), '')
})
