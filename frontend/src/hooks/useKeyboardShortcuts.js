import { useEffect, useState, useCallback } from 'react'

const SHORTCUTS = [
  { key: 'j', label: 'J', description: 'Next finding' },
  { key: 'k', label: 'K', description: 'Previous finding' },
  { key: 'a', label: 'A', description: 'Accept finding' },
  { key: 'd', label: 'D', description: 'Dismiss finding' },
  { key: 'f', label: 'F', description: 'Apply fix' },
  { key: 'c', label: 'C', description: 'Open comment' },
  { key: 'Escape', label: 'Esc', description: 'Close panel' },
  { key: '?', label: '?', description: 'Toggle shortcuts help' },
]

export { SHORTCUTS }

export default function useKeyboardShortcuts({
  findings = [],
  selectedIndex = 0,
  onSelectIndex,
  onAccept,
  onDismiss,
  onApplyFix,
  onOpenComment,
  onClose,
  enabled = true,
}) {
  const [showHelp, setShowHelp] = useState(false)

  const handler = useCallback((e) => {
    if (!enabled) return
    const tag = e.target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return

    const finding = findings[selectedIndex]

    switch (e.key) {
      case 'j':
        if (findings.length > 0) onSelectIndex?.(Math.min(selectedIndex + 1, findings.length - 1))
        break
      case 'k':
        if (findings.length > 0) onSelectIndex?.(Math.max(selectedIndex - 1, 0))
        break
      case 'a':
        if (finding) onAccept?.(finding.id)
        break
      case 'd':
        if (finding) onDismiss?.(finding.id)
        break
      case 'f':
        if (finding) onApplyFix?.(finding)
        break
      case 'c':
        if (finding) onOpenComment?.(finding.id)
        break
      case 'Escape':
        onClose?.()
        setShowHelp(false)
        break
      case '?':
        setShowHelp((v) => !v)
        break
      default:
        return
    }
    e.preventDefault()
  }, [enabled, findings, selectedIndex, onSelectIndex, onAccept, onDismiss, onApplyFix, onOpenComment, onClose])

  useEffect(() => {
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handler])

  return { showHelp, setShowHelp }
}
