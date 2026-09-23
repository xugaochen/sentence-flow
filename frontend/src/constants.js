export const LANGUAGES = {
  ja: { label: '日语', englishLabel: 'Japanese', short: '日' },
  es: { label: '西班牙语', englishLabel: 'Spanish', short: '西' },
  en: { label: '英语', englishLabel: 'English', short: '英' },
}

export const MASTERY = {
  unknown: { label: '不会', englishLabel: 'Not yet', className: 'danger' },
  fuzzy: { label: '模糊', englishLabel: 'Unsure', className: 'warning' },
  known: { label: '会了', englishLabel: 'Know it', className: 'success' },
}

export const PARTS_OF_SPEECH = [
  '名词', '动词', '形容词', '副词', '介词 / 助词', '连词', '固定表达', '其他',
]

export const PARTS_OF_SPEECH_EN = {
  '名词': 'Noun', '动词': 'Verb', '形容词': 'Adjective', '副词': 'Adverb',
  '介词 / 助词': 'Preposition / particle', '连词': 'Conjunction', '固定表达': 'Expression', '其他': 'Other',
}

export function formatDate(value, workbench = false) {
  if (!value) return workbench ? 'Not reviewed' : '尚未复习'
  return new Intl.DateTimeFormat(workbench ? 'en' : 'zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value))
}
