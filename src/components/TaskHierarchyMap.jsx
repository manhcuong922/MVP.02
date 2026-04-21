import { useEffect, useRef, useState } from 'react'
import {
  formatDate,
  formatPercent,
  getPriorityLabel,
  getStatusLabel,
} from '../utils/formatters'
import { isTaskLate } from '../utils/taskUtils'

const ZOOM_MIN = 0.65
const ZOOM_MAX = 1.7
const ZOOM_STEP = 0.12

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function MindMapBranch({
  node,
  usersById,
  selectedTaskId,
  onSelect,
}) {
  const hasVisibleChildren = node.treeChildren.length > 0
  const childTaskCount = node.childTaskCount ?? node.treeChildren.length
  const hasChildren = childTaskCount > 0
  const isSelected = selectedTaskId === node.id
  const assignee = usersById[node.assignedTo]
  const late = isTaskLate(node)

  return (
    <div
      className={`mindmap-branch vertical ${hasVisibleChildren ? 'has-children' : 'is-leaf'}`}
    >
      <div className="mindmap-card-shell">
        <button
          type="button"
          data-node-id={node.id}
          className={`mindmap-node-button ${isSelected ? 'selected' : ''}`}
          onClick={() => onSelect(node.id)}
        >
          <span className="mindmap-node-kicker">
            {hasChildren ? `${childTaskCount} node con` : 'Task lá'}
          </span>
          <strong>{node.title}</strong>
          <span className="mindmap-node-owner">
            {assignee?.name ?? 'Chưa giao phụ trách'}
          </span>

          <div className="mindmap-node-meta">
            <span className={`badge status-${node.status}`}>{getStatusLabel(node.status)}</span>
            <span className={`badge priority-${node.priority}`}>
              {getPriorityLabel(node.priority)}
            </span>
            {late ? <span className="badge badge-danger">Trễ hạn</span> : null}
            {hasChildren ? <span className="progress-chip">{formatPercent(node.progress)}</span> : null}
          </div>

          <span className="mindmap-node-deadline">Deadline {formatDate(node.deadline)}</span>
        </button>
      </div>

      {hasVisibleChildren ? (
        <div
          className={`mindmap-children ${node.treeChildren.length === 1 ? 'single-child' : ''}`}
        >
          {node.treeChildren.map((child) => (
            <div
              key={child.id}
              className={`mindmap-child ${node.treeChildren.length === 1 ? 'only-child' : ''}`}
            >
              <MindMapBranch
                node={child}
                usersById={usersById}
                selectedTaskId={selectedTaskId}
                onSelect={onSelect}
              />
            </div>
          ))}
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
  const viewportRef = useRef(null)
  const dragRef = useRef(null)

  useEffect(() => {
    setZoom(1)
    setPan({ x: 24, y: 24 })
  }, [rootTaskId])

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
  }, [detailPanelOpen, rootTaskId, selectedTaskId, zoom])

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

  if (tree.length === 0) {
    return (
      <div className="empty-card compact">
        <strong>Không có task nào khớp bộ lọc.</strong>
        <p>Thử đổi từ khóa tìm kiếm hoặc quay lại folder để chọn một nhánh khác.</p>
      </div>
    )
  }

  return (
    <div className={`mindmap-surface ${isPanning ? 'is-panning' : ''}`}>
      <div className="mindmap-surface-toolbar">
        <div className="mindmap-surface-hint">
          <strong>Canvas tree</strong>
          <span>Kéo để pan, cuộn để di chuyển, `Ctrl + wheel` để zoom.</span>
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
            Reset
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
