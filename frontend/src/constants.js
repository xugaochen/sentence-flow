export const LANGUAGES = {
  ja: { label: '日语', short: '日' },
  es: { label: '西班牙语', short: '西' },
  en: { label: '英语', short: '英' },
}

export const MASTERY = {
  unknown: { label: '不会', className: 'danger' },
  fuzzy: { label: '模糊', className: 'warning' },
  known: { label: '会了', className: 'success' },
}

export const PARTS_OF_SPEECH = [
  '名词', '动词', '形容词', '副词', '介词 / 助词', '连词', '固定表达', '其他',
]

export function formatDate(value) {
  if (!value) return '尚未复习'
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value))
}
