import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import useReviewStore from '../store/reviewStore'
import { getLanguageInfo } from '../utils/languageDetect'

function ReviewDashboard() {
  const { id } = useParams()
  const { currentReview, fetchReview, isLoading } = useReviewStore()
  const [files, setFiles] = useState([])

  useEffect(() => {
    fetchReview(id)
  }, [id, fetchReview])

  useEffect(() => {
    if (currentReview?.files) {
      try {
        setFiles(JSON.parse(currentReview.files))
      } catch {
        setFiles([])
      }
    }
  }, [currentReview])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-text-secondary">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Loading review...</span>
        </div>
      </div>
    )
  }

  if (!currentReview) {
    return (
      <div className="text-center py-20">
        <p className="text-text-secondary">Review not found</p>
        <Link to="/" className="text-accent text-sm mt-2 inline-block hover:underline">
          Start a new review
        </Link>
      </div>
    )
  }

  const langInfo = getLanguageInfo(currentReview.language)

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{currentReview.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`px-2 py-0.5 text-xs rounded font-medium text-white ${langInfo.color}`}>
              {langInfo.label}
            </span>
            <span className="text-xs text-text-secondary">
              {files.length} {files.length === 1 ? 'file' : 'files'}
            </span>
            <span className="text-xs text-text-secondary">
              {new Date(currentReview.created_at).toLocaleDateString()}
            </span>
            <span className={`px-2 py-0.5 text-xs rounded font-medium ${
              currentReview.status === 'reviewed' ? 'bg-accent/20 text-accent' :
              currentReview.status === 'analyzing' ? 'bg-severity-medium/20 text-severity-medium' :
              'bg-bg-tertiary text-text-secondary'
            }`}>
              {currentReview.status}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-bg-secondary border border-border-primary rounded-lg p-8 text-center">
        <svg className="w-12 h-12 mx-auto mb-3 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p className="text-text-secondary">AI analysis dashboard coming in Block 3</p>
        <p className="text-text-secondary text-sm mt-1">
          The code has been submitted. Analysis engine will be built in Block 2.
        </p>
      </div>

      {files.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-medium text-text-secondary mb-3">Submitted Files</h2>
          <div className="space-y-1">
            {files.map((file, i) => {
              const fLang = getLanguageInfo(file.language)
              return (
                <div key={i} className="flex items-center gap-3 px-3 py-2 bg-bg-secondary rounded border border-border-primary">
                  <span className="font-mono text-sm text-text-primary">{file.filename}</span>
                  <span className={`px-1.5 py-0.5 text-xs rounded font-medium text-white ${fLang.color}`}>
                    {fLang.label}
                  </span>
                  <span className="text-xs text-text-secondary ml-auto">
                    {file.content.split('\n').length} lines
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default ReviewDashboard
