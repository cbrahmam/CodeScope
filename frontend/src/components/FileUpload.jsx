import { useState, useRef } from 'react'
import { detectLanguage, getLanguageInfo } from '../utils/languageDetect'

const MAX_FILES = 10
const MAX_FILE_SIZE = 500 * 1024

const ACCEPTED_EXTENSIONS = '.py,.js,.ts,.jsx,.tsx,.go,.rs,.java,.rb,.cpp,.cc,.c,.h,.hpp,.sql,.html,.htm,.css,.json,.yaml,.yml,.sh,.bash,.md'

function FileUpload({ files, onFilesChange }) {
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const processFiles = async (fileList) => {
    setError(null)
    const newFiles = [...files]

    for (const file of fileList) {
      if (newFiles.length >= MAX_FILES) {
        setError(`Maximum ${MAX_FILES} files allowed`)
        break
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" exceeds 500KB limit`)
        continue
      }

      const content = await file.text()
      const language = detectLanguage(file.name, content)
      const lineCount = content.split('\n').length

      if (newFiles.some((f) => f.filename === file.name)) {
        setError(`"${file.name}" already added`)
        continue
      }

      newFiles.push({
        filename: file.name,
        content,
        language,
        lineCount,
        size: file.size,
      })
    }

    onFilesChange(newFiles)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    processFiles(e.dataTransfer.files)
  }

  const handleFileSelect = (e) => {
    processFiles(e.target.files)
    e.target.value = ''
  }

  const removeFile = (filename) => {
    onFilesChange(files.filter((f) => f.filename !== filename))
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return (
    <div>
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-accent bg-accent/5' : 'border-border-primary hover:border-text-secondary'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileSelect}
          className="hidden"
        />
        <svg className="w-10 h-10 mx-auto mb-3 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-text-secondary text-sm">
          Drop files here or <span className="text-accent">click to browse</span>
        </p>
        <p className="text-text-secondary text-xs mt-1">
          Max {MAX_FILES} files, {MAX_FILE_SIZE / 1024}KB each
        </p>
      </div>

      {error && (
        <p className="mt-2 text-sm text-severity-high">{error}</p>
      )}

      {files.length > 0 && (
        <div className="mt-4 space-y-1">
          {files.map((file) => {
            const langInfo = getLanguageInfo(file.language)
            return (
              <div
                key={file.filename}
                className="flex items-center justify-between px-3 py-2 bg-bg-secondary rounded-md border border-border-primary"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-sm text-text-primary truncate">{file.filename}</span>
                  <span className={`px-1.5 py-0.5 text-xs rounded font-medium text-white ${langInfo.color}`}>
                    {langInfo.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 ml-3 shrink-0">
                  <span className="text-xs text-text-secondary">{file.lineCount} lines</span>
                  <span className="text-xs text-text-secondary">{formatSize(file.size)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(file.filename) }}
                    className="text-text-secondary hover:text-severity-high transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
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

export default FileUpload
