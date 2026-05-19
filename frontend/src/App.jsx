import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import CodeInput from './components/CodeInput'
import ReviewDashboard from './components/ReviewDashboard'
import ReviewList from './components/ReviewList'
import GitHubImport from './components/GitHubImport'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new" element={<CodeInput />} />
            <Route path="/review/:id" element={<ReviewDashboard />} />
            <Route path="/reviews" element={<ReviewList />} />
            <Route path="/github" element={<GitHubImport />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
