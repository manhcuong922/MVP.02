import { useEffect, useRef, useState } from 'react'
import { isTaskLate } from '../utils/taskUtils'

const ZOOM_MIN = 0.65
const ZOOM_MAX = 1.7
const ZOOM_STEP = 0.12
const ROOT_BRANCH_HUE = 226
const BRANCH_HUES = [88, 190, 26, 278, 336, 44, 154]

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getBranchHue(index) {
  return BRANCH_HUES[index % BRANCH_HUES.length]
}

function getNodeInitials(name) {
  if (!name) {
    return '--'
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function getStatusPresentation(status, late) {
  if (late && status !== 'completed' && status !== 'cancelled') {
    return { label: 'OVERDUE', tone: 'overdue', icon: '!' }
  }

  switch (status) {
    case 'completed':
      return { label: 'DONE', tone: 'completed', icon: '✓' }
    case 'in_progress':
      return { label: 'IN PROGRESS', tone: 'in-progress', icon: '◔' }
    case 'awaiting_confirmation':
      return { label: 'WAITING', tone: 'waiting', icon: '◌' }
    case 'cancelled':
      return { label: 'CANCELLED', tone: 'cancelled', icon: '×' }
    case 'not_completed':
    case 'pending':
    default:
      return { label: 'NOT DONE', tone: 'not-done', icon: '○' }
  }
}

function findNodePath(nodes, targetId, path = []) {
  for (const node of nodes) {
    const nextPath = [...path, node.id]

    if (node.id === targetId) {
      return nextPath
    }

    const childPath = findNodePath(node.treeChildren ?? [], targetId, nextPath)

    if (childPath) {
      return childPath
    }
  }

  return null
}

function nodeContainsDescendant(node, targetId) {
  if (!targetId || !node?.treeChildren?.length) {
    return false
  }

  return node.treeChildren.some(
    (child) => child.id === targetId || nodeContainsDescendant(child, targetId),
  )
}

function MindMapBranch({
  node,
  usersById,
  selectedTaskId,
  onSelect,
  collapsedMap,
  onToggleCollapse,
  branchHue,
  depth = 0,
}) {
  const hasVisibleChildren = node.treeChildren.length > 0
  const isSelected = selectedTaskId === node.id
  const late = isTaskLate(node)
  const assignee = usersById[node.assignedTo]
  const status = getStatusPresentation(node.status, late)
  const isCollapsed = Boolean(collapsedMap[node.id])
  const progressValue = Math.max(0, Math.min(Number(node.progress ?? 0), 100))
  const branchStyle = { '--branch-hue': branchHue }
  const avatarStyle = {
    background: assignee?.accent ?? `hsl(${branchHue} 72% 56%)`,
  }

  const handleToggleCollapse = (event) => {
    event.stopPropagation()
    onToggleCollapse(node, isCollapsed)
  }

  return (
    <div
      className={`mindmap-branch vertical ${hasVisibleChildren ? 'has-children' : 'is-leaf'} ${isCollapsed ? 'collapsed' : ''}`.trim()}
      style={branchStyle}
      data-depth={depth}
    >
      <div className="mindmap-card-shell">
        <span className={`mindmap-status-pill tone-${status.tone}`}>
          <span className="mindmap-status-pill__icon" aria-hidden="true">
            {status.icon}
          </span>
          {status.label}
        </span>

        <button
          type="button"
          data-node-id={node.id}
          className={`mindmap-node-button ${isSelected ? 'selected' : ''} ${depth === 0 ? 'root-node' : ''}`.trim()}
          data-status={node.status}
          onClick={() => onSelect(node.id)}
          style={branchStyle}
        >
          <strong>{node.title}</strong>
          <div className="mindmap-node-progress" aria-label={`Tiến độ ${progressValue}%`}>
            <span className="mindmap-node-progress-label">Progress</span>
            <span className="mindmap-node-progress-value">{progressValue}%</span>
          </div>
          <div className="mindmap-node-progress-track" aria-hidden="true">
            <div
              className="mindmap-node-progress-fill"
              style={{ width: `${progressValue}%` }}
            />
          </div>

          <div className="mindmap-node-divider" aria-hidden="true" />

          <div className="mindmap-node-owner-row">
            <span className="mindmap-node-avatar" style={avatarStyle}>
              {getNodeInitials(assignee?.name)}
            </span>
            <span className="mindmap-node-owner-copy">
              <span className="mindmap-node-owner-name">
                {assignee?.name ?? 'Chưa giao phụ trách'}
              </span>
              <span className="mindmap-node-owner-role">
                {assignee?.department ?? 'Chưa có phòng ban'}
              </span>
            </span>
          </div>
        </button>

        {hasVisibleChildren ? (
          <button
            type="button"
            className={`mindmap-collapse-button ${isCollapsed ? 'collapsed' : ''}`}
            onClick={handleToggleCollapse}
            aria-label={isCollapsed ? 'Mở rộng node con' : 'Thu gọn node con'}
          >
            {isCollapsed ? '+' : '−'}
          </button>
        ) : null}
      </div>

      {hasVisibleChildren && !isCollapsed ? (
        <div
          className={`mindmap-children ${node.treeChildren.length === 1 ? 'single-child' : ''}`}
        >
          {node.treeChildren.map((child, index) => {
            const childHue = depth === 0 ? getBranchHue(index) : branchHue

            return (
            <div
              key={child.id}
              className={`mindmap-child ${node.treeChildren.length === 1 ? 'only-child' : ''}`}
              style={{ '--branch-hue': childHue }}
            >
              <MindMapBranch
                node={child}
                usersById={usersById}
                selectedTaskId={selectedTaskId}
                onSelect={onSelect}
                collapsedMap={collapsedMap}
                onToggleCollapse={onToggleCollapse}
                branchHue={childHue}
                depth={depth + 1}
              />
            </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function TaskHierarchyMap({
  tree,
  usersById,
  selectedTaskId,
  onSelect,
  rootTaskId,
  detailPanelOpen = false,
}) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 24, y: 24 })
  const [isPanning, setIsPanning] = useState(false)
  const [collapsedMap, setCollapsedMap] = useState({})
  const viewportRef = useRef(null)
  const dragRef = useRef(null)
  const collapsedSignature = Object.keys(collapsedMap)
    .filter((taskId) => collapsedMap[taskId])
    .sort()
    .join('|')

  useEffect(() => {
    setZoom(1)
    setPan({ x: 24, y: 24 })
    setCollapsedMap({})
  }, [rootTaskId])

  useEffect(() => {
    if (!selectedTaskId) {
      return
    }

    const path = findNodePath(tree, selectedTaskId)

    if (!path || path.length < 2) {
      return
    }

    setCollapsedMap((currentMap) => {
      let didChange = false
      const nextMap = { ...currentMap }

      for (const ancestorId of path.slice(0, -1)) {
        if (nextMap[ancestorId]) {
          delete nextMap[ancestorId]
          didChange = true
        }
      }

      return didChange ? nextMap : currentMap
    })
  }, [selectedTaskId, tree])

  useEffect(() => {
    if (!selectedTaskId || !viewportRef.current) {
      return
    }

    const viewport = viewportRef.current

    const focusNode = () => {
      const nodeElement = viewport.querySelector(`[data-node-id="${selectedTaskId}"]`)

      if (!nodeElement) {
        return
      }

      const viewportRect = viewport.getBoundingClientRect()
      const nodeRect = nodeElement.getBoundingClientRect()
      const overlayWidth = detailPanelOpen ? Math.min(viewportRect.width * 0.5, 720) + 28 : 0
      const targetCenterX =
        viewportRect.left + Math.max(180, (viewportRect.width - overlayWidth) * 0.45)
      const targetCenterY = viewportRect.top + viewportRect.height * 0.32
      const currentCenterX = nodeRect.left + nodeRect.width / 2
      const currentCenterY = nodeRect.top + nodeRect.height / 2

      setPan((currentPan) => ({
        x: currentPan.x + (targetCenterX - currentCenterX),
        y: currentPan.y + (targetCenterY - currentCenterY),
      }))
    }

    const frameId = window.requestAnimationFrame(focusNode)

    return () => window.cancelAnimationFrame(frameId)
  }, [collapsedSignature, detailPanelOpen, rootTaskId, selectedTaskId, zoom])

  const updateZoom = (direction) => {
    setZoom((currentZoom) =>
      clamp(
        Number((currentZoom + direction * ZOOM_STEP).toFixed(2)),
        ZOOM_MIN,
        ZOOM_MAX,
      ),
    )
  }

  const resetView = () => {
    setZoom(1)
    setPan({ x: 24, y: 24 })
  }

  const handlePointerDown = (event) => {
    if (event.button !== 0) {
      return
    }

    if (event.target.closest('button, input, textarea, select, a')) {
      return
    }

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    }
    setIsPanning(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - dragRef.current.startX
    const deltaY = event.clientY - dragRef.current.startY

    setPan({
      x: dragRef.current.originX + deltaX,
      y: dragRef.current.originY + deltaY,
    })
  }

  const stopPanning = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    dragRef.current = null
    setIsPanning(false)
  }

  const handleWheel = (event) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      updateZoom(event.deltaY < 0 ? 1 : -1)
      return
    }

    event.preventDefault()

    setPan((currentPan) => ({
      x: currentPan.x - event.deltaX,
      y: currentPan.y - event.deltaY,
    }))
  }

  const handleToggleCollapse = (node, isCollapsed) => {
    if (!isCollapsed && selectedTaskId && selectedTaskId !== node.id && nodeContainsDescendant(node, selectedTaskId)) {
      onSelect(node.id)
    }

    setCollapsedMap((currentMap) => {
      const nextMap = { ...currentMap }

      if (isCollapsed) {
        delete nextMap[node.id]
      } else {
        nextMap[node.id] = true
      }

      return nextMap
    })
  }

  if (tree.length === 0) {
    return (
      <div className="empty-card compact">
        <strong>Không có dữ liệu.</strong>
        <p>Không tìm thấy node phù hợp.</p>
      </div>
    )
  }

  return (
    <div className={`mindmap-surface ${isPanning ? 'is-panning' : ''}`}>
      <div className="mindmap-surface-toolbar">
        <div className="mindmap-surface-hint">
          <strong>Sơ đồ nhánh</strong>
          <span>Nhấn +/- trên node để thu gọn hoặc mở rộng từng nhánh.</span>
        </div>

        <div className="mindmap-control-group">
          <button type="button" className="mindmap-control-button" onClick={() => updateZoom(-1)}>
            -
          </button>
          <span className="mindmap-zoom-badge">{Math.round(zoom * 100)}%</span>
          <button type="button" className="mindmap-control-button" onClick={() => updateZoom(1)}>
            +
          </button>
          <button type="button" className="mindmap-control-button reset" onClick={resetView}>
            Đặt lại
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="mindmap-viewport"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopPanning}
        onPointerCancel={stopPanning}
        onWheel={handleWheel}
      >
        <div
          className="mindmap-pan-layer"
          style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0)` }}
        >
          <div
            className="mindmap-scale-layer"
            style={{ transform: `scale(${zoom})` }}
          >
            <div className="mindmap-stack">
              {tree.map((node) => (
                <MindMapBranch
                  key={node.id}
                  node={node}
                  usersById={usersById}
                  selectedTaskId={selectedTaskId}
                  onSelect={onSelect}
                  collapsedMap={collapsedMap}
                  onToggleCollapse={handleToggleCollapse}
                  branchHue={ROOT_BRANCH_HUE}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TaskHierarchyMap
