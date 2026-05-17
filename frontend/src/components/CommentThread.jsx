import { useState, useEffect, useRef } from 'react'

function CommentThread({ reviewId, findingId, lineNumber, comments: socketComments, onSend, fetchComments }) {
  const [localComments, setLocalComments] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    fetchComments(findingId, lineNumber).then((data) => {
      setLocalComments(data)
      setLoading(false)
    })
  }, [findingId, lineNumber, fetchComments])

  const allComments = [...localComments]
  for (const sc of socketComments) {
    const match = findingId
      ? sc.finding_id === findingId
      : sc.line_number === lineNumber
    if (match && !allComments.some((c) => c.id === sc.id)) {
      allComments.push(sc)
    }
  }
  allComments.sort((a, b) => a.created_at.localeCompare(b.created_at))

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [allComments.length])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!input.trim()) return
    onSend({ finding_id: findingId, line_number: lineNumber, content: input.trim() })
    setInput('')
  }

  const renderContent = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-bg-tertiary rounded text-xs font-mono">$1</code>')
  }

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="text-xs text-text-secondary hover:text-accent flex items-center gap-1"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {allComments.length} comment{allComments.length !== 1 ? 's' : ''}
      </button>
    )
  }

  return (
    <div className="mt-2 border border-border-primary rounded-md bg-bg-primary">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-primary bg-bg-tertiary/50">
        <span className="text-[11px] text-text-secondary font-medium">
          {allComments.length} comment{allComments.length !== 1 ? 's' : ''}
        </span>
        <button onClick={() => setCollapsed(true)} className="text-text-secondary hover:text-text-primary">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="px-3 py-4 text-xs text-text-secondary text-center">Loading comments...</div>
      ) : (
        <div className="max-h-48 overflow-y-auto">
          {allComments.map((comment) => (
            <div key={comment.id} className="px-3 py-2 border-b border-border-primary/30 last:border-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-medium text-text-primary">{comment.author}</span>
                <span className="text-[10px] text-text-secondary">
                  {new Date(comment.created_at).toLocaleTimeString()}
                </span>
              </div>
              <p
                className="text-xs text-text-secondary leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderContent(comment.content) }}
              />
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-1.5 p-2 border-t border-border-primary">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 px-2 py-1 text-xs bg-bg-secondary border border-border-primary rounded text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="px-2 py-1 text-xs bg-accent text-bg-primary rounded font-medium disabled:opacity-30 hover:bg-accent-hover transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}

export default CommentThread
