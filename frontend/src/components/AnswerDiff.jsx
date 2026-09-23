import { diffText } from '../utils/textDiff'

function DiffLine({ parts, side }) {
  const visible = parts.filter((part) => part.type === 'equal' || (side === 'actual' ? part.type === 'delete' : part.type === 'insert'))
  return <p className="diff-line">{visible.map((part, index) => {
    const changed = part.type !== 'equal'
    return changed
      ? <mark className={side === 'actual' ? 'diff-delete' : 'diff-insert'} key={`${part.type}-${index}`}>{part.text}</mark>
      : <span key={`${part.type}-${index}`}>{part.text}</span>
  })}</p>
}

export default function AnswerDiff({ actual, expected }) {
  const parts = diffText(actual, expected)
  return <div className="comparison">
    <div><span>你的答案</span>{actual.trim() ? <DiffLine parts={parts} side="actual" /> : <p className="answer-unanswered">未作答</p>}</div>
    <div><span>标准答案</span><DiffLine parts={parts} side="expected" /></div>
  </div>
}
