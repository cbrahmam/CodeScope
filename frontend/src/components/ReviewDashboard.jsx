import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import useReviewStore from '../store/reviewStore'
import * as api from '../api/client'
import { getLanguageInfo, getMonacoLanguage } from '../utils/languageDetect'
import FindingCard from './FindingCard'
import DiffView from './DiffView'
import ScoreGauge, { calculateScore } from './ScoreGauge'
import Toast from './Toast'
import CollaboratorBar from './CollaboratorBar'
import CommentThread from './CommentThread'
import useSocket from '../hooks/useSocket'
import useKeyboardShortcuts, { SHORTCUTS } from '../hooks/useKeyboardShortcuts'

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }

function ReviewDashboard() {
  const { id } = useParams()
  const {
    currentReview, findings, complexity, isLoading, isAnalyzing,
    fetchReview, analyzeReview, fetchComplexity,
    updateFindingStatus, applyFix, showToast,
  } = useReviewStore()

  const [files, setFiles] = useState([])
  const [activeFileIdx, setActiveFileIdx] = useState(0)
  const [selectedFinding, setSelectedFinding] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [diffFinding, setDiffFinding] = useState(null)
  const [activeTab, setActiveTab] = useState('findings')
  const [filterSeverity, setFilterSeverity] = useState(null)
  const [filterCategory, setFilterCategory] = useState(null)
  const [filterStatus, setFilterStatus] = useState(null)
  const [sortBy, setSortBy] = useState('severity')
  const [summary, setSummary] = useState(null)
  const [summaryCollapsed, setSummaryCollapsed] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const editorRef = useRef(null)
  const decorationsRef = useRef([])

  const {
    onlineUsers, comments, activity, userName,
    sendComment, emitFindingStatus, emitFixApplied, fetchComments,
  } = useSocket(id)

  useEffect(() => { fetchReview(id) }, [id, fetchReview])

  useEffect(() => {
    if (currentReview?.files) {
      try { setFiles(JSON.parse(currentReview.files)) } catch { setFiles([]) }
    }
  }, [currentReview])

  useEffect(() => {
    if (currentReview?.status === 'reviewed' && findings.length > 0 && !summary) {
      setSummaryLoading(true)
      api.getReviewSummary(id).then((data) => {
        setSummary(data.summary)
        setSummaryLoading(false)
      }).catch(() => setSummaryLoading(false))
    }
  }, [currentReview?.status, findings.length, id])

  const activeFile = files[activeFileIdx]

  const fileFindings = findings.filter((f) => {
    if (activeFile && f.file_name !== activeFile.filename) return false
    if (filterSeverity && f.severity !== filterSeverity) return false
    if (filterCategory && f.category !== filterCategory) return false
    if (filterStatus && f.status !== filterStatus) return false
    return true
  })

  const sortedFindings = [...fileFindings].sort((a, b) => {
    if (sortBy === 'severity') return (SEVERITY_ORDER[a.severity] ?? 5) - (SEVERITY_ORDER[b.severity] ?? 5)
    if (sortBy === 'line') return a.line_start - b.line_start
    return a.category.localeCompare(b.category)
  })

  const allFileFindings = findings.filter((f) => activeFile && f.file_name === activeFile.filename)

  const score = calculateScore(findings)

  const severityCounts = findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1
    return acc
  }, {})

  const categoryCounts = findings.reduce((acc, f) => {
    acc[f.category] = (acc[f.category] || 0) + 1
    return acc
  }, {})

  const handleEditorMount = useCallback((editor) => {
    editorRef.current = editor
  }, [])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !allFileFindings.length) return

    const model = editor.getModel()
    if (!model) return

    const decorations = allFileFindings.map((f) => {
      const severity = f.severity
      let className = 'finding-line-info'
      let glyphClass = 'finding-glyph-info'
      if (severity === 'critical' || severity === 'high') {
        className = 'finding-line-error'
        glyphClass = 'finding-glyph-error'
      } else if (severity === 'medium') {
        className = 'finding-line-warning'
        glyphClass = 'finding-glyph-warning'
      }

      return {
        range: {
          startLineNumber: f.line_start,
          startColumn: 1,
          endLineNumber: f.line_end,
          endColumn: model.getLineMaxColumn(Math.min(f.line_end, model.getLineCount())),
        },
        options: {
          isWholeLine: true,
          className,
          glyphMarginClassName: glyphClass,
          glyphMarginHoverMessage: { value: `**${f.severity.toUpperCase()}**: ${f.title}` },
        },
      }
    })

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations)
  }, [allFileFindings, activeFileIdx])

  const scrollToLine = (line) => {
    editorRef.current?.revealLineInCenter(line)
    editorRef.current?.setPosition({ lineNumber: line, column: 1 })
  }

  const handleScrollToLine = (line, fileName) => {
    if (fileName && activeFile?.filename !== fileName) {
      const idx = files.findIndex((f) => f.filename === fileName)
      if (idx !== -1) setActiveFileIdx(idx)
    }
    setTimeout(() => scrollToLine(line), 100)
  }

  const handleViewFix = (finding) => {
    setDiffFinding({
      ...finding,
      _monacoLanguage: activeFile ? getMonacoLanguage(activeFile.language) : 'plaintext',
    })
  }

  const handleApplyFix = async (findingId) => {
    try {
      const result = await applyFix(id, findingId)
      setDiffFinding(null)
      emitFixApplied(findingId, result.file_name, result.new_content)
      showToast(`Fix applied to ${result.file_name}`, 'success')
    } catch { /* handled in store */ }
  }

  const handleAccept = (findingId) => {
    updateFindingStatus(id, findingId, 'accepted')
    emitFindingStatus(findingId, 'accepted')
  }
  const handleDismiss = (findingId) => {
    updateFindingStatus(id, findingId, 'dismissed')
    emitFindingStatus(findingId, 'dismissed')
  }

  const handleAnalyze = async () => {
    try {
      await analyzeReview(id)
      showToast('Analysis complete!', 'success')
    } catch { /* handled in store */ }
  }

  useEffect(() => {
    if (currentReview?.status === 'reviewed') fetchComplexity(id)
  }, [currentReview?.status, id, fetchComplexity])

  const handleSelectIndex = useCallback((idx) => {
    setSelectedIndex(idx)
    const f = sortedFindings[idx]
    if (f) {
      setSelectedFinding(f)
      scrollToLine(f.line_start)
    }
  }, [sortedFindings])

  const { showHelp, setShowHelp } = useKeyboardShortcuts({
    findings: sortedFindings,
    selectedIndex,
    onSelectIndex: handleSelectIndex,
    onAccept: handleAccept,
    onDismiss: handleDismiss,
    onApplyFix: handleViewFix,
    onClose: () => setDiffFinding(null),
    enabled: activeTab === 'findings' && !isLoading,
  })

  if (isLoading) {
    return (
      <div className="max-w-[1600px] mx-auto animate-fade-in">
        <div className="flex items-center gap-4 mb-4">
          <div className="skeleton w-16 h-16 rounded-full" />
          <div>
            <div className="skeleton w-48 h-5 mb-2" />
            <div className="skeleton w-32 h-3" />
          </div>
        </div>
        <div className="flex gap-4" style={{ minHeight: '500px' }}>
          <div className="flex-[3] skeleton rounded-md" style={{ height: 600 }} />
          <div className="flex-[2] space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton rounded-md" style={{ height: 80 }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!currentReview) {
    return (
      <div className="text-center py-20">
        <p className="text-text-secondary">Review not found</p>
        <Link to="/" className="text-accent text-sm mt-2 inline-block hover:underline">Start a new review</Link>
      </div>
    )
  }

  const langInfo = getLanguageInfo(currentReview.language)
  const monacoLang = activeFile ? getMonacoLanguage(activeFile.language) : 'plaintext'

  return (
    <div className="max-w-[1600px] mx-auto animate-fade-in">
      <Toast />

      {/* Keyboard shortcuts help */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowHelp(false)}>
          <div className="bg-bg-secondary border border-border-primary rounded-lg p-6 w-80 animate-slide-down" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Keyboard Shortcuts</h3>
            <div className="space-y-2">
              {SHORTCUTS.map((s) => (
                <div key={s.key} className="flex items-center justify-between">
                  <span className="text-xs text-text-secondary">{s.description}</span>
                  <span className="kbd">{s.label}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-text-secondary mt-4 text-center">Press <span className="kbd">?</span> to toggle</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          {currentReview.status === 'reviewed' && <ScoreGauge score={score} size={64} />}
          <div>
            <h1 className="text-xl font-semibold text-text-primary">{currentReview.title}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className={`px-2 py-0.5 text-xs rounded font-medium text-white ${langInfo.color}`}>{langInfo.label}</span>
              <span className="text-xs text-text-secondary">{files.length} {files.length === 1 ? 'file' : 'files'}</span>
              <span className="text-xs text-text-secondary">{new Date(currentReview.created_at).toLocaleDateString()}</span>
              <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                currentReview.status === 'reviewed' ? 'bg-accent/20 text-accent' :
                currentReview.status === 'analyzing' ? 'bg-severity-medium/20 text-severity-medium' :
                'bg-bg-tertiary text-text-secondary'
              }`}>{currentReview.status}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CollaboratorBar onlineUsers={onlineUsers} activity={activity} />
          {currentReview.status === 'reviewed' && (
            <>
              <button
                onClick={() => setShowHelp(true)}
                className="px-2 py-1.5 text-xs bg-bg-tertiary border border-border-primary text-text-secondary hover:text-text-primary rounded-md transition-colors"
                title="Keyboard shortcuts"
              >
                <span className="kbd">?</span>
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(window.location.href); showToast('Link copied!', 'success') }}
                className="px-3 py-1.5 text-xs bg-bg-tertiary border border-border-primary text-text-secondary hover:text-text-primary rounded-md transition-colors"
                title="Copy shareable link"
              >
                Share
              </button>
              <div className="relative group">
                <button className="px-3 py-1.5 text-xs bg-bg-tertiary border border-border-primary text-text-secondary hover:text-text-primary rounded-md transition-colors">
                  Export
                </button>
                <div className="absolute right-0 top-8 w-48 bg-bg-secondary border border-border-primary rounded-lg shadow-xl z-50 hidden group-hover:block overflow-hidden">
                  <button
                    onClick={async () => {
                      const result = await api.exportReview(id, 'markdown')
                      navigator.clipboard.writeText(result.content)
                      showToast('Markdown copied!', 'success')
                    }}
                    className="w-full px-3 py-2 text-xs text-left text-text-primary hover:bg-bg-tertiary transition-colors"
                  >
                    Copy as Markdown
                  </button>
                  <button
                    onClick={async () => {
                      const result = await api.exportReview(id, 'github')
                      navigator.clipboard.writeText(result.content)
                      showToast('GitHub comment copied!', 'success')
                    }}
                    className="w-full px-3 py-2 text-xs text-left text-text-primary hover:bg-bg-tertiary transition-colors"
                  >
                    Copy as GitHub Comment
                  </button>
                </div>
              </div>
            </>
          )}
          {currentReview.status === 'pending' && (
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-bg-primary font-medium text-sm rounded-md transition-colors disabled:opacity-50"
            >
              {isAnalyzing ? 'Analyzing...' : 'Run AI Analysis'}
            </button>
          )}
        </div>
      </div>

      {/* AI Summary Panel */}
      {currentReview.status === 'reviewed' && (summary || summaryLoading) && (
        <div className="mb-4 bg-bg-secondary border border-border-primary rounded-lg overflow-hidden animate-slide-down">
          <button
            onClick={() => setSummaryCollapsed(!summaryCollapsed)}
            className="w-full flex items-center justify-between px-4 py-2 hover:bg-bg-tertiary/50 transition-colors"
          >
            <span className="text-xs font-medium text-text-secondary">AI Summary</span>
            <svg className={`w-3.5 h-3.5 text-text-secondary transition-transform ${summaryCollapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {!summaryCollapsed && (
            <div className="px-4 pb-3">
              {summaryLoading ? (
                <div className="space-y-2">
                  <div className="skeleton w-full h-3" />
                  <div className="skeleton w-3/4 h-3" />
                </div>
              ) : (
                <p className="text-sm text-text-primary leading-relaxed">{summary}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Analyzing state */}
      {isAnalyzing && (
        <div className="bg-bg-secondary border border-border-primary rounded-lg p-8 text-center mb-4">
          <svg className="animate-spin h-8 w-8 mx-auto mb-3 text-accent" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-text-primary font-medium">AI is analyzing your code...</p>
          <p className="text-text-secondary text-sm mt-1">This may take 15-30 seconds</p>
        </div>
      )}

      {/* Summary bar */}
      {findings.length > 0 && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {['critical', 'high', 'medium', 'low', 'info'].map((sev) =>
            severityCounts[sev] ? (
              <button
                key={sev}
                onClick={() => setFilterSeverity(filterSeverity === sev ? null : sev)}
                className={`px-2 py-1 text-xs rounded font-medium transition-colors status-transition ${
                  filterSeverity === sev ? 'ring-1 ring-white/30' : ''
                } ${
                  sev === 'critical' ? 'bg-severity-critical/20 text-severity-critical' :
                  sev === 'high' ? 'bg-severity-high/20 text-severity-high' :
                  sev === 'medium' ? 'bg-severity-medium/20 text-severity-medium' :
                  sev === 'low' ? 'bg-severity-low/20 text-severity-low' :
                  'bg-severity-info/20 text-severity-info'
                }`}
              >
                {severityCounts[sev]} {sev}
              </button>
            ) : null
          )}
          <div className="h-4 w-px bg-border-primary" />
          {Object.entries(categoryCounts).map(([cat, count]) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
              className={`px-2 py-0.5 text-[11px] rounded bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors ${
                filterCategory === cat ? 'ring-1 ring-accent text-accent' : ''
              }`}
            >
              {count} {cat.replace('_', ' ')}
            </button>
          ))}
          {(filterSeverity || filterCategory || filterStatus) && (
            <button
              onClick={() => { setFilterSeverity(null); setFilterCategory(null); setFilterStatus(null) }}
              className="text-[11px] text-text-secondary hover:text-accent"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Tabs for findings/complexity */}
      {currentReview.status === 'reviewed' && (
        <div className="flex border-b border-border-primary mb-4">
          {[
            { id: 'findings', label: `Findings (${findings.length})` },
            { id: 'complexity', label: 'Complexity' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Diff view overlay */}
      {diffFinding && (
        <div className="mb-4 animate-slide-down">
          <DiffView
            finding={diffFinding}
            onApplyFix={handleApplyFix}
            onClose={() => setDiffFinding(null)}
          />
        </div>
      )}

      {/* Main content */}
      {activeTab === 'findings' ? (
        <div className="flex gap-4" style={{ minHeight: '500px' }}>
          {/* Left panel: Code view */}
          <div className="flex-[3] min-w-0">
            {/* File tabs */}
            {files.length > 1 && (
              <div className="flex gap-0.5 mb-2 overflow-x-auto pb-1">
                {files.map((file, idx) => {
                  const fl = getLanguageInfo(file.language)
                  const fileCount = findings.filter((f) => f.file_name === file.filename).length
                  return (
                    <button
                      key={idx}
                      onClick={() => { setActiveFileIdx(idx); decorationsRef.current = [] }}
                      className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono rounded-t transition-colors shrink-0 ${
                        idx === activeFileIdx
                          ? 'bg-bg-secondary text-text-primary border border-border-primary border-b-0'
                          : 'text-text-secondary hover:text-text-primary bg-bg-tertiary'
                      }`}
                    >
                      {file.filename}
                      {fileCount > 0 && (
                        <span className="px-1 py-0.5 text-[10px] rounded bg-severity-medium/20 text-severity-medium">
                          {fileCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="border border-border-primary rounded-md overflow-hidden">
              <Editor
                height="600px"
                language={monacoLang}
                value={activeFile?.content || ''}
                theme="vs-dark"
                onMount={handleEditorMount}
                loading={
                  <div className="flex items-center justify-center h-[600px] bg-bg-secondary">
                    <div className="flex items-center gap-3 text-text-secondary">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="text-sm">Loading editor...</span>
                    </div>
                  </div>
                }
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: '"JetBrains Mono", monospace',
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  glyphMargin: true,
                  padding: { top: 8 },
                  renderLineHighlight: 'gutter',
                }}
              />
            </div>
          </div>

          {/* Right panel: Findings list */}
          <div className="flex-[2] min-w-[300px] max-w-[500px]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-text-secondary">
                {sortedFindings.length} finding{sortedFindings.length !== 1 ? 's' : ''}
                {activeFile ? ` in ${activeFile.filename}` : ''}
              </h3>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-[11px] bg-bg-tertiary border border-border-primary rounded px-1.5 py-0.5 text-text-secondary"
              >
                <option value="severity">Sort by severity</option>
                <option value="line">Sort by line</option>
                <option value="category">Sort by category</option>
              </select>
            </div>

            <div className="flex gap-1 mb-2">
              {['open', 'accepted', 'dismissed', 'resolved'].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(filterStatus === s ? null : s)}
                  className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                    filterStatus === s ? 'bg-accent/20 text-accent' : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '580px' }}>
              {sortedFindings.length === 0 ? (
                <div className="text-center py-8 text-text-secondary text-sm">
                  {findings.length === 0 ? 'No findings yet. Run AI analysis to get started.' : 'No findings match the current filters.'}
                </div>
              ) : (
                sortedFindings.map((finding, idx) => (
                  <div key={finding.id} className="finding-card">
                    <FindingCard
                      finding={finding}
                      isActive={selectedFinding?.id === finding.id}
                      onSelect={(f) => { setSelectedFinding(f); setSelectedIndex(idx); scrollToLine(f.line_start) }}
                      onViewFix={handleViewFix}
                      onAccept={handleAccept}
                      onDismiss={handleDismiss}
                      onScrollToLine={handleScrollToLine}
                    />
                    {selectedFinding?.id === finding.id && (
                      <CommentThread
                        reviewId={id}
                        findingId={finding.id}
                        comments={comments}
                        onSend={sendComment}
                        fetchComments={fetchComments}
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <ComplexityView complexity={complexity} files={files} onScrollToLine={handleScrollToLine} />
      )}
    </div>
  )
}


function ComplexityView({ complexity, files, onScrollToLine }) {
  if (!complexity || !complexity.reports) {
    return <div className="text-center py-8 text-text-secondary text-sm">No complexity data available.</div>
  }

  return (
    <div className="space-y-6">
      {complexity.reports.map((report) => (
        <div key={report.file_name} className="bg-bg-secondary border border-border-primary rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-text-primary">{report.file_name}</span>
              <span className="text-xs text-text-secondary">{report.total_functions} functions</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-text-secondary">Avg Complexity</div>
                <div className="text-sm font-medium text-text-primary">{report.average_complexity}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-text-secondary">Maintainability</div>
                <div className={`text-sm font-medium ${
                  report.maintainability_score > 70 ? 'text-accent' :
                  report.maintainability_score >= 40 ? 'text-severity-medium' :
                  'text-severity-critical'
                }`}>
                  {report.maintainability_score}
                </div>
              </div>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-primary text-text-secondary text-xs">
                <th className="text-left px-4 py-2 font-medium">Function</th>
                <th className="text-center px-2 py-2 font-medium">Complexity</th>
                <th className="text-center px-2 py-2 font-medium">Nesting</th>
                <th className="text-center px-2 py-2 font-medium">LOC</th>
                <th className="text-center px-2 py-2 font-medium">Params</th>
                <th className="text-center px-2 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {report.all_functions.map((fn) => (
                <tr
                  key={`${fn.name}-${fn.line_start}`}
                  className={`border-b border-border-primary/50 cursor-pointer hover:bg-bg-tertiary/50 ${
                    fn.is_flagged ? 'bg-severity-medium/5' : ''
                  }`}
                  onClick={() => onScrollToLine(fn.line_start, report.file_name)}
                >
                  <td className="px-4 py-2">
                    <span className="font-mono text-text-primary">{fn.name}</span>
                    <span className="text-text-secondary text-xs ml-2">L{fn.line_start}</span>
                  </td>
                  <td className={`text-center px-2 py-2 font-mono ${fn.cyclomatic_complexity > 10 ? 'text-severity-critical font-bold' : 'text-text-primary'}`}>
                    {fn.cyclomatic_complexity}
                  </td>
                  <td className={`text-center px-2 py-2 font-mono ${fn.max_nesting_depth > 4 ? 'text-severity-medium font-bold' : 'text-text-primary'}`}>
                    {fn.max_nesting_depth}
                  </td>
                  <td className={`text-center px-2 py-2 font-mono ${fn.lines_of_code > 50 ? 'text-severity-medium font-bold' : 'text-text-primary'}`}>
                    {fn.lines_of_code}
                  </td>
                  <td className={`text-center px-2 py-2 font-mono ${fn.parameter_count > 5 ? 'text-severity-medium font-bold' : 'text-text-primary'}`}>
                    {fn.parameter_count}
                  </td>
                  <td className="text-center px-2 py-2">
                    {fn.is_flagged ? (
                      <span className="px-1.5 py-0.5 text-[10px] bg-severity-medium/20 text-severity-medium rounded font-medium">flagged</span>
                    ) : (
                      <span className="px-1.5 py-0.5 text-[10px] bg-accent/20 text-accent rounded font-medium">ok</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {report.flagged_functions.length > 0 && (
            <div className="px-4 py-2 border-t border-border-primary">
              <p className="text-xs text-text-secondary">
                {report.flagged_functions.length} function{report.flagged_functions.length !== 1 ? 's' : ''} flagged —{' '}
                {report.flagged_functions.map((f) => f.flag_reasons.join(', ')).join('; ')}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default ReviewDashboard
