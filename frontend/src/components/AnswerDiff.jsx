import { diffText } from '../utils/textDiff'
import { useAppearance } from './Appearance'

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
  const { workbench } = useAppearance()
  const parts = diffText(actual, expected)
  return <div className="comparison">
    <div><span>{workbench ? 'Your Answer' : '你的答案'}</span>{actual.trim() ? <DiffLine parts={parts} side="actual" /> : <p className="answer-unanswered">{workbench ? 'Not answered' : '未作答'}</p>}</div>
    <div><span>{workbench ? 'Correct Answer' : '标准答案'}</span><DiffLine parts={parts} side="expected" /></div>
  </div>
}
