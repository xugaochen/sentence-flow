import { useEffect, useState } from 'react'

const VOICE_LANGS = { ja: 'ja-JP', es: 'es-ES' }

export default function SpeakButton({ text, language, label = '朗读' }) {
  const [voice, setVoice] = useState(null)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

  useEffect(() => {
    if (!supported) return undefined
    const target = VOICE_LANGS[language]
    const loadVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      setVoice(voices.find((item) => item.lang.toLowerCase().startsWith(target.slice(0, 2))) || null)
    }
    loadVoice()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoice)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoice)
  }, [language, supported])

  const speak = () => {
    if (!supported || !voice || !text) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = VOICE_LANGS[language]
    utterance.voice = voice
    utterance.rate = 0.9
    window.speechSynthesis.speak(utterance)
  }

  const unavailable = !supported || !voice
  return <button type="button" className="speak-button" onClick={speak} disabled={unavailable || !text} title={unavailable ? '系统中没有可用的对应语言语音' : `${label}（使用系统语音）`} aria-label={label}>♪ <span>{label}</span></button>
}
