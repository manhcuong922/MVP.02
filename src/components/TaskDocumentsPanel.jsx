import { useId, useMemo, useRef } from 'react'
import { formatDate, formatDateTime, formatFileSize } from '../utils/formatters'

function getFileExtension(name) {
  const parts = String(name ?? '').split('.')

  if (parts.length < 2) {
    return 'FILE'
  }

  return parts.at(-1)?.slice(0, 4).toUpperCase() ?? 'FILE'
}

function getDocumentLabel(entry) {
  if (entry.kind === 'image') {
    return 'Anh'
  }

  const mimeType = String(entry.mimeType ?? '').toLowerCase()

  if (mimeType.includes('pdf')) {
    return 'PDF'
  }

  if (mimeType.includes('word') || mimeType.includes('document')) {
    return 'DOC'
  }

  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
    return 'XLS'
  }

  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
    return 'PPT'
  }

  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('compressed')) {
    return 'ZIP'
  }

  return getFileExtension(entry.name)
}

function TaskDocumentsPanel({
  currentUser,
  entries,
  onUploadDocuments,
  isUploading,
}) {
  const fileInputId = useId()
  const fileInputRef = useRef(null)
  const groupedEntries = useMemo(() => {
    const groups = []

    entries.forEach((entry) => {
      const dateLabel = formatDate(entry.createdAt)
      const currentGroup = groups.at(-1)

      if (!currentGroup || currentGroup.dateLabel !== dateLabel) {
        groups.push({
          dateLabel,
          entries: [entry],
        })
        return
      }

      currentGroup.entries.push(entry)
    })

    return groups
  }, [entries])

  const handleOpenPicker = () => {
    fileInputRef.current?.click()
  }

  const handleFilesSelected = async (event) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''

    if (files.length === 0) {
      return
    }

    await onUploadDocuments(files)
  }

  return (
    <div className="documents-layout">
      <article className="content-card documents-upload-card">
        <div className="documents-upload-copy">
          <h3>Tai lieu do an</h3>
          <p>Tai anh, PDF, Word, Excel hoac tep lien quan cua du an len task hien tai.</p>
        </div>

        <div className="documents-upload-actions">
          <input
            id={fileInputId}
            ref={fileInputRef}
            className="documents-file-input"
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
            onChange={handleFilesSelected}
            disabled={!currentUser || isUploading}
          />
          <button
            type="button"
            className="primary-button"
            onClick={handleOpenPicker}
            disabled={!currentUser || isUploading}
          >
            {isUploading ? 'Dang tai len...' : 'Tai anh / tai lieu'}
          </button>
        </div>
      </article>

      {entries.length === 0 ? (
        <div className="empty-card compact">
          <strong>Chua co tai lieu nao.</strong>
          <p>Chon anh, file PDF hoac tai lieu du an de luu chung trong task nay.</p>
        </div>
      ) : (
        groupedEntries.map((group) => (
          <section key={group.dateLabel} className="document-date-group">
            <div className="document-date-heading">
              <strong>Ngay gui {group.dateLabel}</strong>
              <span>{group.entries.length} tai lieu</span>
            </div>

            <div className="documents-grid">
              {group.entries.map((entry) => (
                <article key={entry.id} className="document-card">
                  {entry.kind === 'image' ? (
                    <a
                      className="document-preview-link"
                      href={entry.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        className="document-image-preview"
                        src={entry.downloadUrl}
                        alt={entry.name}
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <div className="document-file-mark">{getDocumentLabel(entry)}</div>
                  )}

                  <div className="document-card-body">
                    <div className="document-card-topline">
                      <span className={`document-kind-pill kind-${entry.kind}`}>
                        {entry.kind === 'image' ? 'Anh' : 'Tai lieu'}
                      </span>
                      <span className="subtle-label">{formatFileSize(entry.size)}</span>
                    </div>

                    <strong title={entry.name}>{entry.name}</strong>
                    <p>
                      {entry.uploaderName} • {formatDateTime(entry.createdAt)}
                    </p>

                    <div className="document-card-actions">
                      <a
                        className="ghost-link"
                        href={entry.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {entry.kind === 'image' ? 'Xem anh' : 'Mo tep'}
                      </a>
                      <a
                        className="ghost-link"
                        href={entry.downloadUrl}
                        download={entry.name}
                      >
                        Tai xuong
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

export default TaskDocumentsPanel
