export function reviewPromptLanguage(type, settings) {
  return type === 'sentences' && settings.language === 'es' && settings.prompt_language === 'en' ? 'en' : 'zh'
}

export function reviewPromptText(item, type, promptLanguage) {
  if (!item) return ''
  if (type === 'words') return item.meaning
  // Never silently substitute Chinese in an English-to-Spanish round.
  return item.language === 'es' && promptLanguage === 'en' ? item.english_text || '' : item.chinese_text
}
