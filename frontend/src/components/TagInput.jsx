import { useState } from 'react'

export default function TagInput({ value, onChange, suggestions = [] }) {
  const [draft, setDraft] = useState('')
  const add = (raw) => {
    const tags = raw.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean)
    if (tags.length) onChange([...new Set([...value, ...tags])])
    setDraft('')
  }
  return (
    <div>
      <div className="tag-editor">
        {value.map((tag) => <button type="button" className="tag removable" key={tag} onClick={() => onChange(value.filter((item) => item !== tag))}>{tag} ×</button>)}
        <input
          value={draft}
          list="tag-suggestions"
          placeholder={value.length ? '继续添加' : '输入后按回车，可用逗号分隔'}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => draft && add(draft)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); add(draft) }
          }}
        />
      </div>
      <datalist id="tag-suggestions">{suggestions.map((tag) => <option key={tag} value={tag} />)}</datalist>
    </div>
  )
}

