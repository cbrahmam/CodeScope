function ScoreGauge({ score, size = 80 }) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const filled = (score / 100) * circumference
  const color = score > 70 ? '#3FB950' : score >= 40 ? '#F59E0B' : '#DC2626'

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#21262D"
          strokeWidth="4"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - filled}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-lg font-bold" style={{ color }}>{score}</span>
    </div>
  )
}

export function calculateScore(findings) {
  const weights = { critical: -20, high: -10, medium: -5, low: -2, info: 0 }
  let score = 100
  for (const f of findings) {
    if (f.status !== 'dismissed' && f.status !== 'resolved') {
      score += weights[f.severity] || 0
    }
  }
  return Math.max(0, Math.min(100, score))
}

export default ScoreGauge
