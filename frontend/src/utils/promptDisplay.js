export const PROMPT_DISPLAY_KEY = 'sentence-flow.prompt-display'
export const PROMPT_FONT_SIZES = [12, 14, 16, 18, 22]

export function normalizePromptDisplay(value) {
  return {
    format: value?.format === 'text' ? 'text' : 'code',
    fontSize: PROMPT_FONT_SIZES.includes(value?.fontSize) ? value.fontSize : 18,
  }
}

export function readPromptDisplay(storage) {
  try {
    const target = storage ?? (typeof window === 'undefined' ? null : window.localStorage)
    return normalizePromptDisplay(JSON.parse(target?.getItem(PROMPT_DISPLAY_KEY) || 'null'))
  } catch {
    return normalizePromptDisplay(null)
  }
}

export function savePromptDisplay(value, storage) {
  try {
    const target = storage ?? (typeof window === 'undefined' ? null : window.localStorage)
    target?.setItem(PROMPT_DISPLAY_KEY, JSON.stringify(normalizePromptDisplay(value)))
  } catch {
    // Controls still work in this page when browser storage is blocked.
  }
}

export function nextPromptFontSize(size) {
  return PROMPT_FONT_SIZES[(PROMPT_FONT_SIZES.indexOf(size) + 1) % PROMPT_FONT_SIZES.length]
}
