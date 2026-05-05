import {
  ACTION_LABELS,
  FIELD_LABELS,
  PRIORITY_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
} from '../data/demoData'

const STATUS_LABEL_OVERRIDES = {
  not_completed: 'Chưa thực hiện',
  pending: 'Chưa thực hiện',
  in_progress: 'Đang xử lý',
  cancelled: 'Hủy',
}

const FIELD_LABEL_OVERRIDES = {
  progress: 'Tiến độ',
}

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

export function formatFileSize(value) {
  const normalized = Number(value ?? 0)

  if (!Number.isFinite(normalized) || normalized <= 0) {
    return '0 B'
  }

  if (normalized < 1024) {
    return `${normalized} B`
  }

  const units = ['KB', 'MB', 'GB']
  let size = normalized / 1024
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size >= 10 ? Math.round(size) : size.toFixed(1)} ${units[unitIndex]}`
}

export function getRoleLabel(role) {
  return ROLE_LABELS[role] ?? role
}

export function getStatusLabel(status) {
  return STATUS_LABEL_OVERRIDES[status] ?? STATUS_LABELS[status] ?? status
}

export function getPriorityLabel(priority) {
  return PRIORITY_LABELS[priority] ?? priority
}

export function getFieldLabel(fieldName) {
  return FIELD_LABEL_OVERRIDES[fieldName] ?? FIELD_LABELS[fieldName] ?? fieldName
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

export function truncateTitleWords(value, maxWords = 4, maxLength = 40) {
  if (!value) {
    return ''
  }

  const normalized = value.trim().replace(/\s+/g, ' ')

  if (!normalized) {
    return ''
  }

  const words = normalized.split(' ')

  if (words.length <= maxWords && normalized.length <= maxLength) {
    return normalized
  }

  const compactText = words.slice(0, maxWords).join(' ')

  if (compactText.length > maxLength) {
    return `${compactText.slice(0, maxLength).trim()}...`
  }

  return `${compactText}...`
}

