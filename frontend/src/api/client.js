import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export const createReview = (data) => api.post('/reviews', data).then((r) => r.data)

export const getReviews = () => api.get('/reviews').then((r) => r.data)

export const getReview = (id) => api.get(`/reviews/${id}`).then((r) => r.data)

export const deleteReview = (id) => api.delete(`/reviews/${id}`)

export const analyzeReview = (id) => api.post(`/reviews/${id}/analyze`).then((r) => r.data)

export const getFindings = (id, params = {}) =>
  api.get(`/reviews/${id}/findings`, { params }).then((r) => r.data)

export const getComplexity = (id) => api.get(`/reviews/${id}/complexity`).then((r) => r.data)

export const updateFindingStatus = (reviewId, findingId, status) =>
  api.put(`/reviews/${reviewId}/findings/${findingId}`, { status }).then((r) => r.data)

export const applyFix = (reviewId, findingId) =>
  api.post(`/reviews/${reviewId}/findings/${findingId}/apply`).then((r) => r.data)

export default api
