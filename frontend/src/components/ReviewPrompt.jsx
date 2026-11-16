import { LANGUAGES } from '../constants'
import { useAppearance } from './Appearance'
import { PROMPT_FONT_SIZES, nextPromptFontSize, normalizePromptDisplay } from '../utils/promptDisplay'

export default function ReviewPrompt({ text, promptLanguage, language, isSentence, display, onDisplayChange }) {
  const { workbench } = useAppearance()
  const { format, fontSize } = normalizePromptDisplay(display)
  const codeFormat = workbench && format === 'code'
  const english = promptLanguage === 'en'
  const prompt = text || (workbench ? 'Translation missing. Skip this question and add a translation.' : '缺少译文，请跳过并补充翻译。')

  return <>
    <div className="review-label">
      <span>{workbench ? codeFormat ? `// ${english ? 'English' : 'Chinese'} → ${LANGUAGES[language].englishLabel}` : `${english ? 'English' : 'Chinese'} Prompt` : english ? '英文提示' : isSentence ? '中文提示' : '中文意思'}</span>
      <div className="prompt-heading-actions">
        <b>{workbench ? `Answer in ${LANGUAGES[language].englishLabel}` : LANGUAGES[language].label}</b>
        {workbench && <div className="prompt-display-controls" role="group" aria-label="Prompt appearance" onKeyDown={(event) => event.stopPropagation()}>
          <button type="button" aria-pressed={codeFormat} aria-label={codeFormat ? 'Switch to plain text prompt' : 'Switch to code prompt'} title={codeFormat ? 'Switch to plain text prompt' : 'Switch to code prompt'} onClick={() => onDisplayChange?.({ format: codeFormat ? 'text' : 'code', fontSize })}>{codeFormat ? '</> Code' : 'Tt Text'}</button>
          <button type="button" aria-label={`Prompt size ${fontSize}px. Change to ${nextPromptFontSize(fontSize)}px`} title={`Text size: ${fontSize}px. Click to cycle ${PROMPT_FONT_SIZES.join(' / ')}px.`} onClick={() => onDisplayChange?.({ format, fontSize: nextPromptFontSize(fontSize) })}>Aa <span>{fontSize}</span></button>
        </div>}
      </div>
    </div>
    <h1 className={codeFormat ? 'workspace-code-prompt' : undefined} style={workbench ? { fontSize: `${fontSize}px`, overflowWrap: 'anywhere' } : undefined} lang={english ? 'en' : 'zh'}>
      {codeFormat ? <code><span className="workspace-code-variable">{english ? 'english_prompt' : 'chinese_prompt'}</span><span className="workspace-code-operator"> = </span><span className="workspace-code-string">{JSON.stringify(prompt)}</span></code> : prompt}
    </h1>
  </>
}
