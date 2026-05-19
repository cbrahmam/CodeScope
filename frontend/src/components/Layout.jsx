import { Outlet } from 'react-router-dom'
import Header from './Header'

function Layout() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Header />

      <div className="lg:hidden flex items-center justify-center min-h-[60vh] px-6">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-text-secondary/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <h2 className="text-lg font-semibold text-text-primary mb-2">Use Desktop for Code Review</h2>
          <p className="text-sm text-text-secondary">CodeScope requires a wider screen for the code editor and findings panel.</p>
        </div>
      </div>

      <main className="hidden lg:block max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
