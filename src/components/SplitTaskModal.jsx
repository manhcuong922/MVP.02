import { useState } from 'react'
import Modal from './Modal'

function createBlankItem(assigneeId, deadline) {
  return {
    title: '',
    description: '',
    assignedTo: assigneeId,
    priority: 'medium',
    deadline: deadline || '',
  }
}

function SplitTaskModal({
  open,
  parentTask,
  assignees,
  onClose,
  onSubmit,
  isSaving,
}) {
  const [items, setItems] = useState(() => {
    const defaultAssignee = assignees[0]?.id ?? ''
    return [
      createBlankItem(defaultAssignee, parentTask?.deadline),
      createBlankItem(assignees[1]?.id ?? defaultAssignee, parentTask?.deadline),
    ]
  })

  if (!open || !parentTask) {
    return null
  }

  const updateItem = (index, fieldName, value) => {
    setItems((currentItems) =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [fieldName]: value,
            }
          : item,
      ),
    )
  }

  const addRow = () => {
    setItems((currentItems) => [
      ...currentItems,
      createBlankItem(assignees[0]?.id ?? '', parentTask.deadline),
    ])
  }

  const removeRow = (index) => {
    setItems((currentItems) => currentItems.filter((_, itemIndex) => itemIndex !== index))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const normalizedItems = items.filter(
      (item) => item.title.trim() && item.assignedTo && item.deadline,
    )

    if (normalizedItems.length === 0) {
      return
    }

    const didSave = await onSubmit(normalizedItems)

    if (didSave) {
      onClose()
    }
  }

  return (
    <Modal
      title="Chia Task Thành Nhiều Subtask"
      subtitle={`Task cha: "${parentTask.title}". Bạn có thể tạo nhiều nhánh để giao cho cấp dưới trực tiếp.`}
      width="920px"
      onClose={onClose}
    >
      <form className="split-form" onSubmit={handleSubmit}>
        <div className="split-toolbar">
          <p>Tạo nhiều subtask song song để demo rõ cấu trúc cây phân rã.</p>
          <button type="button" className="ghost-button" onClick={addRow}>
            Thêm dòng
          </button>
        </div>

        <div className="split-list">
          {items.map((item, index) => (
            <div key={`${index}-${item.assignedTo}`} className="split-row">
              <div className="split-row-header">
                <strong>Subtask {index + 1}</strong>
                {items.length > 1 ? (
                  <button
                    type="button"
                    className="ghost-link"
                    onClick={() => removeRow(index)}
                  >
                    Xóa
                  </button>
                ) : null}
              </div>

              <div className="split-row-grid">
                <label className="field">
                  <span>Tiêu đề</span>
                  <input
                    value={item.title}
                    onChange={(event) =>
                      updateItem(index, 'title', event.target.value)
                    }
                    placeholder="Ví dụ: Chuẩn bị deck hợp tác"
                  />
                </label>

                <label className="field">
                  <span>Người phụ trách</span>
                  <select
                    value={item.assignedTo}
                    onChange={(event) =>
                      updateItem(index, 'assignedTo', event.target.value)
                    }
                  >
                    {assignees.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} • {user.department}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field field-full">
                  <span>Mô tả</span>
                  <textarea
                    rows="3"
                    value={item.description}
                    onChange={(event) =>
                      updateItem(index, 'description', event.target.value)
                    }
                    placeholder="Mục tiêu đầu ra và phạm vi giao việc."
                  />
                </label>

                <label className="field">
                  <span>Ưu tiên</span>
                  <select
                    value={item.priority}
                    onChange={(event) =>
                      updateItem(index, 'priority', event.target.value)
                    }
                  >
                    <option value="low">Thấp</option>
                    <option value="medium">Trung bình</option>
                    <option value="high">Cao</option>
                    <option value="critical">Khẩn cấp</option>
                  </select>
                </label>

                <label className="field">
                  <span>Deadline</span>
                  <input
                    type="date"
                    value={item.deadline}
                    onChange={(event) =>
                      updateItem(index, 'deadline', event.target.value)
                    }
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="primary-button" disabled={isSaving}>
            {isSaving ? 'Đang lưu...' : 'Tạo các subtask'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default SplitTaskModal
