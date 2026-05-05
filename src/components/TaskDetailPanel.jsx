import { useEffect, useState } from 'react'
import {
  formatDate,
  formatDateTime,
  formatPercent,
  getPriorityLabel,
  getStatusLabel,
} from '../utils/formatters'
import {
  canCreateChildTask,
  canEditTask,
  canSplitTask,
  canUpdateExecution,
  getTaskChildren,
  getTaskCommentEntries,
  getTaskHistoryEntries,
  isTaskLate,
} from '../utils/taskUtils'
import EditHistoryList from './EditHistoryList'
import TaskDiscussionPanel from './TaskDiscussionPanel'
import TaskHistoryPanel from './TaskHistoryPanel'

const tabs = [
  { id: 'overview', label: 'Thông tin chung' },
  { id: 'activity', label: 'Lịch sử & chỉnh sửa' },
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
  commentsById,
  visibleIdSet,
  onOpenCreateRoot = null,
  onOpenCreateSubtask,
  onOpenSplit,
  onOpenEdit,
  onUpdateExecution,
  onAddComment,
  isSaving,
  className = '',
  onClose = null,
  canOpenTreeView = false,
  onOpenTaskTree = null,
  treeActionLabel = 'Mở nhánh dạng tree',
}) {
  const [activeTab, setActiveTab] = useState('overview')
  const [draftStatus, setDraftStatus] = useState('pending')
  const [draftProgress, setDraftProgress] = useState(0)
  const [draftNote, setDraftNote] = useState('')

  useEffect(() => {
    if (!task) {
      setDraftStatus('pending')
      setDraftProgress(0)
      setDraftNote('')
      return
    }

    const nextStatus =
      task.status === 'completed' ||
      task.status === 'cancelled' ||
      task.status === 'in_progress'
        ? task.status
        : 'pending'

    setDraftStatus(nextStatus)
    setDraftProgress(
      nextStatus === 'completed'
        ? 100
        : nextStatus === 'cancelled'
          ? 0
          : Math.min(Number(task.progress ?? 0), 99),
    )
    setDraftNote('')
  }, [task?.id, task?.progress, task?.status, task?.updatedAt])

  useEffect(() => {
    if (!['overview', 'discussion', 'activity'].includes(activeTab)) {
      setActiveTab('overview')
    }
  }, [activeTab])

  if (!task) {
    return (
      <section className={`detail-panel empty ${className}`.trim()}>
        <div className="detail-empty">
          <h2>Chọn công việc để xem chi tiết</h2>
        </div>
      </section>
    )
  }

  const creator = usersById[task.createdBy]
  const assignee = usersById[task.assignedTo]
  const assigneeManager = assignee?.managerId ? usersById[assignee.managerId] : null
  const childTasks = getTaskChildren(tasksById, task.id, visibleIdSet)
  const historyEntries = getTaskHistoryEntries(historyById, task.id)
  const commentEntries = getTaskCommentEntries(commentsById, task.id)
  const activityEntries = historyEntries.filter(
    (entry) => entry.actionType !== 'edit' || entry.fieldName === 'note',
  )
  const editEntries = historyEntries.filter(
    (entry) => entry.actionType === 'edit' && entry.fieldName !== 'note',
  )
  const combinedActivityCount = activityEntries.length + editEntries.length
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
  const descriptionText = task.description?.trim() ?? ''
  const showDescriptionCard = descriptionText.length > 180
  const progressValue = Math.min(Number(task.progress ?? 0), 100)
  const totalTaskCount = hasChildren ? task.childTaskCount : 1
  const completedTaskCount =
    hasChildren ? task.completedChildCount : task.status === 'completed' ? 1 : 0
  const supportInfo = [
    { label: 'Người tạo', value: creator?.name ?? 'Không rõ' },
    {
      label: 'Báo cáo cho',
      value: assignee ? assigneeManager?.name ?? 'Cấp cao nhất' : 'Chưa rõ',
    },
    { label: 'Cập nhật cuối', value: formatDateTime(task.updatedAt) },
    { label: 'Log hoạt động', value: `${historyEntries.length} lượt` },
    { label: 'Trao doi', value: `${commentEntries.length} tin nhan` },
  ]

  const normalizedCompletedAtLabel = task.completedAt
    ? formatDateTime(task.completedAt)
    : 'Chưa hoàn thành'

  const handleDraftStatusChange = (nextStatus) => {
    setDraftStatus(nextStatus)

    if (nextStatus === 'completed') {
      setDraftProgress(100)
      return
    }

    if (nextStatus === 'cancelled' || nextStatus === 'pending') {
      setDraftProgress(0)
      return
    }

    setDraftProgress((currentValue) => {
      if (currentValue > 0 && currentValue < 100) {
        return currentValue
      }

      return Number(task?.progress ?? 0) > 0 ? Math.min(Number(task.progress), 99) : 10
    })
  }

  const submitExecution = async (event) => {
    event.preventDefault()

    const payload = hasChildren
      ? {
          confirmed: !branchCompleted,
          note: draftNote,
        }
      : {
          status: draftStatus,
          progress: draftProgress,
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
        <div className="detail-title-row">
          <div>
            <h2>{task.title}</h2>
          </div>

          <div className="detail-actions">
            {onOpenCreateRoot ? (
              <button type="button" className="ghost-button" onClick={onOpenCreateRoot}>
                Tạo task mới
              </button>
            ) : null}
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
                Tạo node con
              </button>
            ) : null}
            {allowSplit ? (
              <button type="button" className="primary-button" onClick={onOpenSplit}>
                Tạo nhiều node
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

        <div className="detail-progress-block">
          <div className="detail-progress-header">
            <span>Tiến độ thực tế</span>
            <strong>{formatPercent(progressValue)}</strong>
          </div>
          <div className="detail-progress-track">
            <div className="detail-progress-fill" style={{ width: `${progressValue}%` }} />
          </div>
          <p className="detail-progress-caption">
            {hasChildren
              ? `${completedTaskCount}/${totalTaskCount} công việc hoàn thành`
              : getStatusLabel(task.status)}
          </p>
        </div>

        <div className="detail-metrics">
          <InfoTile label="Người phụ trách" value={assignee?.name ?? 'Chưa giao'} />
          <InfoTile label="Phòng ban" value={assignee?.department ?? creator?.department ?? 'Chưa rõ'} />
          <InfoTile label="Ngày tạo" value={formatDateTime(task.createdAt)} />
          <InfoTile label="Ngày hoàn thành" value={normalizedCompletedAtLabel} />
          <InfoTile label="CV hoàn thành" value={String(completedTaskCount)} />
          <InfoTile label="Tổng số CV" value={String(totalTaskCount)} />
          <InfoTile label="Deadline" value={formatDate(task.deadline)} accent={late ? 'danger-text' : ''} />
        </div>
      </div>

      <div className="detail-tab-row">
        {[
          tabs[0],
          {
            id: 'discussion',
            label:
              commentEntries.length > 0
                ? `Trao doi (${commentEntries.length})`
                : 'Trao doi',
          },
          {
            id: 'activity',
            label:
              combinedActivityCount > 0
                ? `Lịch sử & chỉnh sửa (${combinedActivityCount})`
                : 'Lịch sử & chỉnh sửa',
          },
        ].map((tab) => (
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
          <div className={`overview-grid ${showDescriptionCard ? '' : 'single-column'}`.trim()}>
            {showDescriptionCard ? (
              <article className="content-card detail-description-card">
                <div className="content-card-header">
                  <h3>Mô tả đầy đủ</h3>
                </div>
                <p>{descriptionText}</p>
              </article>
            ) : null}

            <article className="content-card detail-support-card">
              <div className="content-card-header">
                <h3>Thông tin bổ sung</h3>
              </div>
              <div className="detail-list">
                {supportInfo.map((item) => (
                  <div key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="content-card execution-card">
              <div className="content-card-header">
                <h3>{hasChildren ? 'Theo dõi tiến độ nhánh' : 'Cập nhật kết quả task'}</h3>
                <span className="subtle-label">
                  {hasChildren ? 'Tổng hợp từ node con' : 'Cập nhật trạng thái thực thi'}
                </span>
              </div>

              {hasChildren ? (
                <div className="execution-readout">
                  <div className="execution-summary-grid">
                    <div className="execution-summary-card">
                      <span>Hoàn thành</span>
                      <strong>
                        {task.completedChildCount}/{task.childTaskCount} task con
                      </strong>
                    </div>
                    <div className="execution-summary-card">
                      <span>Trạng thái nhánh</span>
                      <strong>{getStatusLabel(task.status)}</strong>
                    </div>
                    <div className="execution-summary-card">
                      <span>Tiến độ</span>
                      <strong>{formatPercent(task.progress)}</strong>
                    </div>
                  </div>

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
                                ? 'Nhập lý do mở lại nhánh.'
                                : 'Nhập ghi chú xác nhận.'
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
                        <strong>Chưa thể xác nhận nhánh.</strong>
                        <p>Hoàn tất toàn bộ node con để tiếp tục.</p>
                      </div>
                    )
                  ) : (
                    <div className="empty-card compact">
                      <strong>Bạn không có quyền xác nhận nhánh này.</strong>
                      <p>Chỉ người phụ trách nhánh có thể thao tác.</p>
                    </div>
                  )}

                  {branchWaitingConfirmation ? (
                    <div className="inline-status-note">Đang chờ xác nhận hoàn tất.</div>
                  ) : null}
                </div>
              ) : allowUpdate ? (
                <form className="execution-form" onSubmit={submitExecution}>
                  <label className="field">
                    <span>Trạng thái kết quả</span>
                    <select
                      value={draftStatus}
                      onChange={(event) => handleDraftStatusChange(event.target.value)}
                    >
                      <option value="pending">Chưa thực hiện</option>
                      <option value="in_progress">Đang xử lý</option>
                      <option value="completed">Hoàn thành</option>
                      <option value="cancelled">Hủy</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>Tiến độ %</span>
                    <div className="progress-editor">
                      <input
                        type="range"
                        min="0"
                        max={draftStatus === 'in_progress' ? '99' : '100'}
                        step="1"
                        value={draftProgress}
                        disabled={draftStatus !== 'in_progress'}
                        onChange={(event) => setDraftProgress(Number(event.target.value))}
                      />
                      <strong>{formatPercent(draftProgress)}</strong>
                    </div>
                  </label>

                  <label className="field field-full">
                    <span>Ghi chú cập nhật</span>
                    <textarea
                      rows="4"
                      value={draftNote}
                      onChange={(event) => setDraftNote(event.target.value)}
                      placeholder="Nhập ghi chú cập nhật."
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
                  <strong>Bạn không có quyền cập nhật task này.</strong>
                  <p>Chỉ người phụ trách hoặc người giao việc có thể thao tác.</p>
                </div>
              )}
            </article>
          </div>
        ) : null}

        {activeTab === 'discussion' ? (
          <TaskDiscussionPanel
            key={task.id}
            taskId={task.id}
            currentUser={currentUser}
            usersById={usersById}
            entries={commentEntries}
            onSubmitComment={onAddComment}
            isSaving={isSaving}
          />
        ) : null}

        {activeTab === 'activity' ? (
          <div className="activity-log-grid">
            <article className="content-card">
              <div className="content-card-header">
                <h3>Lịch sử hoạt động</h3>
                <span className="subtle-label">{activityEntries.length} mục</span>
              </div>
              <TaskHistoryPanel entries={activityEntries} />
            </article>

            <article className="content-card">
              <div className="content-card-header">
                <h3>Nhật ký chỉnh sửa</h3>
                <span className="subtle-label">{editEntries.length} thay đổi</span>
              </div>
              <EditHistoryList entries={editEntries} />
            </article>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default TaskDetailPanel
