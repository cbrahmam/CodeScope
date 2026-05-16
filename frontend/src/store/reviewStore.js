import { create } from 'zustand'
import * as api from '../api/client'

const useReviewStore = create((set) => ({
  reviews: [],
  currentReview: null,
  isLoading: false,
  error: null,

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
      set({ currentReview: review, isLoading: false })
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

  clearError: () => set({ error: null }),
}))

export default useReviewStore
