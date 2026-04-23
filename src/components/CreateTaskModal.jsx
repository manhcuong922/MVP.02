import { useState } from 'react'
import Modal from './Modal'

const defaultForm = {
  title: '',
  description: '',
  assignedTo: '',
  priority: 'medium',
  deadline: '',
}

function CreateTaskModal({
  open,
  parentTask,
  assignees,
  onClose,
  onSubmit,
  isSaving,
}) {
  const [form, setForm] = useState({
    ...defaultForm,
    assignedTo: assignees[0]?.id ?? '',
    priority: parentTask ? 'medium' : 'high',
    deadline: parentTask?.deadline ?? '',
  })

  if (!open) {
    return null
  }

  const title = parentTask ? 'Tạo Node Con' : 'Tạo Task Gốc'
  const subtitle = parentTask
    ? `Tạo node mới cho "${parentTask.title}".`
    : 'Khởi tạo task gốc mới.'

  const handleChange = (fieldName, value) => {
    setForm((currentForm) => ({
      ...currentForm,
      [fieldName]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!form.title.trim() || !form.assignedTo || !form.deadline) {
      return
    }

    const didSave = await onSubmit(form)

    if (didSave) {
      onClose()
    }
  }

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="field">
          <span>Tiêu đề task</span>
          <input
            value={form.title}
            onChange={(event) => handleChange('title', event.target.value)}
            placeholder="Nhập tiêu đề task"
          />
        </label>

        <label className="field">
          <span>Người phụ trách</span>
          <select
            value={form.assignedTo}
            onChange={(event) => handleChange('assignedTo', event.target.value)}
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
            rows="5"
            value={form.description}
            onChange={(event) => handleChange('description', event.target.value)}
            placeholder="Mô tả ngắn gọn mục tiêu và phạm vi công việc"
          />
        </label>

        <label className="field">
          <span>Ưu tiên</span>
          <select
            value={form.priority}
            onChange={(event) => handleChange('priority', event.target.value)}
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
            value={form.deadline}
            onChange={(event) => handleChange('deadline', event.target.value)}
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="primary-button" disabled={isSaving}>
            {isSaving ? 'Đang lưu...' : parentTask ? 'Tạo node con' : 'Tạo task gốc'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default CreateTaskModal
