import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MonacoEditor from './MonacoEditor'
import FileUpload from './FileUpload'
import useReviewStore from '../store/reviewStore'
import { detectLanguage, getMonacoLanguage, getLanguageInfo } from '../utils/languageDetect'

const SUPPORTED_LANGUAGES = [
  'auto-detect', 'python', 'javascript', 'typescript', 'jsx', 'tsx',
  'go', 'rust', 'java', 'ruby', 'cpp', 'c', 'sql', 'html', 'css',
]

function CodeInput() {
  const navigate = useNavigate()
  const { createReview, isLoading, error } = useReviewStore()

  const [activeTab, setActiveTab] = useState('paste')
  const [code, setCode] = useState('')
  const [filename, setFilename] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('auto-detect')
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [previewFile, setPreviewFile] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const detectedLanguage = selectedLanguage === 'auto-detect'
    ? detectLanguage(filename, code)
    : selectedLanguage

  const monacoLanguage = getMonacoLanguage(detectedLanguage)
  const langInfo = getLanguageInfo(detectedLanguage)

  const canSubmit = activeTab === 'paste' ? code.trim().length > 0 : uploadedFiles.length > 0

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit && !isLoading) {
        e.preventDefault()
        handleSubmit()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const handleSubmit = async () => {
    const files = activeTab === 'paste'
      ? [{ filename: filename || 'untitled', content: code, language: selectedLanguage === 'auto-detect' ? null : selectedLanguage }]
      : uploadedFiles.map((f) => ({ filename: f.filename, content: f.content, language: f.language }))

    const now = new Date()
    const autoTitle = filename
      ? `Review: ${filename}`
      : `Code Review - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`

    try {
      const review = await createReview({
        title: title || autoTitle,
        description,
        files,
      })
      navigate(`/review/${review.id}`)
    } catch {
      // error is already set in the store
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">New Code Review</h1>
        <p className="text-text-secondary mt-1">Paste code or upload files for AI-powered analysis</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-primary mb-4">
        {[
          { id: 'paste', label: 'Paste Code' },
          { id: 'upload', label: 'Upload Files' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Paste Code Tab */}
      {activeTab === 'paste' && (
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-text-secondary mb-1">Filename (optional)</label>
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="e.g., main.py"
                className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-md text-text-primary text-sm font-mono placeholder:text-text-secondary/50 focus:outline-none focus:border-accent"
              />
            </div>
            <div className="w-48">
              <label className="block text-sm text-text-secondary mb-1">Language</label>
              <div className="relative">
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-md text-text-primary text-sm appearance-none focus:outline-none focus:border-accent"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang === 'auto-detect' ? 'Auto-Detect' : getLanguageInfo(lang).label}
                    </option>
                  ))}
                </select>
                <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {code && selectedLanguage === 'auto-detect' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">Detected:</span>
              <span className={`px-1.5 py-0.5 text-xs rounded font-medium text-white ${langInfo.color}`}>
                {langInfo.label}
              </span>
            </div>
          )}

          <MonacoEditor
            value={code}
            onChange={(val) => setCode(val || '')}
            language={monacoLanguage}
            height="450px"
          />
        </div>
      )}

      {/* Upload Files Tab */}
      {activeTab === 'upload' && (
        <div className="space-y-4">
          <FileUpload files={uploadedFiles} onFilesChange={setUploadedFiles} />

          {previewFile && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-secondary font-mono">{previewFile.filename}</span>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="text-xs text-text-secondary hover:text-text-primary"
                >
                  Close preview
                </button>
              </div>
              <MonacoEditor
                value={previewFile.content}
                language={getMonacoLanguage(previewFile.language)}
                readOnly
                height="300px"
              />
            </div>
          )}

          {uploadedFiles.length > 0 && !previewFile && (
            <p className="text-xs text-text-secondary">Click a file above to preview</p>
          )}

          {/* Make file items clickable for preview */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-1">
              {uploadedFiles.map((file) => (
                <button
                  key={file.filename}
                  onClick={() => setPreviewFile(file)}
                  className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                    previewFile?.filename === file.filename
                      ? 'bg-accent/10 text-accent'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                  }`}
                >
                  Preview {file.filename}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Review Metadata */}
      <div className="mt-6 space-y-4 pt-6 border-t border-border-primary">
        <div>
          <label className="block text-sm text-text-secondary mb-1">Review Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={filename ? `Review: ${filename}` : `Code Review - ${new Date().toLocaleDateString()}`}
            className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-md text-text-primary text-sm placeholder:text-text-secondary/50 focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this code does or what you'd like reviewed..."
            rows={2}
            className="w-full px-3 py-2 bg-bg-secondary border border-border-primary rounded-md text-text-primary text-sm placeholder:text-text-secondary/50 focus:outline-none focus:border-accent resize-none"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 px-4 py-3 bg-severity-critical/10 border border-severity-critical/30 rounded-md">
          <p className="text-sm text-severity-high">{error}</p>
        </div>
      )}

      {/* Submit */}
      <div className="mt-6">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || isLoading}
          className={`w-full py-3 rounded-md font-medium text-sm transition-colors ${
            canSubmit && !isLoading
              ? 'bg-accent hover:bg-accent-hover text-bg-primary cursor-pointer'
              : 'bg-bg-tertiary text-text-secondary cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating Review...
            </span>
          ) : (
            'Start Review'
          )}
        </button>
      </div>
    </div>
  )
}

export default CodeInput
