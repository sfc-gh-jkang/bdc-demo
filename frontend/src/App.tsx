import { Routes, Route } from 'react-router-dom'
import { DealerProvider } from '@/context/DealerContext'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Leaderboard from '@/pages/Leaderboard'
import Calls from '@/pages/Calls'
import CallDetail from '@/pages/CallDetail'
import AgentDetail from '@/pages/AgentDetail'
import Pipeline from '@/pages/Pipeline'
import Analyst from '@/pages/Analyst'

export default function App() {
  return (
    <DealerProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/agents/:id" element={<AgentDetail />} />
          <Route path="/calls" element={<Calls />} />
          <Route path="/calls/:id" element={<CallDetail />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/analyst" element={<Analyst />} />
        </Route>
      </Routes>
    </DealerProvider>
  )
}
