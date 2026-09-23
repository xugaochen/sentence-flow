import assert from 'node:assert/strict'
import test from 'node:test'
import { reviewPromptLanguage, reviewPromptText } from './reviewPrompt.js'
import { translateUi } from './uiText.js'

const sentence = { language: 'es', target_text: 'Tengo hambre.', chinese_text: '我饿了。', english_text: 'I am hungry.' }

test('English prompts are only selected for explicitly Spanish sentence review', () => {
  assert.equal(reviewPromptLanguage('sentences', { language: 'es', prompt_language: 'en' }), 'en')
  for (const language of ['', 'ja', 'en']) {
    assert.equal(reviewPromptLanguage('sentences', { language, prompt_language: 'en' }), 'zh')
  }
  assert.equal(reviewPromptLanguage('words', { language: 'es', prompt_language: 'en' }), 'zh')
  assert.equal(reviewPromptLanguage('sentences', { language: 'es' }), 'zh')
  assert.equal(reviewPromptLanguage('sentences', { language: 'es', prompt_language: 'zh' }), 'zh')
})

test('prompt switch changes the translation, never the answer or word meaning', () => {
  assert.equal(reviewPromptText(sentence, 'sentences', 'en'), 'I am hungry.')
  assert.equal(reviewPromptText(sentence, 'sentences', 'zh'), '我饿了。')
  assert.equal(reviewPromptText({ ...sentence, language: 'ja' }, 'sentences', 'en'), '我饿了。')
  assert.equal(reviewPromptText({ meaning: '饿 (hunger)' }, 'words', 'en'), '饿 (hunger)')
  assert.equal(sentence.target_text, 'Tengo hambre.')
})

test('missing English is explicit and never silently replaced by Chinese', () => {
  assert.equal(reviewPromptText({ ...sentence, english_text: '' }, 'sentences', 'en'), '')
  assert.equal(reviewPromptText({ ...sentence, english_text: undefined }, 'sentences', 'en'), '')
  assert.equal(reviewPromptText(null, 'sentences', 'en'), '')
})

test('workbench translates UI without changing study content or standard view', () => {
  assert.equal(translateUi('熟练度', true), 'Mastery')
  assert.equal(translateUi('朗读设置', true), 'Reading Settings')
  assert.equal(translateUi('确认移至回收站', true), 'Confirm Move to Trash')
  assert.equal(translateUi('不会', true), 'Not yet')
  assert.equal(translateUi('熟练度', false), '熟练度')
  assert.equal(translateUi('自定义标签', true), '自定义标签')
  assert.equal(translateUi('constructor', true), 'constructor')
})
