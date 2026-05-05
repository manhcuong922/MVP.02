import {
  FIELD_LABELS,
  PRIORITY_LABELS,
  ROLE_LEVELS,
  STATUS_LABELS,
} from '../data/demoData'
import { deriveTaskMetrics, getTaskAncestorIds, getTaskChildren } from './taskUtils'

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 14)}`
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeExecutionStatus(status) {
  if (status === 'completed') {
    return 'completed'
  }

  if (status === 'cancelled') {
    return 'cancelled'
  }

  if (status === 'in_progress') {
    return 'in_progress'
  }

  return 'pending'
}

function clampProgress(value, min = 0, max = 100) {
  const normalized = Number(value ?? 0)

  if (Number.isNaN(normalized)) {
    return min
  }

  return Math.min(max, Math.max(min, normalized))
}

function formatDisplayValue(fieldName, value, usersById) {
  if (fieldName === 'assignedTo') {
    return usersById[value]?.name ?? value ?? 'Chưa giao'
  }

  if (fieldName === 'priority') {
    return PRIORITY_LABELS[value] ?? value ?? ''
  }

  if (fieldName === 'status') {
    return STATUS_LABELS[value] ?? value ?? ''
  }

  if (fieldName === 'progress') {
    return `${Number(value ?? 0)}%`
  }

  return value ?? ''
}

function createHistoryEntry({
  taskId,
  actionType,
  actor,
  fieldName = '',
  oldValue = '',
  newValue = '',
  note = '',
  createdAt,
}) {
  return {
    id: createId('history'),
    taskId,
    actionType,
    actorId: actor.id,
    actorName: actor.name,
    fieldName,
    oldValue,
    newValue,
    note,
    createdAt,
  }
}

function createCommentEntry({ taskId, actor, message, createdAt }) {
  return {
    id: createId('comment'),
    taskId,
    authorId: actor.id,
    authorName: actor.name,
    message,
    createdAt,
  }
}

function createDocumentEntry({
  taskId,
  actor,
  name,
  mimeType,
  size,
  kind,
  downloadUrl,
  storagePath,
  createdAt,
}) {
  return {
    id: createId('document'),
    taskId,
    uploadedBy: actor.id,
    uploaderName: actor.name,
    name,
    mimeType,
    size,
    kind,
    downloadUrl,
    storagePath,
    createdAt,
  }
}

export function buildCreateTaskMutation({
  currentUser,
  parentTask,
  values,
  usersById,
}) {
  const createdAt = nowIso()
  const taskId = createId('task')
  const assignedUser = usersById[values.assignedTo]
  const rootTaskId = parentTask?.rootTaskId ?? taskId
  const newTask = {
    id: taskId,
    title: values.title.trim(),
    description: values.description.trim(),
    parentTaskId: parentTask?.id ?? null,
    rootTaskId,
    createdBy: currentUser.id,
    assignedTo: values.assignedTo,
    roleLevel: ROLE_LEVELS[assignedUser?.role] ?? 0,
    status: 'pending',
    priority: values.priority,
    progress: 0,
    completionConfirmed: false,
    completedAt: null,
    deadline: values.deadline,
    childrenIds: [],
    createdAt,
    updatedAt: createdAt,
  }

  const updates = {
    [`/tasks/${taskId}`]: newTask,
  }

  if (parentTask) {
    updates[`/tasks/${parentTask.id}`] = {
      ...parentTask,
      childrenIds: [...(parentTask.childrenIds ?? []), taskId],
      updatedAt: createdAt,
    }
  }

  const createLog = createHistoryEntry({
    taskId,
    actionType: 'create',
    actor: currentUser,
    note: `Tạo ${parentTask ? 'subtask' : 'task gốc'} "${values.title.trim()}".`,
    createdAt,
  })

  const assignLog = createHistoryEntry({
    taskId,
    actionType: 'assign',
    actor: currentUser,
    fieldName: 'assignedTo',
    oldValue: 'Chưa giao',
    newValue: formatDisplayValue('assignedTo', values.assignedTo, usersById),
    note: `${currentUser.name} giao task cho ${assignedUser?.name ?? 'người phụ trách'}.`,
    createdAt,
  })

  updates[`/taskHistory/${createLog.id}`] = createLog
  updates[`/taskHistory/${assignLog.id}`] = assignLog

  return {
    taskId,
    updates,
  }
}

export function buildSplitTaskMutation({
  currentUser,
  parentTask,
  items,
  usersById,
}) {
  const createdAt = nowIso()
  const updates = {}
  const createdIds = []

  for (const item of items) {
    const taskId = createId('task')
    const assignedUser = usersById[item.assignedTo]
    createdIds.push(taskId)

    updates[`/tasks/${taskId}`] = {
      id: taskId,
      title: item.title.trim(),
      description: item.description.trim(),
      parentTaskId: parentTask.id,
      rootTaskId: parentTask.rootTaskId,
      createdBy: currentUser.id,
      assignedTo: item.assignedTo,
      roleLevel: ROLE_LEVELS[assignedUser?.role] ?? 0,
      status: 'pending',
      priority: item.priority,
      progress: 0,
      completionConfirmed: false,
      completedAt: null,
      deadline: item.deadline,
      childrenIds: [],
      createdAt,
      updatedAt: createdAt,
    }

    const createLog = createHistoryEntry({
      taskId,
      actionType: 'create',
      actor: currentUser,
      note: `Tạo subtask "${item.title.trim()}" từ task cha "${parentTask.title}".`,
      createdAt,
    })

    const assignLog = createHistoryEntry({
      taskId,
      actionType: 'assign',
      actor: currentUser,
      fieldName: 'assignedTo',
      oldValue: 'Chưa giao',
      newValue: formatDisplayValue('assignedTo', item.assignedTo, usersById),
      note: `${currentUser.name} giao subtask cho ${assignedUser?.name ?? 'người phụ trách'}.`,
      createdAt,
    })

    updates[`/taskHistory/${createLog.id}`] = createLog
    updates[`/taskHistory/${assignLog.id}`] = assignLog
  }

  updates[`/tasks/${parentTask.id}`] = {
    ...parentTask,
    childrenIds: [...(parentTask.childrenIds ?? []), ...createdIds],
    updatedAt: createdAt,
  }

  const splitLog = createHistoryEntry({
    taskId: parentTask.id,
    actionType: 'split',
    actor: currentUser,
    note: `Chia task thành ${items.length} subtask: ${items
      .map((item) => item.title.trim())
      .join(', ')}.`,
    createdAt,
  })

  updates[`/taskHistory/${splitLog.id}`] = splitLog

  return {
    firstTaskId: createdIds[0] ?? null,
    updates,
  }
}

export function buildEditTaskMutation({ currentUser, task, values, usersById }) {
  const assignedUser = usersById[values.assignedTo]
  const editedTask = {
    ...task,
    title: values.title.trim(),
    description: values.description.trim(),
    assignedTo: values.assignedTo,
    roleLevel: ROLE_LEVELS[assignedUser?.role] ?? task.roleLevel ?? 0,
    priority: values.priority,
    deadline: values.deadline,
    updatedAt: nowIso(),
  }

  const fieldsToCheck = ['title', 'description', 'assignedTo', 'priority', 'deadline']
  const changedFields = fieldsToCheck.filter((field) => editedTask[field] !== task[field])

  if (changedFields.length === 0) {
    return null
  }

  const updates = {
    [`/tasks/${task.id}`]: editedTask,
  }

  for (const fieldName of changedFields) {
    const isAssigneeChange = fieldName === 'assignedTo'
    const entry = createHistoryEntry({
      taskId: task.id,
      actionType: isAssigneeChange ? 'assign' : 'edit',
      actor: currentUser,
      fieldName,
      oldValue: formatDisplayValue(fieldName, task[fieldName], usersById),
      newValue: formatDisplayValue(fieldName, editedTask[fieldName], usersById),
      note: isAssigneeChange
        ? `${currentUser.name} cập nhật người phụ trách từ ${
            formatDisplayValue(fieldName, task[fieldName], usersById) || 'Chưa giao'
          } sang ${formatDisplayValue(fieldName, editedTask[fieldName], usersById)}.`
        : `${currentUser.name} chỉnh sửa ${
            FIELD_LABELS[fieldName] ?? fieldName.toLowerCase()
          }.`,
      createdAt: editedTask.updatedAt,
    })

    updates[`/taskHistory/${entry.id}`] = entry
  }

  return {
    taskId: task.id,
    updates,
  }
}

export function buildExecutionUpdateMutation({
  currentUser,
  task,
  tasksById,
  values,
  usersById,
}) {
  const updatedAt = nowIso()
  const noteText = values.note?.trim() ?? ''
  const hasChildren = getTaskChildren(tasksById, task.id).length > 0
  const currentDerivedTasks = deriveTaskMetrics(tasksById)
  const currentDerivedTask = currentDerivedTasks[task.id] ?? task
  let nextTask

  if (hasChildren) {
    nextTask = {
      ...task,
      completionConfirmed: Boolean(values.confirmed),
      completedAt: values.confirmed ? task.completedAt ?? updatedAt : null,
      updatedAt,
    }
  } else {
    const normalizedStatus = normalizeExecutionStatus(values.status)
    const nextProgress =
      normalizedStatus === 'completed'
        ? 100
        : normalizedStatus === 'cancelled'
          ? 0
          : normalizedStatus === 'in_progress'
            ? clampProgress(values.progress, 0, 99)
            : 0

    nextTask = {
      ...task,
      status: normalizedStatus,
      progress: nextProgress,
      completionConfirmed: false,
      completedAt: normalizedStatus === 'completed' ? updatedAt : null,
      updatedAt,
    }
  }

  const nextTasksById = {
    ...tasksById,
    [task.id]: nextTask,
  }
  const nextDerivedTasks = deriveTaskMetrics(nextTasksById)
  const impactedTaskIds = [task.id, ...getTaskAncestorIds(nextTasksById, task.id)]

  const updates = {}

  for (const impactedTaskId of impactedTaskIds) {
    const previousTask = tasksById[impactedTaskId]
    const rawTask = nextTasksById[impactedTaskId]
    const derivedTask = nextDerivedTasks[impactedTaskId]

    if (!previousTask || !rawTask || !derivedTask) {
      continue
    }

    const resolvedConfirmation = derivedTask.isLeafNode
      ? false
      : derivedTask.allChildrenCompleted
        ? Boolean(rawTask.completionConfirmed ?? previousTask.completionConfirmed)
        : false
    const changed =
      previousTask.status !== derivedTask.status ||
      Number(previousTask.progress ?? 0) !== Number(derivedTask.progress ?? 0) ||
      Boolean(previousTask.completionConfirmed) !== resolvedConfirmation

    if (!changed) {
      continue
    }

    const persistedTask = {
      ...rawTask,
      status: derivedTask.status,
      progress: derivedTask.progress,
      completionConfirmed: resolvedConfirmation,
      completedAt:
        derivedTask.status === 'completed'
          ? rawTask.completedAt ?? previousTask.completedAt ?? updatedAt
          : null,
      updatedAt,
    }

    nextTasksById[impactedTaskId] = persistedTask
    updates[`/tasks/${impactedTaskId}`] = persistedTask
  }

  const nextDerivedTask = nextDerivedTasks[task.id] ?? currentDerivedTask
  const statusChangeNote = hasChildren
    ? nextDerivedTask.status === 'completed'
      ? `${currentUser.name} xác nhận hoàn thành toàn bộ nhánh công việc.`
      : `${currentUser.name} mở lại nhánh công việc để tiếp tục theo dõi.`
    : `${currentUser.name} cập nhật trạng thái từ ${
        STATUS_LABELS[currentDerivedTask.status] ?? currentDerivedTask.status
      } sang ${STATUS_LABELS[nextDerivedTask.status] ?? nextDerivedTask.status}.`

  if (nextDerivedTask.status !== currentDerivedTask.status) {
    const entry = createHistoryEntry({
      taskId: task.id,
      actionType: 'status_change',
      actor: currentUser,
      fieldName: 'status',
      oldValue: formatDisplayValue('status', currentDerivedTask.status, usersById),
      newValue: formatDisplayValue('status', nextDerivedTask.status, usersById),
      note: noteText || statusChangeNote,
      createdAt: updatedAt,
    })

    updates[`/taskHistory/${entry.id}`] = entry
  }

  if (noteText && !updates[`/tasks/${task.id}`]) {
    updates[`/tasks/${task.id}`] = {
      ...nextTasksById[task.id],
      updatedAt,
    }
  }

  if (noteText) {
    const entry = createHistoryEntry({
      taskId: task.id,
      actionType: 'edit',
      actor: currentUser,
      fieldName: 'note',
      oldValue: '',
      newValue: noteText,
      note: noteText,
      createdAt: updatedAt,
    })

    updates[`/taskHistory/${entry.id}`] = entry
  }

  if (Object.keys(updates).length === 0) {
    return null
  }

  return {
    taskId: task.id,
    updates,
  }
}

export function buildTaskCommentMutation({ currentUser, task, message }) {
  const trimmedMessage = message?.trim() ?? ''

  if (!trimmedMessage) {
    return null
  }

  const createdAt = nowIso()
  const entry = createCommentEntry({
    taskId: task.id,
    actor: currentUser,
    message: trimmedMessage,
    createdAt,
  })

  return {
    commentId: entry.id,
    updates: {
      [`/taskComments/${entry.id}`]: entry,
    },
  }
}

export function buildTaskDocumentMutation({ currentUser, task, uploads }) {
  if (!Array.isArray(uploads) || uploads.length === 0) {
    return null
  }

  const updates = {}
  const documentIds = []

  uploads.forEach((upload) => {
    const entry = createDocumentEntry({
      taskId: task.id,
      actor: currentUser,
      name: upload.name,
      mimeType: upload.mimeType,
      size: upload.size,
      kind: upload.kind,
      downloadUrl: upload.downloadUrl,
      storagePath: upload.storagePath,
      createdAt: upload.createdAt ?? nowIso(),
    })

    const log = createHistoryEntry({
      taskId: task.id,
      actionType: 'upload',
      actor: currentUser,
      note: `${currentUser.name} tai len tai lieu "${entry.name}".`,
      createdAt: entry.createdAt,
    })

    documentIds.push(entry.id)
    updates[`/taskDocuments/${entry.id}`] = entry
    updates[`/taskHistory/${log.id}`] = log
  })

  return {
    documentIds,
    updates,
  }
}
