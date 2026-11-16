import assert from 'node:assert/strict'
import test from 'node:test'
import { PROMPT_DISPLAY_KEY, normalizePromptDisplay, readPromptDisplay, savePromptDisplay, nextPromptFontSize } from './promptDisplay.js'

test('defaults to code and a readable size; validates stored settings', () => {
  assert.deepEqual(normalizePromptDisplay(null), { format: 'code', fontSize: 18 })
  assert.deepEqual(normalizePromptDisplay({ format: 'text', fontSize: 22 }), { format: 'text', fontSize: 22 })
  assert.deepEqual(readPromptDisplay({ getItem: () => '{"format":"text","fontSize":26}' }), { format: 'text', fontSize: 18 })
  assert.deepEqual(normalizePromptDisplay({ format: 'bad', fontSize: 999 }), { format: 'code', fontSize: 18 })
})

test('format and font size persist together for future questions and rounds', () => {
  const data = new Map()
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) }
  savePromptDisplay({ format: 'text', fontSize: 22 }, storage)
  assert.deepEqual(readPromptDisplay(storage), { format: 'text', fontSize: 22 })
  savePromptDisplay({ ...readPromptDisplay(storage), format: 'code' }, storage)
  assert.deepEqual(readPromptDisplay(storage), { format: 'code', fontSize: 22 })
  assert.equal(data.size, 1)
  assert.ok(data.has(PROMPT_DISPLAY_KEY))
})

test('missing, corrupted or blocked storage never breaks review', () => {
  for (const value of [null, 'broken', 'null', '[]', '"text"', '{"fontSize":-1}']) {
    assert.deepEqual(readPromptDisplay({ getItem: () => value }), { format: 'code', fontSize: 18 })
  }
  const blocked = { getItem() { throw Error('blocked') }, setItem() { throw Error('blocked') } }
  assert.doesNotThrow(() => savePromptDisplay({ format: 'text', fontSize: 18 }, blocked))
  assert.deepEqual(readPromptDisplay(blocked), { format: 'code', fontSize: 18 })
})

test('font button cycles through five sizes and accepts the smaller size', () => {
  assert.deepEqual([12, 14, 16, 18, 22].map(nextPromptFontSize), [14, 16, 18, 22, 12])
  assert.deepEqual(normalizePromptDisplay({ format: 'text', fontSize: 12 }), { format: 'text', fontSize: 12 })
})
