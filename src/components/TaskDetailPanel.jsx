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
  getTaskDocumentEntries,
  getTaskHistoryEntries,
  isTaskLate,
} from '../utils/taskUtils'
import EditHistoryList from './EditHistoryList'
import TaskDiscussionPanel from './TaskDiscussionPanel'
import TaskDocumentsPanel from './TaskDocumentsPanel'
import TaskHistoryPanel from './TaskHistoryPanel'

const tabs = [
  { id: 'overview', label: 'Thông tin chung' },
  { id: 'activity', label: 'Lịch sử & chỉnh sửa' },
]

const BRANCH_SEGMENT_COLORS = [
  '#3b82f6',
  '#06b6d4',
  '#14b8a6',
  '#8b5cf6',
  '#f59e0b',
  '#ef4444',
]

function clampProgress(value) {
  const normalized = Number(value ?? 0)

  if (Number.isNaN(normalized)) {
    return 0
  }

  return Math.max(0, Math.min(normalized, 100))
}

function InfoTile({ label, value, accent }) {
  return (
    <div className="info-tile">
      <span>{label}</span>
      <strong className={accent || ''}>{value}</strong>
    </div>
  )
}

function buildBranchProgressItems(childTasks, tasksById, visibleIdSet, usersById) {
  return childTasks.map((childTask, childIndex) => {
    const directChildren = getTaskChildren(tasksById, childTask.id, visibleIdSet)
    const sources = directChildren.length > 0 ? directChildren : [childTask]
    const branchProgress = clampProgress(childTask.progress)
    const rawSegments = sources.map((sourceTask, sourceIndex) => {
      const actualProgress = clampProgress(sourceTask.progress)
      const rawContribution =
        directChildren.length > 0 ? actualProgress / sources.length : actualProgress

      return {
        id: sourceTask.id,
        title: sourceTask.title,
        actualProgress,
        rawContribution,
        color:
          BRANCH_SEGMENT_COLORS[
            (childIndex + sourceIndex) % BRANCH_SEGMENT_COLORS.length
          ],
      }
    })
    const rawTotal = rawSegments.reduce(
      (total, segment) => total + segment.rawContribution,
      0,
    )
    const scale = rawTotal > 0 ? branchProgress / rawTotal : 0

    return {
      task: childTask,
      assignee: usersById[childTask.assignedTo],
      progress: branchProgress,
      segments: rawSegments.map((segment) => ({
        ...segment,
        contribution: Number((segment.rawContribution * scale).toFixed(2)),
      })),
    }
  })
}

function TaskDetailPanel({
  currentUser,
  task,
  tasksById,
  usersById,
  historyById,
  commentsById,
  documentsById,
  visibleIdSet,
  onSelectTask = null,
  onOpenCreateRoot = null,
  onOpenCreateSubtask,
  onOpenSplit,
  onOpenEdit,
  onUpdateExecution,
  onAddComment,
  onUploadDocuments,
  isSaving,
  isUploadingDocuments = false,
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
    if (!['overview', 'documents', 'discussion', 'activity'].includes(activeTab)) {
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
  const documentEntries = getTaskDocumentEntries(documentsById, task.id)
  const activityEntries = historyEntries.filter(
    (entry) => entry.actionType !== 'edit' || entry.fieldName === 'note',
  )
  const editEntries = historyEntries.filter(
    (entry) => entry.actionType === 'edit' && entry.fieldName !== 'note',
  )
  const branchProgressItems = buildBranchProgressItems(
    childTasks,
    tasksById,
    visibleIdSet,
    usersById,
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
  const progressValue = clampProgress(task.progress)
  const totalTaskCount = hasChildren ? task.childTaskCount : 1
  const completedTaskCount =
    hasChildren ? task.completedChildCount : task.status === 'completed' ? 1 : 0
  const normalizedCompletedAtLabel = task.completedAt
    ? formatDateTime(task.completedAt)
    : 'Chưa hoàn thành'

  const primarySummaryItems = [
    { label: 'Người phụ trách', value: assignee?.name ?? 'Chưa giao' },
    {
      label: 'Phòng ban',
      value: assignee?.department ?? creator?.department ?? 'Chưa rõ',
    },
    { label: 'Ngày tạo', value: formatDateTime(task.createdAt) },
    { label: 'Ngày hoàn thành', value: normalizedCompletedAtLabel },
    { label: 'Deadline', value: formatDate(task.deadline), accent: late ? 'danger-text' : '' },
  ]
  const secondarySummaryItems = [
    { label: 'Công việc hoàn thành', value: `${completedTaskCount}/${totalTaskCount}` },
    { label: 'Người tạo', value: creator?.name ?? 'Không rõ' },
    { label: 'Báo cáo cho', value: assigneeManager?.name ?? 'Cấp cao nhất' },
    { label: 'Hoạt động', value: `${historyEntries.length} log` },
    { label: 'Trao đổi', value: `${commentEntries.length} tin nhắn` },
    { label: 'Tài liệu', value: `${documentEntries.length} tệp` },
  ]

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

      return Number(task.progress ?? 0) > 0 ? Math.min(Number(task.progress), 99) : 10
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

        {descriptionText ? (
          <div className="detail-description-inline">
            <span>Chi tiết mô tả công việc</span>
            <p>{descriptionText}</p>
          </div>
        ) : null}
      </div>

      <div className="detail-tab-row">
        {[
          tabs[0],
          {
            id: 'documents',
            label:
              documentEntries.length > 0
                ? `Tài liệu đồ án (${documentEntries.length})`
                : 'Tài liệu đồ án',
          },
          {
            id: 'discussion',
            label:
              commentEntries.length > 0
                ? `Trao đổi (${commentEntries.length})`
                : 'Trao đổi',
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
          <div className="overview-stack">
            <article className="content-card summary-overview-card">
              <div className="content-card-header summary-overview-header">
                <h3>Thống kê cơ bản</h3>
                <span className="subtle-label">Tổng quan nhanh của task đang chọn</span>
              </div>

              <div className="detail-progress-block summary-progress-block">
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

              <div className="summary-primary-grid">
                {primarySummaryItems.map((item) => (
                  <InfoTile
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    accent={item.accent}
                  />
                ))}
              </div>

              <div className="summary-chip-row">
                {secondarySummaryItems.map((item) => (
                  <div key={item.label} className="summary-chip">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </article>

            {hasChildren ? (
              <article className="content-card branch-progress-card">
                <div className="content-card-header branch-progress-header">
                  <div>
                    <h3>Theo dõi tiến độ nhánh</h3>
                    <p>Tiến độ các node con gần nhất</p>
                  </div>
                  <div className="branch-progress-hint">
                    <span>Biểu đồ các node con trực tiếp gần nhất</span>
                    <span>Nhấn vào từng cột để mở task con tương ứng.</span>
                  </div>
                </div>

                <div className="branch-progress-grid">
                  {branchProgressItems.map((item) => (
                    <button
                      key={item.task.id}
                      type="button"
                      className={`branch-progress-column ${onSelectTask ? 'is-clickable' : ''}`}
                      onClick={() => onSelectTask?.(item.task.id)}
                    >
                      <div className="branch-progress-topline">
                        <strong>{formatPercent(item.progress)}</strong>
                      </div>

                      <div className="branch-progress-track-shell">
                        <div className="branch-progress-track">
                          <div className="branch-progress-guides" aria-hidden="true" />

                          {item.segments.some((segment) => segment.contribution > 0) ? (
                            <div className="branch-progress-fill-stack">
                              {item.segments.map((segment) => (
                                <div
                                  key={segment.id}
                                  className="branch-progress-segment"
                                  style={{
                                    height: `${segment.contribution}%`,
                                    background: segment.color,
                                  }}
                                  title={`${segment.title}: ${formatPercent(segment.actualProgress)}`}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="branch-progress-zero-line" aria-hidden="true" />
                          )}
                        </div>
                      </div>

                      <div className="branch-progress-copy">
                        <strong title={item.task.title}>{item.task.title}</strong>
                        <span>{item.assignee?.name ?? 'Chưa giao'}</span>
                      </div>

                      <div className="branch-progress-segment-list">
                        {item.segments.map((segment) => (
                          <span
                            key={segment.id}
                            className="branch-progress-segment-chip"
                            title={segment.title}
                            style={{ '--segment-color': segment.color }}
                          >
                            {formatPercent(segment.actualProgress)}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="branch-progress-footer">
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
                      <div className="empty-card compact branch-progress-empty">
                        <strong>Chưa thể xác nhận nhánh.</strong>
                        <p>Hoàn tất toàn bộ node con để tiếp tục.</p>
                      </div>
                    )
                  ) : (
                    <div className="empty-card compact branch-progress-empty">
                      <strong>Bạn không có quyền xác nhận nhánh này.</strong>
                      <p>Chỉ người phụ trách nhánh có thể thao tác.</p>
                    </div>
                  )}

                  {branchWaitingConfirmation ? (
                    <div className="inline-status-note">Đang chờ xác nhận hoàn tất.</div>
                  ) : null}
                </div>
              </article>
            ) : (
              <article className="content-card execution-card">
                <div className="content-card-header">
                  <h3>Cập nhật tiến độ task</h3>
                  <span className="subtle-label">Cập nhật trạng thái thực thi</span>
                </div>

                {allowUpdate ? (
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
            )}
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

        {activeTab === 'documents' ? (
          <TaskDocumentsPanel
            currentUser={currentUser}
            entries={documentEntries}
            onUploadDocuments={onUploadDocuments}
            isUploading={isUploadingDocuments}
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
