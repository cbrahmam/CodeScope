import { Link, useLocation } from 'react-router-dom'

function Header() {
  const location = useLocation()

  return (
    <header className="bg-bg-secondary border-b border-border-primary sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-accent">
            <path
              d="M9.5 2L4 7.5V16.5L9.5 22H14.5L20 16.5V7.5L14.5 2H9.5Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-lg font-semibold text-text-primary">
            Code<span className="text-accent">Scope</span>
          </span>
        </Link>

        <nav className="flex items-center gap-4">
          {location.pathname !== '/' && (
            <Link
              to="/"
              className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-bg-primary font-medium text-sm rounded-md transition-colors"
            >
              New Review
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}

export default Header
