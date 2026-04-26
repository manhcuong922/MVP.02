import { useEffect, useMemo, useRef, useState } from 'react'
import { isTaskLate } from '../utils/taskUtils'

const ZOOM_MIN = 0.3
const ZOOM_MAX = 1.7
const ZOOM_STEP = 0.12
const ROOT_BRANCH_HUE = 226
const BRANCH_HUES = [88, 190, 26, 278, 336, 44, 154]
const FIT_PADDING_X = 24
const FIT_PADDING_Y = 20
const FOCUS_ZOOM_MULTIPLIER = 1.45
const FOCUS_MIN_ZOOM = 0.92
const FOCUS_NODE_WIDTH_RATIO = 0.52
const FOCUS_VIEW_Y_RATIO = 0.34
const FIT_ZOOM_FLOOR_RATIO = 0.92

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getFitView(viewportElement, stackElement) {
  if (!viewportElement || !stackElement) {
    return null
  }

  const viewportWidth = Math.max(0, viewportElement.clientWidth - FIT_PADDING_X * 2)
  const viewportHeight = Math.max(0, viewportElement.clientHeight - FIT_PADDING_Y * 2)
  const contentWidth = Math.max(1, stackElement.scrollWidth)
  const contentHeight = Math.max(1, stackElement.scrollHeight)

  if (!viewportWidth || !viewportHeight) {
    return null
  }

  const nextZoom = clamp(
    Number(Math.min(viewportWidth / contentWidth, viewportHeight / contentHeight, 1).toFixed(2)),
    ZOOM_MIN,
    ZOOM_MAX,
  )
  const scaledWidth = contentWidth * nextZoom
  const scaledHeight = contentHeight * nextZoom
  const nextPan = {
    x: Math.round(FIT_PADDING_X + (viewportWidth - scaledWidth) / 2),
    y: Math.round(FIT_PADDING_Y + (viewportHeight - scaledHeight) / 2),
  }

  return {
    zoom: nextZoom,
    pan: nextPan,
  }
}

function getMinimumZoom(viewportElement, stackElement) {
  const fitView = getFitView(viewportElement, stackElement)

  if (!fitView) {
    return ZOOM_MIN
  }

  return clamp(
    Number((Math.min(fitView.zoom, 1) * FIT_ZOOM_FLOOR_RATIO).toFixed(2)),
    ZOOM_MIN,
    ZOOM_MAX,
  )
}

function clampPanToViewport(viewportElement, stackElement, zoom, pan) {
  if (!viewportElement || !stackElement || !pan) {
    return pan
  }

  const viewportWidth = viewportElement.clientWidth
  const viewportHeight = viewportElement.clientHeight
  const contentWidth = Math.max(1, stackElement.scrollWidth * zoom)
  const contentHeight = Math.max(1, stackElement.scrollHeight * zoom)
  const centerX = Math.round((viewportWidth - contentWidth) / 2)
  const centerY = Math.round((viewportHeight - contentHeight) / 2)
  const lockX = contentWidth <= viewportWidth - FIT_PADDING_X * 2
  const lockY = contentHeight <= viewportHeight - FIT_PADDING_Y * 2
  const minX = lockX ? centerX : Math.round(viewportWidth - contentWidth - FIT_PADDING_X)
  const maxX = lockX ? centerX : FIT_PADDING_X
  const minY = lockY ? centerY : Math.round(viewportHeight - contentHeight - FIT_PADDING_Y)
  const maxY = lockY ? centerY : FIT_PADDING_Y

  return {
    x: clamp(Math.round(pan.x), minX, maxX),
    y: clamp(Math.round(pan.y), minY, maxY),
  }
}

function normalizeView(viewportElement, stackElement, nextZoom, nextPan) {
  const safeZoomSource = Number.isFinite(nextZoom) ? nextZoom : 1
  const minZoom = getMinimumZoom(viewportElement, stackElement)
  const safeZoom = clamp(Number(safeZoomSource.toFixed(2)), minZoom, ZOOM_MAX)

  return {
    zoom: safeZoom,
    pan:
      clampPanToViewport(viewportElement, stackElement, safeZoom, nextPan) ??
      nextPan,
  }
}

function getWheelDeltaPixels(event) {
  if (event.deltaMode === 1) {
    return event.deltaY * 16
  }

  if (event.deltaMode === 2) {
    return event.deltaY * 160
  }

  return event.deltaY
}

function getPointerZoomView(
  viewportElement,
  stackElement,
  currentZoom,
  currentPan,
  clientX,
  clientY,
  deltaY,
) {
  if (!viewportElement || !stackElement) {
    return null
  }

  const viewportRect = viewportElement.getBoundingClientRect()
  const pointerX = clientX - viewportRect.left
  const pointerY = clientY - viewportRect.top
  const zoomFactor = Math.exp(-deltaY * 0.0022)
  const nextZoom = currentZoom * zoomFactor
  const contentX = (pointerX - currentPan.x) / Math.max(currentZoom, 0.01)
  const contentY = (pointerY - currentPan.y) / Math.max(currentZoom, 0.01)

  return {
    zoom: nextZoom,
    pan: {
      x: pointerX - contentX * nextZoom,
      y: pointerY - contentY * nextZoom,
    },
  }
}

function getNodeFocusView(viewportElement, stackElement, nodeElement, currentZoom) {
  if (!viewportElement || !stackElement || !nodeElement) {
    return null
  }

  const safeZoom = Math.max(currentZoom, 0.01)
  const fitView = getFitView(viewportElement, stackElement)

  if (!fitView) {
    return null
  }

  const stackRect = stackElement.getBoundingClientRect()
  const nodeRect = nodeElement.getBoundingClientRect()
  const nodeWidth = Math.max(1, nodeRect.width / safeZoom)
  const nodeCenterX = (nodeRect.left - stackRect.left + nodeRect.width / 2) / safeZoom
  const nodeCenterY = (nodeRect.top - stackRect.top + nodeRect.height / 2) / safeZoom
  const focusZoom = clamp(
    Number(
      Math.max(
        fitView.zoom,
        fitView.zoom * FOCUS_ZOOM_MULTIPLIER,
        (viewportElement.clientWidth * FOCUS_NODE_WIDTH_RATIO) / nodeWidth,
        FOCUS_MIN_ZOOM,
      ).toFixed(2),
    ),
    ZOOM_MIN,
    ZOOM_MAX,
  )

  return {
    zoom: focusZoom,
    pan: {
      x: Math.round(viewportElement.clientWidth / 2 - nodeCenterX * focusZoom),
      y: Math.round(viewportElement.clientHeight * FOCUS_VIEW_Y_RATIO - nodeCenterY * focusZoom),
    },
  }
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

function collectVisibleEdges(
  nodes,
  collapsedMap,
  depth = 0,
  branchHue = ROOT_BRANCH_HUE,
  edges = [],
) {
  nodes.forEach((node) => {
    const nodeHue = depth === 0 ? ROOT_BRANCH_HUE : branchHue

    if (collapsedMap[node.id]) {
      return
    }

    node.treeChildren.forEach((child, childIndex) => {
      const childHue = depth === 0 ? getBranchHue(childIndex) : nodeHue

      edges.push({
        parentId: node.id,
        childId: child.id,
        hue: childHue,
      })

      collectVisibleEdges([child], collapsedMap, depth + 1, childHue, edges)
    })
  })

  return edges
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
  isDetailOpen = false,
}) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 24, y: 24 })
  const [isPanning, setIsPanning] = useState(false)
  const [collapsedMap, setCollapsedMap] = useState({})
  const [connectorLayer, setConnectorLayer] = useState({
    width: 0,
    height: 0,
    paths: [],
  })
  const viewportRef = useRef(null)
  const dragRef = useRef(null)
  const stackRef = useRef(null)
  const zoomRef = useRef(zoom)
  const panRef = useRef(pan)
  const collapsedSignature = Object.keys(collapsedMap)
    .filter((taskId) => collapsedMap[taskId])
    .sort()
    .join('|')
  const visibleEdges = useMemo(
    () => collectVisibleEdges(tree, collapsedMap),
    [collapsedSignature, tree],
  )

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    panRef.current = pan
  }, [pan])

  const commitView = (nextView) => {
    if (!nextView?.pan) {
      return false
    }

    zoomRef.current = nextView.zoom
    panRef.current = nextView.pan
    setZoom((currentZoom) => (currentZoom === nextView.zoom ? currentZoom : nextView.zoom))
    setPan((currentPan) =>
      currentPan.x === nextView.pan.x && currentPan.y === nextView.pan.y
        ? currentPan
        : nextView.pan,
    )

    return true
  }

  const applyView = (nextView) => {
    if (!nextView) {
      return false
    }

    return commitView(
      normalizeView(
        viewportRef.current,
        stackRef.current,
        nextView.zoom,
        nextView.pan,
      ),
    )
  }

  const fitTreeToViewport = () => {
    applyView(getFitView(viewportRef.current, stackRef.current))
  }

  const focusSelectedNode = () => {
    if (!selectedTaskId) {
      return false
    }

    const viewportElement = viewportRef.current
    const stackElement = stackRef.current

    if (!viewportElement || !stackElement) {
      return false
    }

    const nodeElement = stackElement.querySelector(`[data-node-id="${selectedTaskId}"]`)

    if (!nodeElement) {
      return false
    }

    return applyView(
      getNodeFocusView(viewportElement, stackElement, nodeElement, zoomRef.current),
    )
  }

  useEffect(() => {
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
    let nestedFrameId = 0
    const frameId = window.requestAnimationFrame(() => {
      nestedFrameId = window.requestAnimationFrame(() => {
        if (isDetailOpen && focusSelectedNode()) {
          return
        }

        fitTreeToViewport()
      })
    })

    return () => {
      window.cancelAnimationFrame(frameId)

      if (nestedFrameId) {
        window.cancelAnimationFrame(nestedFrameId)
      }
    }
  }, [collapsedSignature, isDetailOpen, rootTaskId, selectedTaskId, tree])

  useEffect(() => {
    const handleResize = () => {
      window.requestAnimationFrame(() => {
        applyView({
          zoom: zoomRef.current,
          pan: panRef.current,
        })
      })
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    const viewportElement = viewportRef.current

    if (!viewportElement) {
      return
    }

    const handleViewportWheel = (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        event.stopPropagation()
        applyView(
          getPointerZoomView(
            viewportRef.current,
            stackRef.current,
            zoomRef.current,
            panRef.current,
            event.clientX,
            event.clientY,
            getWheelDeltaPixels(event),
          ),
        )
        return
      }

      event.preventDefault()

      applyView({
        zoom: zoomRef.current,
        pan: {
          x: panRef.current.x - event.deltaX,
          y: panRef.current.y - event.deltaY,
        },
      })
    }

    viewportElement.addEventListener('wheel', handleViewportWheel, { passive: false })

    return () => {
      viewportElement.removeEventListener('wheel', handleViewportWheel)
    }
  }, [])

  useEffect(() => {
    const stackElement = stackRef.current

    if (!stackElement) {
      return
    }

    const updateConnectorLayer = () => {
      const stackRect = stackElement.getBoundingClientRect()
      const nextPaths = visibleEdges
        .map((edge) => {
          const parentElement = stackElement.querySelector(`[data-node-id="${edge.parentId}"]`)
          const childElement = stackElement.querySelector(`[data-node-id="${edge.childId}"]`)

          if (!parentElement || !childElement) {
            return null
          }

          const parentRect = parentElement.getBoundingClientRect()
          const childRect = childElement.getBoundingClientRect()
          const startX =
            (parentRect.left - stackRect.left + parentRect.width / 2) / zoom
          const startY = (parentRect.bottom - stackRect.top - 4) / zoom
          const endX = (childRect.left - stackRect.left + childRect.width / 2) / zoom
          const endY = (childRect.top - stackRect.top + 4) / zoom
          const curveOffset = Math.max(26, Math.min(72, (endY - startY) * 0.52))

          return {
            id: `${edge.parentId}-${edge.childId}`,
            hue: edge.hue,
            d: `M ${startX} ${startY} C ${startX} ${startY + curveOffset}, ${endX} ${endY - curveOffset}, ${endX} ${endY}`,
          }
        })
        .filter(Boolean)

      setConnectorLayer({
        width: stackElement.scrollWidth,
        height: stackElement.scrollHeight,
        paths: nextPaths,
      })
    }

    updateConnectorLayer()

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => updateConnectorLayer())
        : null

    resizeObserver?.observe(stackElement)
    window.addEventListener('resize', updateConnectorLayer)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateConnectorLayer)
    }
  }, [collapsedSignature, rootTaskId, tree, visibleEdges, zoom])

  const updateZoom = (direction) => {
    applyView({
      zoom: zoomRef.current + direction * ZOOM_STEP,
      pan: panRef.current,
    })
  }

  const resetView = () => {
    fitTreeToViewport()
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
      originX: panRef.current.x,
      originY: panRef.current.y,
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

    applyView({
      zoom: zoomRef.current,
      pan: {
        x: dragRef.current.originX + deltaX,
        y: dragRef.current.originY + deltaY,
      },
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
      >
        <div
          className="mindmap-pan-layer"
          style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0)` }}
        >
          <div
            className="mindmap-scale-layer"
            style={{ transform: `scale(${zoom})` }}
          >
            <div className="mindmap-stack" ref={stackRef}>
              {connectorLayer.paths.length > 0 ? (
                <svg
                  className="mindmap-connector-layer"
                  width={connectorLayer.width}
                  height={connectorLayer.height}
                  viewBox={`0 0 ${connectorLayer.width} ${connectorLayer.height}`}
                  aria-hidden="true"
                >
                  {connectorLayer.paths.map((path) => (
                    <g key={path.id}>
                      <path
                        d={path.d}
                        className="mindmap-connector-glow"
                        stroke={`hsl(${path.hue} 78% 62%)`}
                      />
                      <path
                        d={path.d}
                        className="mindmap-connector-core"
                        stroke={`hsl(${path.hue} 58% 42%)`}
                      />
                    </g>
                  ))}
                </svg>
              ) : null}
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
