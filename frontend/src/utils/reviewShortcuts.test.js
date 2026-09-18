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
