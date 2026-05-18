import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../api/client'
import useReviewStore from '../store/reviewStore'

function GitHubImport() {
  const navigate = useNavigate()
  const showToast = useReviewStore((s) => s.showToast)
  const [repo, setRepo] = useState('')
  const [prNumber, setPrNumber] = useState('')
  const [token, setToken] = useState(() => localStorage.getItem('codescope_github_token') || '')
  const [showToken, setShowToken] = useState(false)
  const [prInfo, setPrInfo] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleFetchInfo = async () => {
    if (!repo || !prNumber) return
    setLoading(true)
    setError(null)
    setPrInfo(null)
    try {
      const info = await api.getPRInfo(repo, parseInt(prNumber), token || undefined)
      setPrInfo(info)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch PR info')
    }
    setLoading(false)
  }

  const handleImport = async () => {
    if (!repo || !prNumber) return
    setLoading(true)
    setError(null)
    try {
      if (token) localStorage.setItem('codescope_github_token', token)
      const result = await api.importPR({
        repo,
        pr_number: parseInt(prNumber),
        token: token || undefined,
      })
      setImportResult(result)
      showToast(`Imported PR #${prNumber} with ${result.files_count} files`, 'success')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to import PR')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-text-primary mb-6">Import GitHub PR</h2>

      <div className="bg-bg-secondary border border-border-primary rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1">Repository</label>
          <input
            type="text"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="owner/repo or https://github.com/owner/repo"
            className="w-full px-3 py-2 text-sm bg-bg-primary border border-border-primary rounded-md text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1">PR Number</label>
          <input
            type="number"
            value={prNumber}
            onChange={(e) => setPrNumber(e.target.value)}
            placeholder="42"
            className="w-full px-3 py-2 text-sm bg-bg-primary border border-border-primary rounded-md text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1">
            GitHub Token <span className="text-text-secondary/50">(optional, stored locally)</span>
          </label>
          <div className="flex gap-2">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              className="flex-1 px-3 py-2 text-sm bg-bg-primary border border-border-primary rounded-md text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent font-mono"
            />
            <button
              onClick={() => setShowToken(!showToken)}
              className="px-3 py-2 text-xs bg-bg-tertiary border border-border-primary rounded-md text-text-secondary hover:text-text-primary"
            >
              {showToken ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error && (
          <div className="px-3 py-2 text-sm text-severity-critical bg-severity-critical/10 border border-severity-critical/20 rounded">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleFetchInfo}
            disabled={loading || !repo || !prNumber}
            className="px-4 py-2 text-sm bg-bg-tertiary border border-border-primary text-text-primary rounded-md hover:bg-bg-primary transition-colors disabled:opacity-40"
          >
            {loading && !prInfo ? 'Fetching...' : 'Preview PR'}
          </button>
          <button
            onClick={handleImport}
            disabled={loading || !repo || !prNumber}
            className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-bg-primary font-medium rounded-md transition-colors disabled:opacity-40"
          >
            {loading && prInfo ? 'Importing...' : 'Import & Review'}
          </button>
        </div>
      </div>

      {prInfo && !importResult && (
        <div className="mt-6 bg-bg-secondary border border-border-primary rounded-lg p-5">
          <h3 className="text-sm font-medium text-text-primary mb-3">PR Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-text-secondary">Title:</span>
              <span className="text-text-primary font-medium">{prInfo.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-secondary">Author:</span>
              <span className="text-text-primary">{prInfo.author}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-secondary">Branch:</span>
              <code className="px-1.5 py-0.5 text-xs bg-bg-tertiary rounded text-accent font-mono">
                {prInfo.branch}
              </code>
              <span className="text-text-secondary">→</span>
              <code className="px-1.5 py-0.5 text-xs bg-bg-tertiary rounded text-text-primary font-mono">
                {prInfo.base_branch}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-secondary">State:</span>
              <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${
                prInfo.state === 'open'
                  ? 'bg-severity-low/20 text-severity-low'
                  : prInfo.state === 'merged'
                    ? 'bg-accent/20 text-accent'
                    : 'bg-severity-critical/20 text-severity-critical'
              }`}>
                {prInfo.state}
              </span>
            </div>
            {prInfo.description && (
              <div className="mt-2 pt-2 border-t border-border-primary">
                <span className="text-text-secondary block mb-1">Description:</span>
                <p className="text-text-primary text-xs leading-relaxed whitespace-pre-wrap">
                  {prInfo.description.slice(0, 500)}
                  {prInfo.description.length > 500 ? '...' : ''}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {importResult && (
        <div className="mt-6 bg-bg-secondary border border-accent/30 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <h3 className="text-sm font-medium text-text-primary">PR Imported Successfully</h3>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-text-secondary">
              <span className="text-text-primary font-medium">{importResult.title}</span>
            </p>
            <p className="text-text-secondary">
              {importResult.files_count} files · {importResult.languages.join(', ')}
            </p>
          </div>
          <button
            onClick={() => navigate(`/review/${importResult.review_id}`)}
            className="mt-4 px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-bg-primary font-medium rounded-md transition-colors"
          >
            Review This PR
          </button>
        </div>
      )}
    </div>
  )
}

export default GitHubImport
