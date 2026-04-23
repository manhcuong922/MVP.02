import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useState,
} from 'react'
import { onValue, ref, update } from 'firebase/database'
import CreateTaskModal from './components/CreateTaskModal'
import EditTaskModal from './components/EditTaskModal'
import LoginScreen from './components/LoginScreen'
import SplitTaskModal from './components/SplitTaskModal'
import TaskDetailPanel from './components/TaskDetailPanel'
import TaskHierarchyMap from './components/TaskHierarchyMap'
import TreeView from './components/TreeView'
import { seedTaskComments, seedTaskHistory, seedTasks, seedUsers } from './data/demoData'
import { database } from './firebase/config'
import { ensureDemoSeed } from './firebase/seed'
import {
  formatPercent,
  getPriorityLabel,
  getRoleLabel,
  getStatusLabel,
  truncateText,
  truncateTitleWords,
} from './utils/formatters'
import {
  buildCreateTaskMutation,
  buildEditTaskMutation,
  buildExecutionUpdateMutation,
  buildSplitTaskMutation,
  buildTaskCommentMutation,
} from './utils/mutationBuilders'
import {
  buildTaskTree,
  canCreateRootTask,
  canOpenTaskTree,
  deriveTaskMetrics,
  getAllowedAssignees,
  getFirstTreeTaskId,
  getSearchScopedIds,
  getTaskSubtreeTasks,
  getVisibleTasks,
  summarizeTasks,
} from './utils/taskUtils'

const STORAGE_KEY = 'mvp-task-manager-demo-user'
const VIEW_MODE_STORAGE_KEY = 'mvp-task-manager-view-mode'

function App() {
  const [usersById, setUsersById] = useState(seedUsers)
  const [tasksById, setTasksById] = useState(seedTasks)
  const [historyById, setHistoryById] = useState(seedTaskHistory)
  const [commentsById, setCommentsById] = useState(seedTaskComments)
  const [recentUserId, setRecentUserId] = useState(
    () => window.localStorage.getItem(STORAGE_KEY) ?? '',
  )
  const [taskViewMode, setTaskViewMode] = useState(() => {
    const storedMode = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY)

    return storedMode === 'tree' ? 'tree' : 'folder'
  })
  const [currentUserId, setCurrentUserId] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState(null)
  const [treeRootTaskId, setTreeRootTaskId] = useState(null)
  const [expandedMap, setExpandedMap] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [syncState, setSyncState] = useState({
    tone: 'neutral',
    message:
      'Ứng dụng sẽ kiểm tra Firebase Realtime Database và tự seed dữ liệu demo nếu database đang trống.',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isCreateRootOpen, setCreateRootOpen] = useState(false)
  const [isCreateSubtaskOpen, setCreateSubtaskOpen] = useState(false)
  const [isSplitOpen, setSplitOpen] = useState(false)
  const [isEditOpen, setEditOpen] = useState(false)
  const [isTreeDetailOpen, setTreeDetailOpen] = useState(false)

  const deferredSearch = useDeferredValue(searchTerm)
  const currentUser = usersById[currentUserId]
  const derivedTasksById = deriveTaskMetrics(tasksById)
  const visibleTasks = currentUser
    ? getVisibleTasks(derivedTasksById, usersById, currentUser.id)
    : []
  const visibleIdSet = new Set(visibleTasks.map((task) => task.id))
  const searchScopedIds = currentUser
    ? getSearchScopedIds(derivedTasksById, visibleTasks, usersById, deferredSearch)
    : new Set()
  const filteredVisibleTasks = visibleTasks.filter((task) =>
    searchScopedIds.has(task.id),
  )
  const folderTree = buildTaskTree(derivedTasksById, filteredVisibleTasks)
  const summary = summarizeTasks(visibleTasks)
  const selectionIds = (deferredSearch.trim()
    ? filteredVisibleTasks
    : visibleTasks
  ).map((task) => task.id)
  const selectionKey = selectionIds.join('|')
  const selectedTask =
    selectedTaskId && visibleIdSet.has(selectedTaskId)
      ? derivedTasksById[selectedTaskId]
      : null
  const selectedRawTask =
    selectedTaskId && visibleIdSet.has(selectedTaskId) ? tasksById[selectedTaskId] : null
  const allowedAssignees = currentUser
    ? getAllowedAssignees(usersById, currentUser.id)
    : []
  const editAssignees = selectedTask
    ? [
        ...(usersById[selectedTask.assignedTo]
          ? [usersById[selectedTask.assignedTo]]
          : []),
        ...allowedAssignees,
      ].filter(
        (user, index, collection) =>
          collection.findIndex((candidate) => candidate.id === user.id) === index,
      )
    : allowedAssignees
  const searchActive = Boolean(deferredSearch.trim())
  const canCurrentUserUseTree = Boolean(currentUser && currentUser.role !== 'staff')
  const treeRootTask =
    treeRootTaskId && visibleIdSet.has(treeRootTaskId)
      ? derivedTasksById[treeRootTaskId]
      : null
  const treeSourceTasks = treeRootTask
    ? getTaskSubtreeTasks(derivedTasksById, treeRootTask.id, visibleIdSet)
    : []
  const treeSearchScopedIds =
    treeRootTask && canCurrentUserUseTree
      ? getSearchScopedIds(derivedTasksById, treeSourceTasks, usersById, deferredSearch)
      : new Set()
  const filteredTreeTasks = treeSourceTasks.filter((task) =>
    treeSearchScopedIds.has(task.id),
  )
  const activeTreeTasks = searchActive ? filteredTreeTasks : treeSourceTasks
  const activeTree = buildTaskTree(derivedTasksById, activeTreeTasks)
  const canOpenSelectedTaskTree = canOpenTaskTree(
    currentUser,
    selectedTask,
    derivedTasksById,
    visibleIdSet,
  )

  useEffect(() => {
    let isActive = true
    const unsubscribeHandlers = []

    const updateSyncMessage = (tone, message) => {
      if (!isActive) {
        return
      }

      setSyncState({ tone, message })
    }

    const subscribeCollection = (path, applyData, fallbackValue, label) => {
      const unsubscribe = onValue(
        ref(database, path),
        (snapshot) => {
          const nextValue = snapshot.val()
          applyData(nextValue || fallbackValue)
        },
        (error) => {
          updateSyncMessage(
            'warning',
            `${label} đang dùng dữ liệu seed cục bộ vì Firebase phản hồi lỗi: ${error.message}`,
          )
        },
      )

      unsubscribeHandlers.push(unsubscribe)
    }

    async function bootstrapRealtime() {
      updateSyncMessage(
        'neutral',
        'Đang kết nối Firebase Realtime Database và kiểm tra dữ liệu demo...',
      )

      try {
        const seeded = await ensureDemoSeed()

        updateSyncMessage(
          'live',
          seeded
            ? 'Firebase đã được seed dữ liệu demo. Mọi thay đổi tiếp theo sẽ đồng bộ realtime.'
            : 'Đã kết nối Firebase Realtime Database. Dữ liệu đang đồng bộ realtime.',
        )
      } catch (error) {
        updateSyncMessage(
          'warning',
          `Không thể seed Firebase lúc khởi động. App vẫn hiển thị dữ liệu demo cục bộ. ${error.message}`,
        )
      }

      subscribeCollection('users', setUsersById, seedUsers, 'Danh sách user')
      subscribeCollection('tasks', setTasksById, seedTasks, 'Danh sách task')
      subscribeCollection(
        'taskHistory',
        setHistoryById,
        seedTaskHistory,
        'Lịch sử task',
      )
      subscribeCollection('taskComments', setCommentsById, seedTaskComments, 'Task comments')
    }

    bootstrapRealtime()

    return () => {
      isActive = false
      unsubscribeHandlers.forEach((unsubscribe) => unsubscribe())
    }
  }, [])

  const ensureSelection = useEffectEvent((candidateIds, nextTree) => {
    const candidateIdSet = new Set(candidateIds)

    if (selectedTaskId && candidateIdSet.has(selectedTaskId)) {
      return
    }

    const nextSelectedTaskId = getFirstTreeTaskId(nextTree)

    startTransition(() => {
      setSelectedTaskId(nextSelectedTaskId)
    })
  })

  useEffect(() => {
    if (!currentUser || taskViewMode !== 'folder') {
      return
    }

    ensureSelection(selectionIds, folderTree)
  }, [currentUser, ensureSelection, folderTree, selectionIds, taskViewMode, selectionKey])

  useEffect(() => {
    if (!selectedTask) {
      setTreeDetailOpen(false)
    }
  }, [selectedTask])

  useEffect(() => {
    if (!currentUser) {
      return
    }

    if (!canCurrentUserUseTree && taskViewMode === 'tree') {
      setTaskViewMode('folder')
      setTreeRootTaskId(null)
      setTreeDetailOpen(false)
      return
    }

    if (taskViewMode !== 'tree') {
      return
    }

    if (!treeRootTaskId || !treeRootTask) {
      setTaskViewMode('folder')
      setTreeRootTaskId(null)
      setTreeDetailOpen(false)
      return
    }

    if (!canOpenTaskTree(currentUser, treeRootTask, derivedTasksById, visibleIdSet)) {
      setTaskViewMode('folder')
      setTreeRootTaskId(null)
      setTreeDetailOpen(false)
    }
  }, [
    canCurrentUserUseTree,
    currentUser,
    derivedTasksById,
    taskViewMode,
    treeRootTask,
    treeRootTaskId,
    visibleIdSet,
  ])

  useEffect(() => {
    if (taskViewMode !== 'tree' || !treeRootTaskId) {
      return
    }

    const activeTreeIdSet = new Set(activeTreeTasks.map((task) => task.id))

    if (selectedTaskId && activeTreeIdSet.has(selectedTaskId)) {
      return
    }

    const nextSelectedTaskId = getFirstTreeTaskId(activeTree)

    setSelectedTaskId(nextSelectedTaskId)

    if (!nextSelectedTaskId) {
      setTreeDetailOpen(false)
    }
  }, [activeTree, activeTreeTasks, selectedTaskId, taskViewMode, treeRootTaskId])

  const applyUpdates = async (updates, successMessage) => {
    setIsSaving(true)

    try {
      await update(ref(database), updates)
      setSyncState({
        tone: 'live',
        message: successMessage,
      })
      return true
    } catch (error) {
      setSyncState({
        tone: 'warning',
        message: `Không thể ghi dữ liệu lên Firebase. App vẫn giữ nguyên dữ liệu hiện tại. ${error.message}`,
      })
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const revealTask = (taskId) => {
    if (!taskId) {
      return
    }

    setExpandedMap((currentMap) => {
      const nextMap = { ...currentMap }
      let currentTask = tasksById[taskId]

      while (currentTask?.parentTaskId && visibleIdSet.has(currentTask.parentTaskId)) {
        nextMap[currentTask.parentTaskId] = true
        currentTask = tasksById[currentTask.parentTaskId]
      }

      return nextMap
    })

    startTransition(() => {
      setSelectedTaskId(taskId)
    })
  }

  const handleSelectUser = (userId) => {
    window.localStorage.setItem(STORAGE_KEY, userId)
    setRecentUserId(userId)

    startTransition(() => {
      setCurrentUserId(userId)
      setSelectedTaskId(null)
      setTreeRootTaskId(null)
      setExpandedMap({})
      setSearchTerm('')
      setTreeDetailOpen(false)
    })
  }

  const handleLogout = () => {
    startTransition(() => {
      setCurrentUserId('')
      setSelectedTaskId(null)
      setTreeRootTaskId(null)
      setExpandedMap({})
      setSearchTerm('')
      setCreateRootOpen(false)
      setCreateSubtaskOpen(false)
      setSplitOpen(false)
      setEditOpen(false)
      setTreeDetailOpen(false)
    })
  }

  const handleChangeTaskViewMode = (nextMode) => {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, nextMode)
    setTaskViewMode(nextMode)

    if (nextMode === 'folder') {
      setTreeRootTaskId(null)
      setTreeDetailOpen(false)
    }
  }

  const handleToggleExpand = (taskId) => {
    setExpandedMap((currentMap) => ({
      ...currentMap,
      [taskId]: !currentMap[taskId],
    }))
  }

  const handleSelectTask = (taskId) => {
    revealTask(taskId)

    if (taskViewMode === 'tree') {
      setTreeDetailOpen(true)
    }
  }

  const handleOpenTreeFromTask = (taskId) => {
    const nextTask = derivedTasksById[taskId]

    if (!canOpenTaskTree(currentUser, nextTask, derivedTasksById, visibleIdSet)) {
      return
    }

    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, 'tree')
    setTreeRootTaskId(taskId)
    setTaskViewMode('tree')
    setTreeDetailOpen(true)
    revealTask(taskId)
  }

  const handleCreateRootTask = async (values) => {
    if (!currentUser) {
      return false
    }

    const mutation = buildCreateTaskMutation({
      currentUser,
      parentTask: null,
      values,
      usersById,
    })

    const didSave = await applyUpdates(
      mutation.updates,
      `Đã tạo task gốc "${values.title}" và đồng bộ lên Firebase Realtime Database.`,
    )

    if (didSave) {
      setExpandedMap((currentMap) => ({
        ...currentMap,
        [mutation.taskId]: true,
      }))

      startTransition(() => {
        setSelectedTaskId(mutation.taskId)
      })
    }

    return didSave
  }

  const handleCreateSubtask = async (values) => {
    if (!currentUser || !selectedRawTask) {
      return false
    }

    const mutation = buildCreateTaskMutation({
      currentUser,
      parentTask: selectedRawTask,
      values,
      usersById,
    })

    const didSave = await applyUpdates(
      mutation.updates,
      `Đã tạo subtask "${values.title}" dưới "${selectedTask.title}".`,
    )

    if (didSave) {
      setExpandedMap((currentMap) => ({
        ...currentMap,
        [selectedRawTask.id]: true,
      }))

      startTransition(() => {
        setSelectedTaskId(mutation.taskId)
      })
    }

    return didSave
  }

  const handleSplitTask = async (items) => {
    if (!currentUser || !selectedRawTask) {
      return false
    }

    const mutation = buildSplitTaskMutation({
      currentUser,
      parentTask: selectedRawTask,
      items,
      usersById,
    })

    const didSave = await applyUpdates(
      mutation.updates,
      `Đã chia task "${selectedTask.title}" thành ${items.length} subtask mới.`,
    )

    if (didSave) {
      setExpandedMap((currentMap) => ({
        ...currentMap,
        [selectedRawTask.id]: true,
      }))

      startTransition(() => {
        setSelectedTaskId(mutation.firstTaskId ?? selectedRawTask.id)
      })
    }

    return didSave
  }

  const handleEditTask = async (values) => {
    if (!currentUser || !selectedRawTask) {
      return false
    }

    const mutation = buildEditTaskMutation({
      currentUser,
      task: selectedRawTask,
      values,
      usersById,
    })

    if (!mutation) {
      setSyncState({
        tone: 'neutral',
        message: 'Không có thay đổi nào cần lưu cho task hiện tại.',
      })
      return true
    }

    return applyUpdates(
      mutation.updates,
      `Đã cập nhật task "${selectedTask.title}" và ghi log chỉnh sửa.`,
    )
  }

  const handleExecutionUpdate = async (values) => {
    if (!currentUser || !selectedRawTask) {
      return false
    }

    const mutation = buildExecutionUpdateMutation({
      currentUser,
      task: selectedRawTask,
      tasksById,
      values,
      usersById,
    })

    if (!mutation) {
      setSyncState({
        tone: 'neutral',
        message: 'Không có thay đổi mới để lưu cho task hiện tại.',
      })
      return true
    }

    return applyUpdates(
      mutation.updates,
      `Đã cập nhật trạng thái thực thi cho "${selectedTask.title}" và đồng bộ realtime.`,
    )
  }

  const handleAddComment = async (message) => {
    if (!currentUser || !selectedRawTask) {
      return false
    }

    const mutation = buildTaskCommentMutation({
      currentUser,
      task: selectedRawTask,
      message,
    })

    if (!mutation) {
      setSyncState({
        tone: 'neutral',
        message: 'ChÆ°a cÃ³ ná»™i dung trao Ä‘á»•i Ä‘á»ƒ gá»­i.',
      })
      return false
    }

    return applyUpdates(
      mutation.updates,
      `ÄÃ£ gá»­i trao Ä‘á»•i trong task "${selectedTask.title}".`,
    )
  }

  const renderFolderWorkspace = () => (
    <>
      <aside className="sidebar-panel">
        <div className="panel-topline">
          <div>
            <p className="eyebrow">Task Directory</p>
            <h2>Cây task được phép truy cập</h2>
          </div>
          <span className="panel-count">{filteredVisibleTasks.length} node</span>
        </div>

        <label className="search-field">
          <span>Tìm công việc</span>
          <input
            className="search-input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Tìm theo tiêu đề, người phụ trách hoặc trạng thái"
          />
        </label>

        <TreeView
          tree={folderTree}
          usersById={usersById}
          selectedTaskId={selectedTaskId}
          expandedMap={expandedMap}
          onToggle={handleToggleExpand}
          onSelect={handleSelectTask}
          searchActive={searchActive}
        />
      </aside>

      <TaskDetailPanel
        key={`${selectedTask?.id ?? 'empty'}-${selectedTask?.updatedAt ?? 'none'}-folder`}
        currentUser={currentUser}
        task={selectedTask}
        tasksById={derivedTasksById}
        usersById={usersById}
        historyById={historyById}
        commentsById={commentsById}
        visibleIdSet={visibleIdSet}
        onSelectTask={handleSelectTask}
        onOpenCreateRoot={canCreateRootTask(currentUser) ? () => setCreateRootOpen(true) : null}
        onOpenCreateSubtask={() => setCreateSubtaskOpen(true)}
        onOpenSplit={() => setSplitOpen(true)}
        onOpenEdit={() => setEditOpen(true)}
        onUpdateExecution={handleExecutionUpdate}
        onAddComment={handleAddComment}
        isSaving={isSaving}
        canOpenTreeView={canOpenSelectedTaskTree}
        onOpenTaskTree={() => selectedTask && handleOpenTreeFromTask(selectedTask.id)}
        treeActionLabel="Mở nhánh dạng tree"
      />
    </>
  )

  const renderTreeWorkspace = () => (
    <section className="tree-workspace">
      <div className="tree-workspace-header">
        <div className="panel-topline">
          <div>
            <p className="eyebrow">HRM Task Tree</p>
            <h2 title={treeRootTask?.title ?? undefined}>
              {treeRootTask
                ? truncateTitleWords(treeRootTask.title, 4, 34)
                : 'Cây phân rã theo nhánh task'}
            </h2>
          </div>

          <div className="tree-header-side">
            <span className="panel-count">{activeTreeTasks.length} node</span>
            <span className="tree-status-pill" title={treeRootTask?.title ?? undefined}>
              {treeRootTask
                ? `Gốc cây: ${truncateTitleWords(treeRootTask.title, 4, 30)}`
                : 'Chưa có gốc cây'}
            </span>
          </div>
        </div>

        <div className="tree-toolbar-grid">
          <div className="tree-toolbar-card">
            <div className="view-toolbar tree-toolbar-inner">
              <div className="view-switch" role="tablist" aria-label="Task display mode">
                <button
                  type="button"
                  className="view-switch-button"
                  onClick={() => handleChangeTaskViewMode('folder')}
                >
                  Quay Về Folder
                </button>
                <button type="button" className="view-switch-button active" aria-pressed="true">
                  Tree Scope
                </button>
              </div>
            </div>

            <label className="search-field tree-search-card">
              <span>Tìm trong nhánh</span>
              <input
                className="search-input"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm node trong nhánh hiện tại"
              />
            </label>
          </div>

          <article className="tree-selection-card">
            <p className="eyebrow">Node Đang Chọn</p>
            <strong title={selectedTask?.title ?? undefined}>
              {selectedTask
                ? truncateTitleWords(selectedTask.title, 4, 34)
                : 'Chưa chọn node'}
            </strong>
            <p>
              {selectedTask
                ? truncateText(selectedTask.description, 160) || 'Chưa có mô tả chi tiết.'
                : 'Chưa chọn node.'}
            </p>

            {selectedTask ? (
              <div className="tree-selection-meta">
                <span className={`badge status-${selectedTask.status}`}>
                  {getStatusLabel(selectedTask.status)}
                </span>
                <span className={`badge priority-${selectedTask.priority}`}>
                  {getPriorityLabel(selectedTask.priority)}
                </span>
                {selectedTask.childTaskCount > 0 ? (
                  <span className="progress-chip">
                    {formatPercent(selectedTask.progress)}
                  </span>
                ) : null}
              </div>
            ) : null}
          </article>
        </div>
      </div>

      <div className="tree-canvas-section">
        <div className="tree-canvas-frame">
          <TaskHierarchyMap
            tree={activeTree}
            usersById={usersById}
            selectedTaskId={selectedTaskId}
            onSelect={handleSelectTask}
            rootTaskId={treeRootTaskId}
            detailPanelOpen={isTreeDetailOpen && Boolean(selectedTask)}
          />

          {selectedTask ? (
            <div className={`tree-detail-overlay ${isTreeDetailOpen ? 'open' : ''}`}>
              <TaskDetailPanel
                key={`${selectedTask.id}-${selectedTask.updatedAt ?? 'none'}-tree`}
                currentUser={currentUser}
                task={selectedTask}
                tasksById={derivedTasksById}
                usersById={usersById}
                historyById={historyById}
                commentsById={commentsById}
                visibleIdSet={visibleIdSet}
                onSelectTask={handleSelectTask}
                onOpenCreateRoot={canCreateRootTask(currentUser) ? () => setCreateRootOpen(true) : null}
                onOpenCreateSubtask={() => setCreateSubtaskOpen(true)}
                onOpenSplit={() => setSplitOpen(true)}
                onOpenEdit={() => setEditOpen(true)}
                onUpdateExecution={handleExecutionUpdate}
                onAddComment={handleAddComment}
                isSaving={isSaving}
                className="tree-overlay-panel"
                onClose={() => setTreeDetailOpen(false)}
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )

  if (!currentUser) {
    return (
      <LoginScreen
        users={Object.values(usersById)}
        onSelectUser={handleSelectUser}
        syncLabel={syncState.message}
        recentUserId={recentUserId}
      />
    )
  }

  return (
    <div className="workspace-shell">
      <header className="workspace-topbar">
        <div className="topbar-brand">
          <div className="brand-logo">T</div>
          <div className="topbar-brand-text">
            <span className="topbar-brand-label">TaskFlow</span>
            <span className="topbar-brand-sub">Quản lý công việc phân cấp</span>
          </div>
        </div>

        <div className="topbar-center">
          <span className="topbar-pill">
            <span className="dot"></span>
            Firebase Live
          </span>
          <span className="topbar-pill">{getRoleLabel(currentUser.role)}</span>
          <span className="topbar-pill">{currentUser.department}</span>
        </div>

        <div className="topbar-right">
          <div className="user-badge">
            <div className="user-badge-avatar">{currentUser.name.slice(0, 1)}</div>
            <div className="user-badge-info">
              <span className="user-badge-name">{currentUser.name}</span>
              <span className="user-badge-role">{getRoleLabel(currentUser.role)}</span>
            </div>
          </div>
          {canCreateRootTask(currentUser) ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => setCreateRootOpen(true)}
            >
              + Tạo task gốc
            </button>
          ) : null}
          <button type="button" className="ghost-button" onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
      </header>

      <section className="kpi-strip">
        <article className="kpi-card">
          <div className="kpi-icon blue">
            <svg viewBox="0 0 20 20" fill="none" width="20" height="20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="3" width="12" height="15" rx="2" />
              <path d="M8 7h4M8 11h4M8 15h2" />
            </svg>
          </div>
          <div className="kpi-data">
            <p className="kpi-label">Tổng CV</p>
            <div className="kpi-value">{summary.total}</div>
          </div>
          <div className="kpi-glow blue"></div>
        </article>
        <article className="kpi-card">
          <div className="kpi-icon green">
            <svg viewBox="0 0 20 20" fill="none" width="20" height="20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="10" r="7" />
              <path d="M6.5 10.5 9 13l4.5-5" />
            </svg>
          </div>
          <div className="kpi-data">
            <p className="kpi-label">Hoàn thành</p>
            <div className="kpi-value">{summary.completed}</div>
          </div>
          <div className="kpi-glow green"></div>
        </article>
        <article className="kpi-card">
          <div className="kpi-icon cyan">
            <svg viewBox="0 0 20 20" fill="none" width="20" height="20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="10" cy="10" r="7" />
              <path d="M10 7v3l2 2" />
            </svg>
          </div>
          <div className="kpi-data">
            <p className="kpi-label">Đang xử lý</p>
            <div className="kpi-value">{summary.processing}</div>
          </div>
          <div className="kpi-glow cyan"></div>
        </article>
        <article className="kpi-card">
          <div className="kpi-icon blue">
            <svg viewBox="0 0 20 20" fill="none" width="20" height="20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 10h11M10 4.5v11" />
            </svg>
          </div>
          <div className="kpi-data">
            <p className="kpi-label">Chưa thực hiện</p>
            <div className="kpi-value">{summary.notStarted}</div>
          </div>
          <div className="kpi-glow blue"></div>
        </article>
        <article className="kpi-card danger">
          <div className="kpi-icon red">
            <svg viewBox="0 0 20 20" fill="none" width="20" height="20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l8 8M14 6l-8 8" />
              <circle cx="10" cy="10" r="7" />
            </svg>
          </div>
          <div className="kpi-data">
            <p className="kpi-label">Hủy</p>
            <div className="kpi-value">{summary.cancelled}</div>
          </div>
          <div className="kpi-glow red"></div>
        </article>
        <article className="kpi-card danger">
          <div className="kpi-icon red">
            <svg viewBox="0 0 20 20" fill="none" width="20" height="20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3 2.5 16.5h15L10 3Z" />
              <path d="M10 9v3M10 14.5h.01" />
            </svg>
          </div>
          <div className="kpi-data">
            <p className="kpi-label">Trễ hạn</p>
            <div className="kpi-value">{summary.overdue}</div>
          </div>
          <div className="kpi-glow red"></div>
        </article>
      </section>

      <main className={`workspace-grid ${taskViewMode === 'tree' ? 'tree-layout' : ''}`}>
        {taskViewMode === 'tree' ? renderTreeWorkspace() : renderFolderWorkspace()}
      </main>

      <CreateTaskModal
        key={`root-${isCreateRootOpen}-${allowedAssignees[0]?.id ?? 'none'}`}
        open={isCreateRootOpen}
        parentTask={null}
        assignees={allowedAssignees}
        onClose={() => setCreateRootOpen(false)}
        onSubmit={handleCreateRootTask}
        isSaving={isSaving}
      />

      <CreateTaskModal
        key={`subtask-${selectedTask?.id ?? 'none'}-${isCreateSubtaskOpen}`}
        open={isCreateSubtaskOpen}
        parentTask={selectedRawTask}
        assignees={allowedAssignees}
        onClose={() => setCreateSubtaskOpen(false)}
        onSubmit={handleCreateSubtask}
        isSaving={isSaving}
      />

      <SplitTaskModal
        key={`split-${selectedTask?.id ?? 'none'}-${isSplitOpen}`}
        open={isSplitOpen}
        parentTask={selectedRawTask}
        assignees={allowedAssignees}
        onClose={() => setSplitOpen(false)}
        onSubmit={handleSplitTask}
        isSaving={isSaving}
      />

      <EditTaskModal
        key={`edit-${selectedTask?.id ?? 'none'}-${selectedTask?.updatedAt ?? 'none'}-${isEditOpen}`}
        open={isEditOpen}
        task={selectedRawTask}
        assignees={editAssignees}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEditTask}
        isSaving={isSaving}
      />
    </div>
  )
}

export default App
