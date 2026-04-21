import {
  ACTION_LABELS,
  FIELD_LABELS,
  PRIORITY_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
} from '../data/demoData'

export function formatDate(dateValue) {
  if (!dateValue) {
    return 'Chưa đặt'
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateValue))
}

export function formatDateTime(dateValue) {
  if (!dateValue) {
    return 'Chưa rõ'
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateValue))
}

export function formatPercent(value) {
  return `${Number(value ?? 0)}%`
}

export function getRoleLabel(role) {
  return ROLE_LABELS[role] ?? role
}

export function getStatusLabel(status) {
  return STATUS_LABELS[status] ?? status
}

export function getPriorityLabel(priority) {
  return PRIORITY_LABELS[priority] ?? priority
}

export function getFieldLabel(fieldName) {
  return FIELD_LABELS[fieldName] ?? fieldName
}

export function getActionLabel(actionType) {
  return ACTION_LABELS[actionType] ?? actionType
}

export function truncateText(value, maxLength = 120) {
  if (!value || value.length <= maxLength) {
    return value || ''
  }

  return `${value.slice(0, maxLength).trim()}...`
}

