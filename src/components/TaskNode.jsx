import { getPriorityLabel, getStatusLabel } from '../utils/formatters'
import { formatPercent } from '../utils/formatters'
import { isTaskLate } from '../utils/taskUtils'

function ChevronIcon({ open }) {
  return (
    <svg
      className={`tree-chevron ${open ? 'open' : ''}`}
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path
        d="M7.5 4.75 13.25 10l-5.75 5.25"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}

function FolderIcon({ open }) {
  return (
    <svg className="tree-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3.75 6.75h5.1l1.55 1.95H20.25a1.5 1.5 0 0 1 1.5 1.5v7.05a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V8.25a1.5 1.5 0 0 1 1.5-1.5Z"
        fill={open ? 'rgba(245, 158, 11, 0.25)' : 'rgba(14, 165, 233, 0.16)'}
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M3.75 10.2h18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg className="tree-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7.25 3.75h7.6l4.15 4.15v11.35a1.5 1.5 0 0 1-1.5 1.5H7.25a1.5 1.5 0 0 1-1.5-1.5V5.25a1.5 1.5 0 0 1 1.5-1.5Z"
        fill="rgba(15, 118, 110, 0.12)"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M14.75 3.75V8h4.25"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  )
}

function TaskNode({
  node,
  level,
  usersById,
  selectedTaskId,
  expandedMap,
  onToggle,
  onSelect,
  searchActive,
}) {
  const hasVisibleChildren = node.treeChildren.length > 0
  const childTaskCount = node.childTaskCount ?? node.treeChildren.length
  const hasChildren = childTaskCount > 0
  const isExpanded = searchActive ? true : Boolean(expandedMap[node.id])
  const assignee = usersById[node.assignedTo]
  const late = isTaskLate(node)

  return (
    <div className="task-node-block">
      <div
        className={`task-node ${selectedTaskId === node.id ? 'selected' : ''}`}
        style={{ '--depth': level }}
        data-status={node.status}
      >
        <div className="task-node-main">
          <button
            type="button"
            className="task-select"
            onClick={() => onSelect(node.id)}
          >
            <span className="tree-left">
              {hasChildren ? (
                <span
                  className="tree-toggle"
                  onClick={(event) => {
                    event.stopPropagation()
                    onToggle(node.id)
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onToggle(node.id)
                    }
                  }}
                >
                  <ChevronIcon open={isExpanded} />
                </span>
              ) : (
                <span className="tree-toggle spacer" />
              )}
              {hasChildren ? <FolderIcon open={isExpanded} /> : <FileIcon />}
            </span>

            <span className="task-node-copy">
              <strong>{node.title}</strong>
              <small>{assignee?.name ?? 'Chưa rõ người phụ trách'}</small>
            </span>
          </button>

          <div className="task-node-meta">
            <span className={`badge status-${node.status}`}>
              {getStatusLabel(node.status)}
            </span>
            <span className={`badge priority-${node.priority}`}>
              {getPriorityLabel(node.priority)}
            </span>
            {late ? <span className="badge badge-danger">Trễ hạn</span> : null}
            <span className="progress-chip">{formatPercent(node.progress)}</span>
          </div>
        </div>

        {Number(node.progress ?? 0) > 0 || hasChildren ? (
          <div className="node-progress-track">
            <div
              className="node-progress-fill"
              style={{ width: `${Number(node.progress ?? 0)}%` }}
            />
          </div>
        ) : null}
      </div>

      {hasVisibleChildren && isExpanded ? (
        <div className="task-node-children">
          {node.treeChildren.map((child) => (
            <TaskNode
              key={child.id}
              node={child}
              level={level + 1}
              usersById={usersById}
              selectedTaskId={selectedTaskId}
              expandedMap={expandedMap}
              onToggle={onToggle}
              onSelect={onSelect}
              searchActive={searchActive}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default TaskNode
