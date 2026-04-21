import TaskNode from './TaskNode'

function TreeView({
  tree,
  usersById,
  selectedTaskId,
  expandedMap,
  onToggle,
  onSelect,
  searchActive,
}) {
  if (tree.length === 0) {
    return (
      <div className="empty-card compact">
        <strong>Không có task nào khớp bộ lọc.</strong>
        <p>Hãy thử đổi user demo hoặc xóa từ khóa tìm kiếm để xem lại cây task.</p>
      </div>
    )
  }

  return (
    <div className="tree-view">
      {tree.map((node) => (
        <TaskNode
          key={node.id}
          node={node}
          level={0}
          usersById={usersById}
          selectedTaskId={selectedTaskId}
          expandedMap={expandedMap}
          onToggle={onToggle}
          onSelect={onSelect}
          searchActive={searchActive}
        />
      ))}
    </div>
  )
}

export default TreeView

