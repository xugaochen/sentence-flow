import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react'

const VOICE_LANGS = { ja: 'ja-JP', es: 'es-ES', en: 'en-US' }
const LANGUAGE_NAMES = { ja: '日语', es: '西班牙语', en: '英语' }
const DEFAULT_RATE = 0.9
const MIN_RATE = 0.6
const MAX_RATE = 1.2
const DEFAULT_REPEAT = 1
const MIN_REPEAT = 1
const MAX_REPEAT = 10
const REPEAT_DELAY_MS = 250
const SETTINGS_KEY = 'sentence-flow.tts'

let activePlayback = null

function clampRate(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return DEFAULT_RATE
  return Math.min(MAX_RATE, Math.max(MIN_RATE, number))
}

function clampRepeat(value) {
  const number = Math.round(Number(value))
  if (!Number.isFinite(number)) return DEFAULT_REPEAT
  return Math.min(MAX_REPEAT, Math.max(MIN_REPEAT, number))
}

function readSettings(language) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(`${SETTINGS_KEY}.${language}`) || '{}')
    return { voiceURI: typeof stored.voiceURI === 'string' ? stored.voiceURI : '', rate: clampRate(stored.rate), repeat: clampRepeat(stored.repeat) }
  } catch {
    return { voiceURI: '', rate: DEFAULT_RATE, repeat: DEFAULT_REPEAT }
  }
}

function writeSettings(language, settings) {
  try {
    window.localStorage.setItem(`${SETTINGS_KEY}.${language}`, JSON.stringify(settings))
  } catch {
    // 关闭本地存储或隐私模式下，设置仍在当前页面内有效。
  }
}

function stopActivePlayback() {
  const playback = activePlayback
  activePlayback = null
  if (playback?.timer) window.clearTimeout(playback.timer)
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  if (playback) {
    playback.setSpeaking(false)
    playback.setCurrentRepeat(0)
  }
}

const SpeakButton = forwardRef(function SpeakButton({ text, language, label = '朗读' }, ref) {
  const instanceId = useId()
  const controlRef = useRef(null)
  const [voices, setVoices] = useState([])
  const [voiceURI, setVoiceURI] = useState('')
  const [rate, setRate] = useState(DEFAULT_RATE)
  const [repeat, setRepeat] = useState(DEFAULT_REPEAT)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [currentRepeat, setCurrentRepeat] = useState(0)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
  const targetLanguage = VOICE_LANGS[language]

  useEffect(() => {
    if (!supported || !targetLanguage) {
      setVoices([]); setVoiceURI(''); setRate(DEFAULT_RATE); setRepeat(DEFAULT_REPEAT)
      return undefined
    }

    const loadVoices = () => {
      const baseLanguage = targetLanguage.slice(0, 2).toLowerCase()
      const matching = window.speechSynthesis.getVoices()
        .filter((item) => item.lang.toLowerCase().startsWith(baseLanguage))
        .sort((left, right) => {
          const leftExact = left.lang.toLowerCase() === targetLanguage.toLowerCase() ? 0 : 1
          const rightExact = right.lang.toLowerCase() === targetLanguage.toLowerCase() ? 0 : 1
          return leftExact - rightExact || left.name.localeCompare(right.name)
        })
      const saved = readSettings(language)
      const selected = matching.find((item) => item.voiceURI === saved.voiceURI)
        || matching.find((item) => item.lang.toLowerCase() === targetLanguage.toLowerCase())
        || matching[0]
        || null

      setVoices(matching)
      setVoiceURI(selected?.voiceURI || '')
      setRate(saved.rate)
      setRepeat(saved.repeat)
      if (selected && selected.voiceURI !== saved.voiceURI) {
        writeSettings(language, { voiceURI: selected.voiceURI, rate: saved.rate, repeat: saved.repeat })
      }
    }

    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [language, supported, targetLanguage])

  useEffect(() => {
    if (!settingsOpen) return undefined
    const closeSettings = (event) => {
      if (event.key === 'Escape' || (event.type === 'pointerdown' && !controlRef.current?.contains(event.target))) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeSettings)
    document.addEventListener('keydown', closeSettings)
    return () => {
      document.removeEventListener('pointerdown', closeSettings)
      document.removeEventListener('keydown', closeSettings)
    }
  }, [settingsOpen])

  useEffect(() => () => {
    if (activePlayback?.id === instanceId) stopActivePlayback()
  }, [instanceId, text, language])

  const voice = useMemo(() => voices.find((item) => item.voiceURI === voiceURI) || null, [voices, voiceURI])
  const unavailable = !supported || !voice

  const toggleSpeech = () => {
    if (!supported || !voice || !text) return
    if (speaking && activePlayback?.id === instanceId) {
      stopActivePlayback()
      return
    }

    stopActivePlayback()
    const playback = {
      id: instanceId,
      completed: 0,
      repeat,
      timer: null,
      setSpeaking,
      setCurrentRepeat,
    }
    const finish = () => {
      if (activePlayback !== playback) return
      activePlayback = null
      setSpeaking(false)
      setCurrentRepeat(0)
    }
    const speakNext = () => {
      if (activePlayback !== playback) return
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = targetLanguage
      utterance.voice = voice
      utterance.rate = rate
      utterance.pitch = 1
      utterance.volume = 1
      setCurrentRepeat(playback.completed + 1)
      utterance.onend = () => {
        if (activePlayback !== playback) return
        playback.completed += 1
        if (playback.completed >= playback.repeat) finish()
        else playback.timer = window.setTimeout(speakNext, REPEAT_DELAY_MS)
      }
      utterance.onerror = finish
      window.speechSynthesis.speak(utterance)
    }
    activePlayback = playback
    setSpeaking(true)
    speakNext()
  }

  useImperativeHandle(ref, () => ({ toggle: toggleSpeech }), [toggleSpeech])

  const selectVoice = (event) => {
    const nextVoiceURI = event.target.value
    stopActivePlayback()
    setVoiceURI(nextVoiceURI)
    writeSettings(language, { voiceURI: nextVoiceURI, rate, repeat })
  }

  const changeRate = (event) => {
    const nextRate = clampRate(event.target.value)
    stopActivePlayback()
    setRate(nextRate)
    writeSettings(language, { voiceURI, rate: nextRate, repeat })
  }

  const changeRepeat = (event) => {
    const nextRepeat = clampRepeat(event.target.value)
    stopActivePlayback()
    setRepeat(nextRepeat)
    writeSettings(language, { voiceURI, rate, repeat: nextRepeat })
  }

  const unavailableMessage = !supported
    ? '当前浏览器不支持系统朗读'
    : `系统中没有可用的${LANGUAGE_NAMES[language] || '目标语言'}语音，请安装对应的 Windows 语言语音包`

  return <div className="speak-control" ref={controlRef}>
    <button
      type="button"
      className={`speak-button ${speaking ? 'speaking' : ''}`}
      onClick={toggleSpeech}
      disabled={unavailable || !text}
      title={unavailable ? unavailableMessage : `${label}（${voice.name}，${rate.toFixed(2)} 倍速，连续 ${repeat} 遍）`}
      aria-label={speaking ? '停止朗读' : label}
    >{speaking ? '■' : '♪'} <span>{speaking ? `停止朗读 ${currentRepeat}/${repeat}` : label}</span></button>
    <button
      type="button"
      className="speak-settings-toggle"
      onClick={() => setSettingsOpen((open) => !open)}
      aria-expanded={settingsOpen}
      aria-label="朗读设置"
      title="朗读设置"
    >⚙</button>
    {settingsOpen && <div className="speak-settings" role="dialog" aria-label="朗读设置">
      <div className="speak-settings-heading"><strong>朗读设置</strong><button type="button" onClick={() => setSettingsOpen(false)} aria-label="关闭朗读设置">×</button></div>
      {unavailable ? <p className="speak-unavailable">{unavailableMessage}</p> : <>
        <label><span>系统音色</span><select value={voiceURI} onChange={selectVoice}>{voices.map((item) => <option key={item.voiceURI} value={item.voiceURI}>{item.name} · {item.lang}{item.localService ? ' · 本地' : ''}</option>)}</select></label>
        <label className="speak-rate"><span>语速 <b>{rate.toFixed(2)}×</b></span><input type="range" min={MIN_RATE} max={MAX_RATE} step="0.05" value={rate} onChange={changeRate} /></label>
        <label><span>连续复读</span><select value={repeat} onChange={changeRepeat}>{Array.from({ length: MAX_REPEAT }, (_, index) => index + 1).map((count) => <option value={count} key={count}>{count} 遍</option>)}</select></label>
        <button type="button" className="button button-small button-quiet speak-preview" onClick={toggleSpeech}>{speaking ? '■ 停止试听' : '♪ 试听当前内容'}</button>
        <small>设置仅保存在当前浏览器中，不同语言会分别记忆。</small>
      </>}
    </div>}
  </div>
})

export default SpeakButton
