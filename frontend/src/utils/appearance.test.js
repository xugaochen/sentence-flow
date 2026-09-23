import assert from 'node:assert/strict'
import test from 'node:test'
import { APPEARANCE_KEY, applyAppearance, readAppearance, saveAppearance, workspaceFile } from './appearance.js'

function storage(initial) {
  const values = new Map(initial ? [[APPEARANCE_KEY, initial]] : [])
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
}

test('appearance defaults safely and persists both directions for a fresh load', () => {
  const saved = storage()
  assert.equal(readAppearance(saved), 'standard')
  saveAppearance('workbench', saved)
  assert.equal(readAppearance(saved), 'workbench')
  saveAppearance('standard', saved)
  assert.equal(readAppearance(saved), 'standard')
  assert.equal(readAppearance(storage('invalid')), 'standard')
})

test('unavailable local storage does not prevent switching the current tab', () => {
  const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
  assert.equal(readAppearance(blocked), 'standard')
  assert.doesNotThrow(() => saveAppearance('workbench', blocked))
})

test('switching appearance updates and restores title, theme color and global styling', () => {
  const colors = []
  const doc = { documentElement: { dataset: {} }, title: '', querySelector: () => ({ setAttribute: (_name, value) => colors.push(value) }) }
  applyAppearance('workbench', doc)
  assert.equal(doc.documentElement.dataset.appearance, 'workbench')
  assert.equal(doc.title, 'workspace — Code Workspace')
  applyAppearance('standard', doc)
  assert.equal(doc.documentElement.dataset.appearance, 'standard')
  assert.equal(doc.title, '句流 · 外语学习')
  assert.deepEqual(colors, ['#181b22', '#f6f4ee'])
})

test('workspace labels use readable English for all pages', () => {
  for (const [path, file] of Object.entries({
    '/': 'Home', '/review/sentences': 'Sentence Review', '/review/words': 'Word Review',
    '/sentences': 'Sentence Library', '/words': 'Word Library', '/sentences/new': 'Add Sentence',
    '/sentences/123': 'Sentence #123', '/sentences/123/edit': 'Edit Sentence #123', '/words/15': 'Word #15',
    '/data': 'Data & Backup', '/unknown': 'Workspace',
  })) assert.equal(workspaceFile(path), file)
})
