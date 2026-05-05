import {
  formatDateTime,
  getActionLabel,
  getFieldLabel,
} from '../utils/formatters'

function HistoryIcon({ actionType }) {
  const iconMap = {
    create: '+',
    assign: '>',
    status_change: '*',
    split: '=>',
    edit: 'E',
    upload: '^',
  }

  return <span className={`timeline-icon ${actionType}`}>{iconMap[actionType] ?? '*'}</span>
}

function TaskHistoryPanel({ entries }) {
  if (entries.length === 0) {
    return (
      <div className="empty-card compact">
        <strong>Chua co activity log.</strong>
        <p>Khi giao viec, doi trang thai, chia task hoac tai tai lieu, timeline se hien thi tai day.</p>
      </div>
    )
  }

  return (
    <div className="timeline-list">
      {entries.map((entry) => (
        <article key={entry.id} className="timeline-card">
          <HistoryIcon actionType={entry.actionType} />
          <div className="timeline-copy">
            <div className="timeline-topline">
              <strong>{getActionLabel(entry.actionType)}</strong>
              <span>{formatDateTime(entry.createdAt)}</span>
            </div>
            <p className="timeline-actor">{entry.actorName}</p>
            {entry.fieldName && entry.fieldName !== 'note' ? (
              <p className="timeline-diff">
                <span>{getFieldLabel(entry.fieldName)}</span>
                <span>{entry.oldValue || 'Trong'}</span>
                <span>{entry.newValue || 'Trong'}</span>
              </p>
            ) : null}
            <p>{entry.note}</p>
          </div>
        </article>
      ))}
    </div>
  )
}

export default TaskHistoryPanel
