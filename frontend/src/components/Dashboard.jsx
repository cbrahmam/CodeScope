import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useReviewStore from '../store/reviewStore'
import ScoreGauge from './ScoreGauge'
import { getLanguageInfo } from '../utils/languageDetect'
import Toast from './Toast'

const SAMPLE_FILES = {
  'vulnerable_api.py': {
    language: 'python',
    description: 'Flask API with SQL injection, hardcoded secrets, and path traversal',
  },
  'messy_react.jsx': {
    language: 'jsx',
    description: 'React component with memory leaks, prop drilling, and missing memoization',
  },
  'slow_algorithm.js': {
    language: 'javascript',
    description: 'O(n^3) algorithms, blocking I/O, and N+1 queries',
  },
}

function Dashboard() {
  const navigate = useNavigate()
  const { dashboardStats, fetchDashboardStats, createReview, showToast } = useReviewStore()
  const [quickCode, setQuickCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingSample, setLoadingSample] = useState(null)

  useEffect(() => {
    fetchDashboardStats()
  }, [fetchDashboardStats])

  const handleQuickReview = async () => {
    if (!quickCode.trim()) return
    setSubmitting(true)
    try {
      const review = await createReview({
        title: `Quick Review - ${new Date().toLocaleString()}`,
        files: [{ filename: 'code.txt', content: quickCode }],
      })
      navigate(`/review/${review.id}`)
    } catch {
      showToast('Failed to create review', 'error')
    }
    setSubmitting(false)
  }

  const handleTrySample = async (filename) => {
    setLoadingSample(filename)
    try {
      const resp = await fetch(`/sample-code/${filename}`)
      if (!resp.ok) throw new Error('Failed to load sample')
      const content = await resp.text()
      const meta = SAMPLE_FILES[filename]
      const review = await createReview({
        title: `Sample: ${filename}`,
        files: [{ filename, content, language: meta.language }],
      })
      navigate(`/review/${review.id}`)
    } catch {
      showToast('Failed to load sample code', 'error')
    }
    setLoadingSample(null)
  }

  const stats = dashboardStats
  const isFirstVisit = stats && stats.total_reviews === 0

  return (
    <div className="animate-fade-in">
      <Toast />

      {isFirstVisit && (
        <div className="mb-8 bg-gradient-to-r from-accent/10 to-bg-secondary border border-accent/20 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-1">Welcome to CodeScope</h2>
          <p className="text-sm text-text-secondary mb-4">Try a sample review to see AI-powered code analysis in action.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(SAMPLE_FILES).map(([filename, meta]) => (
              <button
                key={filename}
                onClick={() => handleTrySample(filename)}
                disabled={loadingSample !== null}
                className="text-left p-3 bg-bg-primary border border-border-primary rounded-lg hover:border-accent/50 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 text-[10px] rounded text-white ${getLanguageInfo(meta.language).color}`}>
                    {getLanguageInfo(meta.language).label}
                  </span>
                  <span className="text-xs font-mono text-text-primary">{filename}</span>
                </div>
                <p className="text-[11px] text-text-secondary">{meta.description}</p>
                {loadingSample === filename && (
                  <span className="text-[10px] text-accent mt-1 block">Loading...</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats ? (
          <>
            <StatCard label="Total Reviews" value={stats.total_reviews} icon={<ReviewIcon />} />
            <StatCard label="Findings Identified" value={stats.total_findings} icon={<FindingsIcon />} />
            <StatCard label="Top Category" value={stats.top_category ?? '—'} icon={<CategoryIcon />} />
            <StatCard label="Avg Score" value={stats.avg_score != null ? `${stats.avg_score}` : '—'} icon={<TrendIcon />} />
          </>
        ) : (
          <>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-bg-secondary border border-border-primary rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="skeleton w-5 h-5 rounded" />
                  <div>
                    <div className="skeleton w-20 h-3 mb-2" />
                    <div className="skeleton w-12 h-5" />
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Recent Reviews</h2>
            <button onClick={() => navigate('/reviews')} className="text-sm text-accent hover:text-accent-hover">
              View all
            </button>
          </div>

          {!stats ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-bg-secondary border border-border-primary rounded-lg p-4 flex items-center gap-4">
                  <div className="skeleton w-10 h-10 rounded-full" />
                  <div className="flex-1">
                    <div className="skeleton w-48 h-4 mb-2" />
                    <div className="skeleton w-32 h-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : !stats.recent_reviews?.length ? (
            <div className="bg-bg-secondary border border-border-primary rounded-lg p-8 text-center">
              <p className="text-sm text-text-secondary mb-3">No reviews yet</p>
              <button onClick={() => navigate('/new')} className="text-sm text-accent hover:text-accent-hover">
                Start your first review
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recent_reviews.map((review) => {
                const langInfo = getLanguageInfo(review.language)
                return (
                  <div
                    key={review.id}
                    onClick={() => navigate(`/review/${review.id}`)}
                    className="bg-bg-secondary border border-border-primary rounded-lg p-4 hover:border-accent/50 cursor-pointer transition-colors flex items-center gap-4 finding-card"
                  >
                    <div className="flex-shrink-0">
                      {review.score != null ? (
                        <ScoreGauge score={review.score} size={40} />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center text-xs text-text-secondary">—</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-text-primary truncate">{review.title}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {langInfo && (
                          <span className={`px-1 py-0.5 text-[10px] rounded text-white ${langInfo.color}`}>
                            {langInfo.label}
                          </span>
                        )}
                        <span className="text-[10px] text-text-secondary">
                          {review.file_count} file{review.file_count !== 1 ? 's' : ''}
                        </span>
                        {review.total_findings > 0 && (
                          <span className="text-[10px] text-text-secondary">
                            {review.resolved_findings}/{review.total_findings} resolved
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-text-secondary flex-shrink-0">
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-text-primary mb-4">Quick Review</h2>
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-4">
            <textarea
              value={quickCode}
              onChange={(e) => setQuickCode(e.target.value)}
              placeholder="Paste code here for a quick review..."
              rows={8}
              className="w-full px-3 py-2 text-sm bg-bg-primary border border-border-primary rounded-md text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent font-mono resize-none"
            />
            <button
              onClick={handleQuickReview}
              disabled={!quickCode.trim() || submitting}
              className="mt-3 w-full px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-bg-primary font-medium rounded-md transition-colors disabled:opacity-40"
            >
              {submitting ? 'Creating...' : 'Start Review'}
            </button>
          </div>

          <div className="mt-6">
            <button
              onClick={() => navigate('/github')}
              className="w-full flex items-center gap-3 px-4 py-3 bg-bg-secondary border border-border-primary rounded-lg hover:border-accent/50 transition-colors text-left"
            >
              <svg className="w-5 h-5 text-text-secondary" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <div>
                <span className="text-sm font-medium text-text-primary">Import from GitHub</span>
                <p className="text-[11px] text-text-secondary">Review a pull request</p>
              </div>
            </button>
          </div>

          {!isFirstVisit && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-text-secondary mb-3">Try Sample Code</h3>
              <div className="space-y-2">
                {Object.entries(SAMPLE_FILES).map(([filename, meta]) => (
                  <button
                    key={filename}
                    onClick={() => handleTrySample(filename)}
                    disabled={loadingSample !== null}
                    className="w-full text-left px-3 py-2 bg-bg-secondary border border-border-primary rounded-md hover:border-accent/30 transition-colors text-xs disabled:opacity-50"
                  >
                    <span className="font-mono text-text-primary">{filename}</span>
                    <span className="text-text-secondary ml-2">{meta.description.slice(0, 40)}...</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }) {
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className="text-accent">{icon}</div>
        <div>
          <p className="text-[11px] text-text-secondary uppercase tracking-wide">{label}</p>
          <p className="text-lg font-semibold text-text-primary mt-0.5">{value}</p>
        </div>
      </div>
    </div>
  )
}

function ReviewIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
}
function FindingsIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
}
function CategoryIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
}
function TrendIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
}

export default Dashboard
