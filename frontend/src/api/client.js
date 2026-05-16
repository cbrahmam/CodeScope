import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export const createReview = (data) => api.post('/reviews', data).then((r) => r.data)

export const getReviews = () => api.get('/reviews').then((r) => r.data)

export const getReview = (id) => api.get(`/reviews/${id}`).then((r) => r.data)

export const deleteReview = (id) => api.delete(`/reviews/${id}`)

export default api
