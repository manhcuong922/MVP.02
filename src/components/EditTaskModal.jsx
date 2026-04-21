import { useEffect, useState } from 'react'
import Modal from './Modal'

function EditTaskModal({ open, task, assignees, onClose, onSubmit, isSaving }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    assignedTo: '',
    priority: 'medium',
    deadline: '',
  })

  useEffect(() => {
    if (!task) {
      return
    }

    setForm({
      title: task.title ?? '',
      description: task.description ?? '',
      assignedTo: task.assignedTo ?? assignees[0]?.id ?? '',
      priority: task.priority ?? 'medium',
      deadline: task.deadline ?? '',
    })
  }, [assignees, task])

  if (!open || !task) {
    return null
  }

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
    <Modal
      title="Chỉnh Sửa Task"
      subtitle={`Cập nhật nhanh các trường quan trọng của "${task.title}". Mọi thay đổi sẽ được ghi log vào lịch sử chỉnh sửa.`}
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="field">
          <span>Tiêu đề</span>
          <input
            value={form.title}
            onChange={(event) => handleChange('title', event.target.value)}
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
            {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default EditTaskModal
