import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import Topics from './pages/Topics'
import Practice from './pages/Practice'
import Review from './pages/Review'
import Stats from './pages/Stats'
import Search from './pages/Search'
import Settings from './pages/Settings'
import AIGenerate from './pages/AIGenerate'
import Documents from './pages/Documents'
import MockInterview from './pages/MockInterview'
import MockSession from './pages/MockSession'
import MockReview from './pages/MockReview'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/topics" element={<Topics />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/review" element={<Review />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/search" element={<Search />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/ai-generate" element={<AIGenerate />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/mock-interview" element={<MockInterview />} />
          <Route path="/mock-interview/session" element={<MockSession />} />
          <Route path="/mock-interview/review" element={<MockReview />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
