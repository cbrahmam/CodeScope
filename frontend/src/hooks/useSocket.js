import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'
import useReviewStore from '../store/reviewStore'

function getUserName() {
  let name = localStorage.getItem('codescope_username')
  if (!name) {
    name = prompt('Enter your name for collaboration') || 'Anonymous'
    localStorage.setItem('codescope_username', name)
  }
  return name
}

export default function useSocket(reviewId) {
  const socketRef = useRef(null)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [comments, setComments] = useState([])
  const [activity, setActivity] = useState([])
  const { showToast } = useReviewStore()
  const userName = useRef(getUserName())

  useEffect(() => {
    if (!reviewId) return

    const socket = io('/', { path: '/socket.io', transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join_review', { review_id: reviewId, user_name: userName.current })
    })

    socket.on('users_online', (users) => setOnlineUsers(users))

    socket.on('user_joined', (data) => {
      setActivity((prev) => [...prev.slice(-49), { type: 'join', ...data, time: new Date().toISOString() }])
    })

    socket.on('user_left', (data) => {
      setActivity((prev) => [...prev.slice(-49), { type: 'leave', ...data, time: new Date().toISOString() }])
    })

    socket.on('new_comment', (comment) => {
      setComments((prev) => [...prev, comment])
      setActivity((prev) => [...prev.slice(-49), { type: 'comment', user_name: comment.author, content: comment.content, time: comment.created_at }])
      if (comment.author !== userName.current) {
        showToast(`${comment.author} commented`, 'info')
      }
    })

    socket.on('finding_status_changed', (data) => {
      useReviewStore.getState().findings.forEach(() => {})
      useReviewStore.setState((state) => ({
        findings: state.findings.map((f) =>
          f.id === data.finding_id ? { ...f, status: data.status } : f
        ),
      }))
      setActivity((prev) => [...prev.slice(-49), { type: 'status', ...data, time: new Date().toISOString() }])
      showToast(`${data.user_name} ${data.status} a finding`, 'info')
    })

    socket.on('fix_applied', (data) => {
      useReviewStore.setState((state) => {
        const updatedFindings = state.findings.map((f) =>
          f.id === data.finding_id ? { ...f, status: 'resolved' } : f
        )
        let updatedReview = state.currentReview
        if (updatedReview && data.new_content && data.file_name) {
          try {
            const files = JSON.parse(updatedReview.files)
            const idx = files.findIndex((f) => f.filename === data.file_name)
            if (idx !== -1) {
              files[idx].content = data.new_content
              updatedReview = { ...updatedReview, files: JSON.stringify(files) }
            }
          } catch { /* ignore */ }
        }
        return { findings: updatedFindings, currentReview: updatedReview }
      })
      setActivity((prev) => [...prev.slice(-49), { type: 'fix', ...data, time: new Date().toISOString() }])
      showToast(`${data.user_name} applied a fix to ${data.file_name}`, 'info')
    })

    return () => {
      socket.emit('leave_review', { review_id: reviewId })
      socket.disconnect()
    }
  }, [reviewId, showToast])

  const sendComment = useCallback((data) => {
    socketRef.current?.emit('add_comment', {
      review_id: reviewId,
      author: userName.current,
      ...data,
    })
  }, [reviewId])

  const emitFindingStatus = useCallback((findingId, status) => {
    socketRef.current?.emit('update_finding_status', {
      review_id: reviewId,
      finding_id: findingId,
      status,
      user_name: userName.current,
    })
  }, [reviewId])

  const emitFixApplied = useCallback((findingId, fileName, newContent) => {
    socketRef.current?.emit('fix_applied', {
      review_id: reviewId,
      finding_id: findingId,
      user_name: userName.current,
      file_name: fileName,
      new_content: newContent,
    })
  }, [reviewId])

  const emitCursorMove = useCallback((fileName, line, column) => {
    socketRef.current?.emit('cursor_move', {
      review_id: reviewId,
      user_name: userName.current,
      file_name: fileName,
      line,
      column,
    })
  }, [reviewId])

  const fetchComments = useCallback(async (findingId, lineNumber) => {
    try {
      const params = new URLSearchParams()
      if (findingId) params.set('finding_id', findingId)
      if (lineNumber != null) params.set('line_number', lineNumber)
      const res = await fetch(`/api/reviews/${reviewId}/comments?${params}`)
      const data = await res.json()
      return data
    } catch {
      return []
    }
  }, [reviewId])

  return {
    onlineUsers,
    comments,
    activity,
    userName: userName.current,
    sendComment,
    emitFindingStatus,
    emitFixApplied,
    emitCursorMove,
    fetchComments,
  }
}
