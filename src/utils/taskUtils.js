import { PRIORITY_LABELS, ROLE_LEVELS, STATUS_LABELS } from '../data/demoData'

function toArray(collection) {
  return Object.values(collection ?? {})
}

function sortByRoleAndName(a, b) {
  const roleDiff = (ROLE_LEVELS[a.role] ?? 99) - (ROLE_LEVELS[b.role] ?? 99)

  if (roleDiff !== 0) {
    return roleDiff
  }

  return a.name.localeCompare(b.name, 'vi')
}

function floorPercent(completed, total) {
  if (!total) {
    return 0
  }

  return Math.floor((completed / total) * 100)
}

function getLegacyCompletionConfirmed(task) {
  if (!task) {
    return false
  }

  return Boolean(task.completionConfirmed ?? (task.status === 'completed'))
}

export function getDirectReports(usersById, managerId) {
  return toArray(usersById)
    .filter((user) => user.managerId === managerId)
    .sort(sortByRoleAndName)
}

export function getSubordinateIds(usersById, managerId) {
  const queue = getDirectReports(usersById, managerId).map((user) => user.id)
  const visited = new Set()

  while (queue.length > 0) {
    const currentUserId = queue.shift()

    if (visited.has(currentUserId)) {
      continue
    }

    visited.add(currentUserId)

    for (const child of getDirectReports(usersById, currentUserId)) {
      queue.push(child.id)
    }
  }

  return [...visited]
}

export function getAccessibleUserIds(usersById, currentUserId) {
  return [currentUserId, ...getSubordinateIds(usersById, currentUserId)]
}

export function getAllowedAssignees(usersById, currentUserId) {
  return getDirectReports(usersById, currentUserId)
}

export function canCreateRootTask(user) {
  return user?.role === 'ceo'
}

export function canCreateChildTask(user, task, usersById) {
  if (!user || !task) {
    return false
  }

  return task.assignedTo === user.id && getAllowedAssignees(usersById, user.id).length > 0
}

export function canSplitTask(user, task, usersById) {
  return canCreateChildTask(user, task, usersById)
}

export function canEditTask(user, task) {
  if (!user || !task) {
    return false
  }

  return task.assignedTo === user.id || task.createdBy === user.id
}

export function canUpdateExecution(user, task, tasksById, visibleIdSet) {
  if (!user || !task) {
    return false
  }

  const hasChildren = hasTaskChildren(tasksById, task.id, visibleIdSet)

  if (hasChildren) {
    return task.assignedTo === user.id
  }

  return task.assignedTo === user.id || task.createdBy === user.id
}

export function isTaskLate(task) {
  if (!task?.deadline) {
    return false
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return new Date(task.deadline) < today && task.status !== 'completed'
}

export function deriveTaskMetrics(tasksById) {
  const allTasks = toArray(tasksById)
  const childrenByParentId = allTasks.reduce((collection, task) => {
    const parentId = task.parentTaskId ?? '__root__'
    collection[parentId] ??= []
    collection[parentId].push(task)
    return collection
  }, {})
  const cache = {}
  const visiting = new Set()

  const deriveTask = (taskId) => {
    if (cache[taskId]) {
      return cache[taskId]
    }

    if (visiting.has(taskId)) {
      return tasksById[taskId]
    }

    const task = tasksById[taskId]

    if (!task) {
      return null
    }

    visiting.add(taskId)

    const childTasks = (childrenByParentId[taskId] ?? [])
      .map((childTask) => deriveTask(childTask.id))
      .filter(Boolean)
      .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
    const childTaskCount = childTasks.length
    const isLeafNode = childTaskCount === 0

    let nextTask

    if (isLeafNode) {
      const completed = task.status === 'completed'

      nextTask = {
        ...task,
        status: completed ? 'completed' : 'not_completed',
        progress: completed ? 100 : 0,
        completionConfirmed: false,
        childTaskCount: 0,
        completedChildCount: 0,
        incompleteChildCount: 0,
        allChildrenCompleted: false,
        readyToConfirm: false,
        isLeafNode: true,
      }
    } else {
      const completedChildCount = childTasks.filter(
        (childTask) => childTask.status === 'completed',
      ).length
      const incompleteChildCount = childTaskCount - completedChildCount
      const allChildrenCompleted = incompleteChildCount === 0
      const completionConfirmed = allChildrenCompleted
        ? getLegacyCompletionConfirmed(task)
        : false

      let status = 'pending'

      if (allChildrenCompleted) {
        status = completionConfirmed ? 'completed' : 'awaiting_confirmation'
      } else if (completedChildCount > 0) {
        status = 'in_progress'
      }

      nextTask = {
        ...task,
        status,
        progress: floorPercent(completedChildCount, childTaskCount),
        completionConfirmed,
        childTaskCount,
        completedChildCount,
        incompleteChildCount,
        allChildrenCompleted,
        readyToConfirm: allChildrenCompleted && !completionConfirmed,
        isLeafNode: false,
      }
    }

    cache[taskId] = nextTask
    visiting.delete(taskId)
    return nextTask
  }

  for (const task of allTasks) {
    deriveTask(task.id)
  }

  return cache
}

export function getVisibleTasks(tasksById, usersById, currentUserId) {
  if (!currentUserId) {
    return []
  }

  const accessibleUserIds = new Set(getAccessibleUserIds(usersById, currentUserId))

  return toArray(tasksById)
    .filter(
      (task) =>
        accessibleUserIds.has(task.assignedTo) || accessibleUserIds.has(task.createdBy),
    )
    .sort((left, right) => {
      if (left.parentTaskId === right.id) {
        return 1
      }

      if (right.parentTaskId === left.id) {
        return -1
      }

      return new Date(left.createdAt) - new Date(right.createdAt)
    })
}

export function getSearchScopedIds(tasksById, visibleTasks, usersById, term) {
  const normalizedTerm = term.trim().toLowerCase()

  if (!normalizedTerm) {
    return new Set(visibleTasks.map((task) => task.id))
  }

  const visibleIdSet = new Set(visibleTasks.map((task) => task.id))
  const matchedIds = new Set()

  for (const task of visibleTasks) {
    const assigneeName = usersById[task.assignedTo]?.name ?? ''
    const searchableValues = [
      task.title,
      task.description,
      assigneeName,
      STATUS_LABELS[task.status] ?? '',
      PRIORITY_LABELS[task.priority] ?? '',
    ]

    const isMatch = searchableValues.some((value) =>
      String(value).toLowerCase().includes(normalizedTerm),
    )

    if (!isMatch) {
      continue
    }

    matchedIds.add(task.id)

    let parentId = task.parentTaskId

    while (parentId && visibleIdSet.has(parentId)) {
      matchedIds.add(parentId)
      parentId = tasksById[parentId]?.parentTaskId
    }
  }

  return matchedIds
}

export function buildTaskTree(tasksById, visibleTasks) {
  const visibleIdSet = new Set(visibleTasks.map((task) => task.id))
  const groupedByParent = {}

  for (const task of visibleTasks) {
    const resolvedParentId = visibleIdSet.has(task.parentTaskId) ? task.parentTaskId : null
    groupedByParent[resolvedParentId] ??= []
    groupedByParent[resolvedParentId].push(task)
  }

  const attachChildren = (parentId) =>
    (groupedByParent[parentId] ?? [])
      .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
      .map((task) => ({
        ...task,
        treeChildren: attachChildren(task.id),
      }))

  return attachChildren(null)
}

export function getFirstTreeTaskId(nodes) {
  return nodes[0]?.id ?? null
}

export function getTaskAncestors(tasksById, taskId, visibleIdSet) {
  const ancestors = []
  let currentTask = tasksById[taskId]

  while (currentTask?.parentTaskId && visibleIdSet.has(currentTask.parentTaskId)) {
    const parentTask = tasksById[currentTask.parentTaskId]

    if (!parentTask) {
      break
    }

    ancestors.unshift(parentTask)
    currentTask = parentTask
  }

  return ancestors
}

export function getTaskChildren(tasksById, parentTaskId, visibleIdSet) {
  return toArray(tasksById)
    .filter(
      (task) =>
        task.parentTaskId === parentTaskId &&
        (!visibleIdSet || visibleIdSet.has(task.id)),
    )
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
}

export function hasTaskChildren(tasksById, taskId, visibleIdSet) {
  return getTaskChildren(tasksById, taskId, visibleIdSet).length > 0
}

export function getTaskAncestorIds(tasksById, taskId) {
  const ancestorIds = []
  let currentTask = tasksById[taskId]

  while (currentTask?.parentTaskId) {
    ancestorIds.push(currentTask.parentTaskId)
    currentTask = tasksById[currentTask.parentTaskId]
  }

  return ancestorIds
}

export function getTaskSubtreeTasks(tasksById, rootTaskId, visibleIdSet) {
  if (!rootTaskId || !tasksById[rootTaskId]) {
    return []
  }

  if (visibleIdSet && !visibleIdSet.has(rootTaskId)) {
    return []
  }

  const collectedIds = new Set()
  const queue = [rootTaskId]

  while (queue.length > 0) {
    const currentTaskId = queue.shift()

    if (collectedIds.has(currentTaskId)) {
      continue
    }

    const currentTask = tasksById[currentTaskId]

    if (!currentTask) {
      continue
    }

    if (visibleIdSet && !visibleIdSet.has(currentTaskId)) {
      continue
    }

    collectedIds.add(currentTaskId)

    for (const childTask of getTaskChildren(tasksById, currentTaskId, visibleIdSet)) {
      queue.push(childTask.id)
    }
  }

  return [...collectedIds]
    .map((taskId) => tasksById[taskId])
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
}

export function hasVisibleChildTasks(tasksById, taskId, visibleIdSet) {
  return hasTaskChildren(tasksById, taskId, visibleIdSet)
}

export function canOpenTaskTree(user, task, tasksById, visibleIdSet) {
  if (!user || !task) {
    return false
  }

  if (user.role === 'staff') {
    return false
  }

  return hasVisibleChildTasks(tasksById, task.id, visibleIdSet)
}

export function getTaskHistoryEntries(historyById, taskId) {
  return toArray(historyById)
    .filter((entry) => entry.taskId === taskId)
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
}

export function summarizeTasks(tasks) {
  return tasks.reduce(
    (summary, task) => {
      summary.total += 1
      summary.completed += task.status === 'completed' ? 1 : 0
      summary.overdue += isTaskLate(task) ? 1 : 0
      summary.inProgress +=
        task.status !== 'completed' && !isTaskLate(task) ? 1 : 0
      summary.pending +=
        task.status === 'pending' || task.status === 'not_completed' ? 1 : 0
      return summary
    },
    {
      total: 0,
      completed: 0,
      overdue: 0,
      inProgress: 0,
      pending: 0,
    },
  )
}
