import { useEffect } from 'react'
import useReviewStore from '../store/reviewStore'

function Toast() {
  const { toast, clearToast } = useReviewStore()

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(clearToast, 3000)
      return () => clearTimeout(timer)
    }
  }, [toast, clearToast])

  if (!toast) return null

  const colors = {
    success: 'bg-accent/20 border-accent/40 text-accent',
    error: 'bg-severity-critical/20 border-severity-critical/40 text-severity-high',
    info: 'bg-severity-low/20 border-severity-low/40 text-severity-low',
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2">
      <div className={`px-4 py-2.5 rounded-lg border text-sm ${colors[toast.type] || colors.info}`}>
        {toast.message}
      </div>
    </div>
  )
}

export default Toast
