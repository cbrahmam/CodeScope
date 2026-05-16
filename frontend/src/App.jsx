import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import CodeInput from './components/CodeInput'
import ReviewDashboard from './components/ReviewDashboard'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<CodeInput />} />
          <Route path="/review/:id" element={<ReviewDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
