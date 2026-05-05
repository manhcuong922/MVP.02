import { useEffect, useRef, useState } from 'react'
import { formatDateTime, getRoleLabel } from '../utils/formatters'

function getInitial(name) {
  return String(name ?? 'U').trim().charAt(0).toUpperCase() || 'U'
}

function DiscussionAvatar({ user, fallbackName }) {
  return (
    <span
      className="discussion-avatar"
      style={{ '--avatar-accent': user?.accent ?? '#4f46e5' }}
      aria-hidden="true"
    >
      {getInitial(user?.name ?? fallbackName)}
    </span>
  )
}

function TaskDiscussionPanel({
  taskId,
  currentUser,
  usersById,
  entries,
  onSubmitComment,
  isSaving,
}) {
  const [draftMessage, setDraftMessage] = useState('')
  const threadRef = useRef(null)

  useEffect(() => {
    const threadNode = threadRef.current

    if (!threadNode) {
      return
    }

    threadNode.scrollTop = threadNode.scrollHeight
  }, [entries.length, taskId])

  const handleSubmit = async (event) => {
    event.preventDefault()

    const didSave = await onSubmitComment(draftMessage)

    if (didSave) {
      setDraftMessage('')
    }
  }

  const canSubmit = Boolean(draftMessage.trim()) && !isSaving

  return (
    <div className="discussion-layout">
      <div className="content-card discussion-thread-shell">
        <div className="discussion-thread" ref={threadRef}>
          {entries.length === 0 ? (
            <div className="empty-card compact discussion-empty">
              <strong>Chua co trao doi nao.</strong>
              <p>Hay de lai binh luan dau tien de mo luong trao doi cho task nay.</p>
            </div>
          ) : (
            entries.map((entry) => {
              const author = usersById[entry.authorId]
              const isOwnMessage = currentUser?.id === entry.authorId

              return (
                <div
                  key={entry.id}
                  className={`discussion-message ${isOwnMessage ? 'own' : ''}`}
                >
                  {!isOwnMessage ? (
                    <DiscussionAvatar
                      user={author}
                      fallbackName={entry.authorName}
                    />
                  ) : null}

                  <article
                    className="discussion-bubble"
                    style={{ '--bubble-accent': author?.accent ?? '#4f46e5' }}
                  >
                    <div className="discussion-bubble-topline">
                      <div className="discussion-author">
                        <strong>{author?.name ?? entry.authorName}</strong>
                        <span>
                          {author
                            ? `${getRoleLabel(author.role)} • ${author.department}`
                            : 'Thanh vien du an'}
                        </span>
                      </div>
                      <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                    </div>
                    <p>{entry.message}</p>
                  </article>

                  {isOwnMessage ? (
                    <DiscussionAvatar
                      user={author}
                      fallbackName={entry.authorName}
                    />
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </div>

      <form className="content-card discussion-composer" onSubmit={handleSubmit}>
        <div className="discussion-input-row">
          <textarea
            rows="2"
            value={draftMessage}
            onChange={(event) => setDraftMessage(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            placeholder="Nhap binh luan, canh bao, hoac thong tin can phoi hop trong task."
          />
          <button
            type="submit"
            className="discussion-send-button"
            disabled={!canSubmit}
            aria-label="Gui binh luan"
          >
            {isSaving ? '...' : 'Gui'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default TaskDiscussionPanel
