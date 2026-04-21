import { useEffect, useState } from 'react'
import {
  formatDate,
  formatPercent,
  getPriorityLabel,
  getRoleLabel,
  getStatusLabel,
  truncateText,
} from '../utils/formatters'
import {
  canCreateChildTask,
  canEditTask,
  canSplitTask,
  canUpdateExecution,
  getTaskAncestors,
  getTaskChildren,
  getTaskHistoryEntries,
  isTaskLate,
} from '../utils/taskUtils'
import EditHistoryList from './EditHistoryList'
import TaskHistoryPanel from './TaskHistoryPanel'

const tabs = [
  { id: 'overview', label: 'Thông tin chung' },
  { id: 'subtasks', label: 'Subtask' },
  { id: 'history', label: 'Lịch sử' },
  { id: 'edits', label: 'Chỉnh sửa' },
]

function InfoTile({ label, value, accent }) {
  return (
    <div className="info-tile">
      <span>{label}</span>
      <strong className={accent || ''}>{value}</strong>
    </div>
  )
}

function TaskDetailPanel({
  currentUser,
  task,
  tasksById,
  usersById,
  historyById,
  visibleIdSet,
  onSelectTask,
  onOpenCreateSubtask,
  onOpenSplit,
  onOpenEdit,
  onUpdateExecution,
  isSaving,
  className = '',
  onClose = null,
  canOpenTreeView = false,
  onOpenTaskTree = null,
  treeActionLabel = 'Mở nhánh dạng tree',
}) {
  const [activeTab, setActiveTab] = useState('overview')
  const [draftStatus, setDraftStatus] = useState('not_completed')
  const [draftNote, setDraftNote] = useState('')

  useEffect(() => {
    if (!task) {
      setDraftStatus('not_completed')
      setDraftNote('')
      return
    }

    setDraftStatus(task.status === 'completed' ? 'completed' : 'not_completed')
    setDraftNote('')
  }, [task?.id, task?.status, task?.updatedAt])

  if (!task) {
    return (
      <section className={`detail-panel empty ${className}`.trim()}>
        <div className="detail-empty">
          <p className="eyebrow">Task Detail</p>
          <h2>Chọn một task ở cây bên trái để xem chi tiết</h2>
          <p>
            Panel này hiển thị đầy đủ thông tin task, subtasks, timeline giao việc
            và lịch sử cập nhật theo đúng nhánh đang được chọn.
          </p>
        </div>
      </section>
    )
  }

  const creator = usersById[task.createdBy]
  const assignee = usersById[task.assignedTo]
  const childTasks = getTaskChildren(tasksById, task.id, visibleIdSet)
  const historyEntries = getTaskHistoryEntries(historyById, task.id)
  const activityEntries = historyEntries.filter(
    (entry) => entry.actionType !== 'edit' || entry.fieldName === 'note',
  )
  const editEntries = historyEntries.filter(
    (entry) => entry.actionType === 'edit' && entry.fieldName !== 'note',
  )
  const ancestors = getTaskAncestors(tasksById, task.id, visibleIdSet)
  const late = isTaskLate(task)
  const hasChildren = childTasks.length > 0
  const allowCreateChild = canCreateChildTask(currentUser, task, usersById)
  const allowSplit = canSplitTask(currentUser, task, usersById)
  const allowEdit = canEditTask(currentUser, task)
  const allowUpdate = canUpdateExecution(currentUser, task, tasksById, visibleIdSet)
  const canConfirmBranch = hasChildren && task.allChildrenCompleted
  const branchCompleted = hasChildren && task.status === 'completed'
  const branchWaitingConfirmation =
    hasChildren && task.status === 'awaiting_confirmation'

  const submitExecution = async (event) => {
    event.preventDefault()

    const payload = hasChildren
      ? {
          confirmed: !branchCompleted,
          note: draftNote,
        }
      : {
          status: draftStatus,
          note: draftNote,
        }

    const didSave = await onUpdateExecution(payload)

    if (didSave) {
      setDraftNote('')
    }
  }

  return (
    <section className={`detail-panel ${className}`.trim()}>
      {onClose ? (
        <div className="detail-panel-utility">
          <button type="button" className="detail-close-button" onClick={onClose}>
            Ẩn chi tiết
          </button>
        </div>
      ) : null}

      <div className="detail-header">
        <div className="detail-breadcrumbs">
          {ancestors.map((ancestor) => (
            <span key={ancestor.id}>{ancestor.title}</span>
          ))}
          <strong>{task.title}</strong>
        </div>

        <div className="detail-title-row">
          <div>
            <p className="eyebrow">Task Detail</p>
            <h2>{task.title}</h2>
            <p className="detail-summary">{truncateText(task.description, 180)}</p>
          </div>

          <div className="detail-actions">
            {canOpenTreeView && onOpenTaskTree ? (
              <button type="button" className="ghost-button" onClick={onOpenTaskTree}>
                {treeActionLabel}
              </button>
            ) : null}
            {allowEdit ? (
              <button type="button" className="ghost-button" onClick={onOpenEdit}>
                Chỉnh sửa
              </button>
            ) : null}
            {allowCreateChild ? (
              <button
                type="button"
                className="ghost-button"
                onClick={onOpenCreateSubtask}
              >
                Tạo subtask
              </button>
            ) : null}
            {allowSplit ? (
              <button type="button" className="primary-button" onClick={onOpenSplit}>
                Chia task
              </button>
            ) : null}
          </div>
        </div>

        <div className="detail-badge-row">
          <span className={`badge status-${task.status}`}>{getStatusLabel(task.status)}</span>
          <span className={`badge priority-${task.priority}`}>
            {getPriorityLabel(task.priority)}
          </span>
          {late ? <span className="badge badge-danger">Trễ hạn</span> : null}
          {hasChildren ? (
            <span className="progress-chip large">{formatPercent(task.progress)}</span>
          ) : null}
        </div>

        <div className="detail-metrics">
          <InfoTile label="Người tạo" value={creator?.name ?? 'Không rõ'} />
          <InfoTile label="Người phụ trách" value={assignee?.name ?? 'Chưa giao'} />
          <InfoTile label="Vai trò" value={getRoleLabel(assignee?.role)} />
          <InfoTile
            label="Deadline"
            value={formatDate(task.deadline)}
            accent={late ? 'danger-text' : ''}
          />
          <InfoTile
            label={hasChildren ? 'Task con hoàn thành' : 'Loại thực thi'}
            value={
              hasChildren
                ? `${task.completedChildCount}/${task.childTaskCount}`
                : 'Task lá'
            }
          />
          <InfoTile
            label={hasChildren ? 'Tiến độ tự động' : 'Log cập nhật'}
            value={hasChildren ? formatPercent(task.progress) : String(historyEntries.length)}
          />
        </div>
      </div>

      <div className="detail-tab-row">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="detail-content">
        {activeTab === 'overview' ? (
          <div className="overview-grid">
            <article className="content-card">
              <div className="content-card-header">
                <h3>Mô tả công việc</h3>
              </div>
              <p>{task.description || 'Chưa có mô tả cho task này.'}</p>
            </article>

            <article className="content-card">
              <div className="content-card-header">
                <h3>Thông tin giao việc</h3>
              </div>
              <div className="detail-list">
                <div>
                  <span>Người tạo</span>
                  <strong>{creator?.name ?? 'Không rõ'}</strong>
                </div>
                <div>
                  <span>Người phụ trách</span>
                  <strong>{assignee?.name ?? 'Chưa giao'}</strong>
                </div>
                <div>
                  <span>Phòng ban</span>
                  <strong>{assignee?.department ?? 'Chưa rõ'}</strong>
                </div>
                <div>
                  <span>Cập nhật lần cuối</span>
                  <strong>{formatDate(task.updatedAt)}</strong>
                </div>
              </div>
            </article>

            <article className="content-card execution-card">
              <div className="content-card-header">
                <h3>{hasChildren ? 'Theo dõi tiến độ nhánh' : 'Cập nhật kết quả task'}</h3>
                <span className="subtle-label">
                  {hasChildren
                    ? 'Tiến độ được tính tự động từ số task con đã hoàn thành.'
                    : 'Task lá không dùng thanh kéo tiến độ, chỉ chốt hoàn thành hoặc chưa hoàn thành.'}
                </span>
              </div>

              {hasChildren ? (
                <div className="execution-readout">
                  <div className="execution-summary-grid">
                    <div className="execution-summary-card">
                      <span>Đã xong</span>
                      <strong>
                        {task.completedChildCount}/{task.childTaskCount} task con
                      </strong>
                    </div>
                    <div className="execution-summary-card">
                      <span>Trạng thái nhánh</span>
                      <strong>{getStatusLabel(task.status)}</strong>
                    </div>
                    <div className="execution-summary-card">
                      <span>Phần trăm hiện tại</span>
                      <strong>{formatPercent(task.progress)}</strong>
                    </div>
                  </div>

                  <p className="execution-support-copy">
                    Khi toàn bộ task con đã hoàn thành, người phụ trách nhánh sẽ xác nhận
                    lần cuối để nhánh này chuyển sang trạng thái hoàn thành.
                  </p>

                  {allowUpdate ? (
                    canConfirmBranch || branchCompleted ? (
                      <form className="execution-form" onSubmit={submitExecution}>
                        <label className="field field-full">
                          <span>Ghi chú xác nhận</span>
                          <textarea
                            rows="4"
                            value={draftNote}
                            onChange={(event) => setDraftNote(event.target.value)}
                            placeholder={
                              branchCompleted
                                ? 'Ví dụ: Mở lại nhánh để yêu cầu chỉnh sửa thêm.'
                                : 'Ví dụ: Đã rà soát đầy đủ kết quả đầu ra của toàn bộ task con.'
                            }
                          />
                        </label>

                        <div className="modal-actions">
                          <button type="submit" className="primary-button" disabled={isSaving}>
                            {isSaving
                              ? 'Đang lưu...'
                              : branchCompleted
                                ? 'Mở lại nhánh'
                                : 'Xác nhận hoàn thành nhánh'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="empty-card compact">
                        <strong>Nhánh này chưa đủ điều kiện xác nhận.</strong>
                        <p>
                          Hãy hoàn tất toàn bộ task con bên dưới. Khi đạt 100%, nút xác nhận
                          sẽ tự bật cho người phụ trách nhánh.
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="empty-card compact">
                      <strong>Task đang ở chế độ chỉ xem.</strong>
                      <p>
                        Bạn có thể theo dõi tiến độ tự động của cả nhánh, nhưng chỉ người
                        phụ trách nhánh mới xác nhận hoàn thành được.
                      </p>
                    </div>
                  )}

                  {branchWaitingConfirmation ? (
                    <div className="inline-status-note">
                      Tất cả task con đã xong. Nhánh này đang chờ người phụ trách xác nhận.
                    </div>
                  ) : null}
                </div>
              ) : allowUpdate ? (
                <form className="execution-form" onSubmit={submitExecution}>
                  <label className="field">
                    <span>Trạng thái kết quả</span>
                    <select
                      value={draftStatus}
                      onChange={(event) => setDraftStatus(event.target.value)}
                    >
                      <option value="not_completed">Chưa hoàn thành</option>
                      <option value="completed">Hoàn thành</option>
                    </select>
                  </label>

                  <label className="field field-full">
                    <span>Ghi chú cập nhật</span>
                    <textarea
                      rows="4"
                      value={draftNote}
                      onChange={(event) => setDraftNote(event.target.value)}
                      placeholder="Ví dụ: Đã gửi kết quả cuối, hoặc cần trả lại để làm lại."
                    />
                  </label>

                  <div className="modal-actions">
                    <button type="submit" className="primary-button" disabled={isSaving}>
                      {isSaving ? 'Đang lưu...' : 'Lưu trạng thái'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="empty-card compact">
                  <strong>Task đang ở chế độ chỉ xem.</strong>
                  <p>
                    Người phụ trách task hoặc người giao việc trực tiếp mới có thể đổi
                    giữa trạng thái hoàn thành và chưa hoàn thành.
                  </p>
                </div>
              )}
            </article>
          </div>
        ) : null}

        {activeTab === 'subtasks' ? (
          <div className="subtask-grid">
            {childTasks.length === 0 ? (
              <div className="empty-card compact">
                <strong>Task này chưa có subtask trực tiếp.</strong>
                <p>Hãy dùng nút "Tạo subtask" hoặc "Chia task" để phân rã tiếp.</p>
              </div>
            ) : null}

            {childTasks.map((childTask) => {
              const childAssignee = usersById[childTask.assignedTo]

              return (
                <button
                  key={childTask.id}
                  type="button"
                  className="subtask-card"
                  onClick={() => onSelectTask(childTask.id)}
                >
                  <div className="subtask-card-topline">
                    <strong>{childTask.title}</strong>
                    <span className={`badge status-${childTask.status}`}>
                      {getStatusLabel(childTask.status)}
                    </span>
                  </div>
                  <p>{truncateText(childTask.description, 120)}</p>
                  <div className="subtask-card-meta">
                    <span>{childAssignee?.name ?? 'Chưa giao'}</span>
                    <span>{getPriorityLabel(childTask.priority)}</span>
                    <span>{formatDate(childTask.deadline)}</span>
                    {childTask.childTaskCount > 0 ? (
                      <span>{formatPercent(childTask.progress)}</span>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        ) : null}

        {activeTab === 'history' ? <TaskHistoryPanel entries={activityEntries} /> : null}
        {activeTab === 'edits' ? <EditHistoryList entries={editEntries} /> : null}
      </div>
    </section>
  )
}

export default TaskDetailPanel
