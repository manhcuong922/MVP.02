import { formatDateTime, getFieldLabel } from '../utils/formatters'

function EditHistoryList({ entries }) {
  if (entries.length === 0) {
    return (
      <div className="empty-card compact">
        <strong>Chưa có log chỉnh sửa.</strong>
        <p>Tiêu đề, mô tả, deadline, ưu tiên và các thay đổi dữ liệu sẽ được ghi lại tại đây.</p>
      </div>
    )
  }

  return (
    <div className="edit-history-grid">
      {entries.map((entry) => (
        <article key={entry.id} className="edit-history-card">
          <div className="edit-history-topline">
            <div>
              <strong>{getFieldLabel(entry.fieldName)}</strong>
              <p>{entry.actorName}</p>
            </div>
            <span>{formatDateTime(entry.createdAt)}</span>
          </div>
          <div className="edit-diff-grid">
            <div>
              <small>Giá trị cũ</small>
              <strong>{entry.oldValue || 'Trống'}</strong>
            </div>
            <div>
              <small>Giá trị mới</small>
              <strong>{entry.newValue || 'Trống'}</strong>
            </div>
          </div>
          <p>{entry.note}</p>
        </article>
      ))}
    </div>
  )
}

export default EditHistoryList
