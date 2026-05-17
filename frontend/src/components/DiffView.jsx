import { useState } from 'react'
import { DiffEditor } from '@monaco-editor/react'

function DiffView({ finding, onApplyFix, onClose }) {
  const [viewMode, setViewMode] = useState('side-by-side')

  if (!finding) return null

  return (
    <div className="bg-bg-secondary border border-border-primary rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-primary bg-bg-tertiary">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-text-primary">Suggested Fix</h3>
          <span className="text-xs text-text-secondary font-mono">
            {finding.file_name}:{finding.line_start}-{finding.line_end}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded overflow-hidden border border-border-primary">
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`px-2 py-0.5 text-[11px] transition-colors ${
                viewMode === 'side-by-side' ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Side by Side
            </button>
            <button
              onClick={() => setViewMode('inline')}
              className={`px-2 py-0.5 text-[11px] transition-colors ${
                viewMode === 'inline' ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Inline
            </button>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {finding.suggestion && (
        <div className="px-4 py-2 border-b border-border-primary">
          <p className="text-xs text-text-secondary">{finding.suggestion}</p>
        </div>
      )}

      <DiffEditor
        height="300px"
        original={finding.original_code || ''}
        modified={finding.suggested_fix || ''}
        language={finding._monacoLanguage || 'plaintext'}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: '"JetBrains Mono", monospace',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          renderSideBySide: viewMode === 'side-by-side',
          padding: { top: 8 },
        }}
      />

      <div className="flex items-center gap-2 px-4 py-2 border-t border-border-primary">
        <button
          onClick={() => onApplyFix(finding.id)}
          className="px-3 py-1.5 text-sm bg-accent hover:bg-accent-hover text-bg-primary rounded font-medium transition-colors"
        >
          Apply Fix
        </button>
        <button
          onClick={() => {
            navigator.clipboard.writeText(finding.suggested_fix || '')
          }}
          className="px-3 py-1.5 text-sm bg-bg-tertiary text-text-secondary hover:text-text-primary rounded transition-colors"
        >
          Copy Fix
        </button>
        {finding.references?.length > 0 && (
          <div className="ml-auto flex gap-2">
            {finding.references.map((ref, i) => (
              <a
                key={i}
                href={ref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-accent hover:underline"
              >
                Reference {i + 1}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DiffView
