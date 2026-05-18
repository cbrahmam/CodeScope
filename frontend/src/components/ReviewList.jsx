import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import useReviewStore from '../store/reviewStore'
import ScoreGauge from './ScoreGauge'
import { getLanguageInfo } from '../utils/languageDetect'

const SEVERITY_COLORS = {
  critical: 'text-severity-critical',
  high: 'text-severity-high',
  medium: 'text-severity-medium',
  low: 'text-severity-low',
  info: 'text-severity-info',
}

const STATUS_BADGES = {
  pending: { label: 'Pending', bg: 'bg-bg-tertiary', text: 'text-text-secondary' },
  analyzing: { label: 'Analyzing', bg: 'bg-accent/20', text: 'text-accent' },
  reviewed: { label: 'Reviewed', bg: 'bg-severity-low/20', text: 'text-severity-low' },
}

function ReviewList() {
  const navigate = useNavigate()
  const { reviews, isLoading, fetchReviews, deleteReview } = useReviewStore()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [filterLang, setFilterLang] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  const languages = useMemo(() => {
    const langs = new Set(reviews.map((r) => r.language).filter(Boolean))
    return [...langs].sort()
  }, [reviews])

  const filtered = useMemo(() => {
    let result = [...reviews]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((r) => r.title.toLowerCase().includes(q))
    }
    if (filterLang) {
      result = result.filter((r) => r.language === filterLang)
    }
    if (filterStatus) {
      result = result.filter((r) => r.status === filterStatus)
    }

    result.sort((a, b) => {
      if (sortBy === 'date') return b.created_at.localeCompare(a.created_at)
      if (sortBy === 'score') return (b.score ?? -1) - (a.score ?? -1)
      if (sortBy === 'findings') return (b.total_findings ?? 0) - (a.total_findings ?? 0)
      return 0
    })

    return result
  }, [reviews, search, sortBy, filterLang, filterStatus])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (confirm('Delete this review?')) {
      await deleteReview(id)
    }
  }

  if (isLoading && reviews.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-text-primary">Review History</h2>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-bg-primary font-medium text-sm rounded-md transition-colors"
        >
          New Review
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reviews..."
          className="flex-1 min-w-[200px] px-3 py-2 text-sm bg-bg-secondary border border-border-primary rounded-md text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 text-sm bg-bg-secondary border border-border-primary rounded-md text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="date">Sort by Date</option>
          <option value="score">Sort by Score</option>
          <option value="findings">Sort by Findings</option>
        </select>
        <select
          value={filterLang}
          onChange={(e) => setFilterLang(e.target.value)}
          className="px-3 py-2 text-sm bg-bg-secondary border border-border-primary rounded-md text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="">All Languages</option>
          {languages.map((l) => (
            <option key={l} value={l}>{getLanguageInfo(l)?.label || l}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-sm bg-bg-secondary border border-border-primary rounded-md text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-text-secondary">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">No reviews found</p>
          <button
            onClick={() => navigate('/')}
            className="mt-3 text-sm text-accent hover:text-accent-hover"
          >
            Start your first review
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((review) => {
            const badge = STATUS_BADGES[review.status] || STATUS_BADGES.pending
            const langInfo = getLanguageInfo(review.language)
            const counts = review.finding_counts || {}
            return (
              <div
                key={review.id}
                onClick={() => navigate(`/review/${review.id}`)}
                className="bg-bg-secondary border border-border-primary rounded-lg p-4 hover:border-accent/50 cursor-pointer transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">
                      {review.title}
                    </h3>
                    <p className="text-[11px] text-text-secondary mt-0.5">
                      {new Date(review.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </p>
                  </div>
                  {review.score != null && (
                    <div className="ml-2 flex-shrink-0">
                      <ScoreGauge score={review.score} size={44} />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-3">
                  {langInfo && (
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded text-white ${langInfo.color}`}>
                      {langInfo.label}
                    </span>
                  )}
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                  <span className="text-[10px] text-text-secondary">
                    {review.file_count} file{review.file_count !== 1 ? 's' : ''}
                  </span>
                </div>

                {review.total_findings > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 text-[11px]">
                      {['critical', 'high', 'medium', 'low'].map((sev) =>
                        counts[sev] ? (
                          <span key={sev} className={SEVERITY_COLORS[sev]}>
                            {counts[sev]} {sev}
                          </span>
                        ) : null
                      )}
                    </div>
                    <p className="text-[11px] text-text-secondary mt-1">
                      {review.resolved_findings}/{review.total_findings} resolved
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border-primary/50">
                  <span className="text-[10px] text-text-secondary">
                    Updated {new Date(review.updated_at).toLocaleTimeString('en-US', {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, review.id)}
                    className="text-text-secondary hover:text-severity-critical text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ReviewList
