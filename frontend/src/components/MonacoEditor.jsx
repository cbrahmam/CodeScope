import Editor from '@monaco-editor/react'

function MonacoEditorWrapper({ value, onChange, language = 'plaintext', readOnly = false, height = '400px' }) {
  const handleMount = (editor) => {
    editor.updateOptions({ fontFamily: '"JetBrains Mono", monospace' })
  }

  return (
    <div className="border border-border-primary rounded-md overflow-hidden">
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={onChange}
        theme="vs-dark"
        onMount={handleMount}
        loading={
          <div className="flex items-center justify-center bg-bg-secondary" style={{ height }}>
            <div className="flex items-center gap-3 text-text-secondary">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Loading editor...</span>
            </div>
          </div>
        }
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 12 },
          renderLineHighlight: 'gutter',
          cursorBlinking: 'smooth',
        }}
      />
    </div>
  )
}

export default MonacoEditorWrapper
