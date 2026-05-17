import { useState } from 'react'

const SEVERITY_COLORS = {
  critical: 'border-severity-critical bg-severity-critical/5',
  high: 'border-severity-high bg-severity-high/5',
  medium: 'border-severity-medium bg-severity-medium/5',
  low: 'border-severity-low bg-severity-low/5',
  info: 'border-severity-info bg-severity-info/5',
}

const SEVERITY_BADGE = {
  critical: 'bg-severity-critical',
  high: 'bg-severity-high',
  medium: 'bg-severity-medium text-bg-primary',
  low: 'bg-severity-low',
  info: 'bg-severity-info',
}

const CATEGORY_ICONS = {
  security: '🔒',
  performance: '⚡',
  bug_risk: '🐛',
  code_quality: '📐',
  style: '🎨',
  architecture: '🏗️',
}

function FindingCard({ finding, isActive, onSelect, onViewFix, onAccept, onDismiss, onScrollToLine }) {
  const [expanded, setExpanded] = useState(false)

  const severityColor = SEVERITY_COLORS[finding.severity] || SEVERITY_COLORS.info
  const badgeColor = SEVERITY_BADGE[finding.severity] || SEVERITY_BADGE.info
  const icon = CATEGORY_ICONS[finding.category] || '📋'

  return (
    <div
      className={`border-l-[3px] rounded-md bg-bg-secondary cursor-pointer transition-all ${severityColor} ${
        isActive ? 'ring-1 ring-accent' : ''
      }`}
      onClick={() => onSelect(finding)}
    >
      <div className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded text-white shrink-0 ${badgeColor}`}>
              {finding.severity}
            </span>
            <span className="text-xs text-text-secondary shrink-0">{icon} {finding.category.replace('_', ' ')}</span>
          </div>
          {finding.confidence && (
            <span className="text-[10px] text-text-secondary shrink-0">
              {finding.confidence === 'high' ? '●●●' : finding.confidence === 'medium' ? '●●○' : '●○○'}
            </span>
          )}
        </div>

        <h4 className="text-sm font-medium text-text-primary mt-1.5 leading-snug">{finding.title}</h4>

        <button
          onClick={(e) => { e.stopPropagation(); onScrollToLine(finding.line_start, finding.file_name) }}
          className="text-xs text-accent hover:underline mt-1 font-mono"
        >
          {finding.file_name}:{finding.line_start}-{finding.line_end}
        </button>

        <p className={`text-xs text-text-secondary mt-1.5 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
          {finding.description}
        </p>
        {finding.description?.length > 120 && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
            className="text-[11px] text-accent hover:underline mt-0.5"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}

        <div className="flex items-center gap-2 mt-2">
          <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
            finding.status === 'resolved' ? 'bg-accent/20 text-accent' :
            finding.status === 'accepted' ? 'bg-blue-500/20 text-blue-400' :
            finding.status === 'dismissed' ? 'bg-bg-tertiary text-text-secondary' :
            'bg-severity-medium/20 text-severity-medium'
          }`}>
            {finding.status}
          </span>

          {finding.status === 'open' && (
            <div className="flex gap-1 ml-auto">
              {finding.suggested_fix && (
                <button
                  onClick={(e) => { e.stopPropagation(); onViewFix(finding) }}
                  className="px-2 py-0.5 text-[11px] bg-accent/10 text-accent rounded hover:bg-accent/20 transition-colors"
                >
                  View Fix
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onAccept(finding.id) }}
                className="px-2 py-0.5 text-[11px] bg-bg-tertiary text-text-secondary rounded hover:text-text-primary transition-colors"
              >
                Accept
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDismiss(finding.id) }}
                className="px-2 py-0.5 text-[11px] bg-bg-tertiary text-text-secondary rounded hover:text-text-primary transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FindingCard
