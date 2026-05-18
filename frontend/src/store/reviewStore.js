import { create } from 'zustand'
import * as api from '../api/client'

const useReviewStore = create((set, get) => ({
  reviews: [],
  currentReview: null,
  findings: [],
  complexity: null,
  dashboardStats: null,
  isLoading: false,
  isAnalyzing: false,
  error: null,
  toast: null,

  createReview: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const review = await api.createReview(data)
      set((state) => ({ reviews: [review, ...state.reviews], isLoading: false }))
      return review
    } catch (err) {
      const message = err.response?.data?.detail || err.message || 'Failed to create review'
      set({ error: message, isLoading: false })
      throw err
    }
  },

  fetchReviews: async () => {
    set({ isLoading: true, error: null })
    try {
      const reviews = await api.getReviews()
      set({ reviews, isLoading: false })
    } catch (err) {
      const message = err.response?.data?.detail || err.message || 'Failed to fetch reviews'
      set({ error: message, isLoading: false })
    }
  },

  fetchReview: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const review = await api.getReview(id)
      set({ currentReview: review, findings: review.findings || [], isLoading: false })
      return review
    } catch (err) {
      const message = err.response?.data?.detail || err.message || 'Failed to fetch review'
      set({ error: message, isLoading: false })
      throw err
    }
  },

  deleteReview: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await api.deleteReview(id)
      set((state) => ({
        reviews: state.reviews.filter((r) => r.id !== id),
        isLoading: false,
      }))
    } catch (err) {
      const message = err.response?.data?.detail || err.message || 'Failed to delete review'
      set({ error: message, isLoading: false })
    }
  },

  analyzeReview: async (id) => {
    set({ isAnalyzing: true, error: null })
    try {
      const result = await api.analyzeReview(id)
      set({
        findings: result.findings || [],
        isAnalyzing: false,
        currentReview: { ...get().currentReview, status: 'reviewed' },
      })
      return result
    } catch (err) {
      const message = err.response?.data?.detail || err.message || 'Analysis failed'
      set({ error: message, isAnalyzing: false })
      throw err
    }
  },

  fetchFindings: async (id, filters = {}) => {
    try {
      const findings = await api.getFindings(id, filters)
      set({ findings })
    } catch (err) {
      console.error('Failed to fetch findings:', err)
    }
  },

  fetchComplexity: async (id) => {
    try {
      const data = await api.getComplexity(id)
      set({ complexity: data })
    } catch (err) {
      console.error('Failed to fetch complexity:', err)
    }
  },

  updateFindingStatus: async (reviewId, findingId, status) => {
    try {
      const updated = await api.updateFindingStatus(reviewId, findingId, status)
      set((state) => ({
        findings: state.findings.map((f) => (f.id === findingId ? { ...f, status: updated.status } : f)),
        toast: { message: `Finding ${status}`, type: 'success' },
      }))
      return updated
    } catch (err) {
      set({ toast: { message: 'Failed to update finding', type: 'error' } })
    }
  },

  applyFix: async (reviewId, findingId) => {
    try {
      const result = await api.applyFix(reviewId, findingId)
      set((state) => {
        const updatedFindings = state.findings.map((f) =>
          f.id === findingId ? { ...f, status: 'resolved' } : f
        )
        let updatedReview = state.currentReview
        if (updatedReview && result.new_content) {
          try {
            const files = JSON.parse(updatedReview.files)
            const idx = files.findIndex((f) => f.filename === result.file_name)
            if (idx !== -1) {
              files[idx].content = result.new_content
              updatedReview = { ...updatedReview, files: JSON.stringify(files) }
            }
          } catch { /* ignore parse errors */ }
        }
        return {
          findings: updatedFindings,
          currentReview: updatedReview,
          toast: { message: `Fix applied to ${result.file_name}`, type: 'success' },
        }
      })
      return result
    } catch (err) {
      set({ toast: { message: 'Failed to apply fix', type: 'error' } })
      throw err
    }
  },

  fetchDashboardStats: async () => {
    try {
      const stats = await api.getDashboardStats()
      set({ dashboardStats: stats })
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err)
    }
  },

  exportReview: async (reviewId, format = 'markdown') => {
    try {
      const result = await api.exportReview(reviewId, format)
      return result
    } catch (err) {
      set({ toast: { message: 'Failed to export review', type: 'error' } })
      throw err
    }
  },

  showToast: (message, type = 'info') => set({ toast: { message, type } }),
  clearToast: () => set({ toast: null }),
  clearError: () => set({ error: null }),
}))

export default useReviewStore
