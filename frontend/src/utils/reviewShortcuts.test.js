import assert from 'node:assert/strict'
import test from 'node:test'

import { getReviewShortcut, isEditableReviewTarget } from './reviewShortcuts.js'


const keyEvent = (key, changes = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  target: { tagName: 'BODY' },
  ...changes,
})


test('sentence answers use command-enter to submit and command-shift-enter to skip', () => {
  const state = { submitted: false, isSentence: true, hasAnswer: true, busy: false }

  assert.deepEqual(getReviewShortcut(keyEvent('Enter', { ctrlKey: true }), state), { type: 'submit' })
  assert.deepEqual(getReviewShortcut(keyEvent('Enter', { metaKey: true }), state), { type: 'submit' })
  assert.deepEqual(getReviewShortcut(keyEvent('Enter', { ctrlKey: true, shiftKey: true }), state), { type: 'skip' })
  assert.equal(getReviewShortcut(keyEvent('Enter'), state), null)
})


test('word answers keep plain enter and also support command-enter', () => {
  const state = { submitted: false, isSentence: false, hasAnswer: true, busy: false }

  assert.deepEqual(getReviewShortcut(keyEvent('Enter'), state), { type: 'submit' })
  assert.deepEqual(getReviewShortcut(keyEvent('Enter', { ctrlKey: true }), state), { type: 'submit' })
})


test('empty answers cannot be submitted but can be skipped', () => {
  const state = { submitted: false, isSentence: true, hasAnswer: false, busy: false }

  assert.equal(getReviewShortcut(keyEvent('Enter', { ctrlKey: true }), state), null)
  assert.deepEqual(getReviewShortcut(keyEvent('Enter', { ctrlKey: true, shiftKey: true }), state), { type: 'skip' })
})

test('command-slash reveals empty or partial answers for both sentence and word review', () => {
  for (const isSentence of [true, false]) {
    for (const hasAnswer of [true, false]) {
      const state = { submitted: false, isSentence, hasAnswer, busy: false }
      assert.deepEqual(getReviewShortcut(keyEvent('/', { ctrlKey: true, target: { tagName: isSentence ? 'TEXTAREA' : 'INPUT' } }), state), { type: 'reveal' })
      assert.deepEqual(getReviewShortcut(keyEvent('/', { metaKey: true }), state), { type: 'reveal' })
      assert.deepEqual(getReviewShortcut(keyEvent('／', { ctrlKey: true, code: 'Slash' }), state), { type: 'reveal' })
      assert.equal(getReviewShortcut(keyEvent('/'), state), null)
      assert.equal(getReviewShortcut(keyEvent('/', { ctrlKey: true, shiftKey: true }), state), null)
    }
  }
})

test('reveal ignores composition, repeated keys, busy saves and already-revealed answers', () => {
  const state = { submitted: false, isSentence: true, hasAnswer: false, busy: false }
  for (const changes of [{ repeat: true }, { isComposing: true }, { keyCode: 229 }, { altKey: true }]) {
    assert.equal(getReviewShortcut(keyEvent('/', { ctrlKey: true, ...changes }), state), null)
  }
  assert.equal(getReviewShortcut(keyEvent('/', { ctrlKey: true }), { ...state, submitted: true }), null)
  assert.equal(getReviewShortcut(keyEvent('/', { ctrlKey: true }), { ...state, busy: true }), null)
  assert.equal(getReviewShortcut(keyEvent('Enter', { isComposing: true }), { ...state, isSentence: false, hasAnswer: true }), null)
})


test('number keys map to known, fuzzy, and unknown after revealing the answer', () => {
  const state = { submitted: true, isSentence: true, hasAnswer: true, busy: false }

  assert.deepEqual(getReviewShortcut(keyEvent('1'), state), { type: 'assess', mastery: 'known' })
  assert.deepEqual(getReviewShortcut(keyEvent('2'), state), { type: 'assess', mastery: 'fuzzy' })
  assert.deepEqual(getReviewShortcut(keyEvent('3'), state), { type: 'assess', mastery: 'unknown' })
})


test('R toggles standard-answer speech only after revealing the answer', () => {
  const revealed = { submitted: true, isSentence: true, hasAnswer: true, busy: false }
  const answering = { ...revealed, submitted: false }

  assert.deepEqual(getReviewShortcut(keyEvent('r'), revealed), { type: 'speak' })
  assert.deepEqual(getReviewShortcut(keyEvent('R'), revealed), { type: 'speak' })
  assert.equal(getReviewShortcut(keyEvent('r'), answering), null)
  assert.equal(getReviewShortcut(keyEvent('r', { target: { tagName: 'INPUT' } }), revealed), null)
  assert.equal(getReviewShortcut(keyEvent('r', { ctrlKey: true }), revealed), null)
})


test('assessment shortcuts ignore editable fields, modifiers, repeats, and pending actions', () => {
  const state = { submitted: true, isSentence: true, hasAnswer: true, busy: false }

  assert.equal(getReviewShortcut(keyEvent('1', { target: { tagName: 'INPUT' } }), state), null)
  assert.equal(getReviewShortcut(keyEvent('1', { target: { tagName: 'TEXTAREA' } }), state), null)
  assert.equal(getReviewShortcut(keyEvent('1', { target: { tagName: 'DIV', isContentEditable: true } }), state), null)
  assert.equal(getReviewShortcut(keyEvent('1', { ctrlKey: true }), state), null)
  assert.equal(getReviewShortcut(keyEvent('1', { repeat: true }), state), null)
  assert.equal(getReviewShortcut(keyEvent('1'), { ...state, busy: true }), null)
})


test('editable target detection includes inputs, selects, textareas, and contenteditable descendants', () => {
  assert.equal(isEditableReviewTarget({ tagName: 'INPUT' }), true)
  assert.equal(isEditableReviewTarget({ tagName: 'SELECT' }), true)
  assert.equal(isEditableReviewTarget({ tagName: 'TEXTAREA' }), true)
  assert.equal(isEditableReviewTarget({ tagName: 'SPAN', closest: () => ({}) }), true)
  assert.equal(isEditableReviewTarget({ tagName: 'BUTTON', closest: () => null }), false)
})
