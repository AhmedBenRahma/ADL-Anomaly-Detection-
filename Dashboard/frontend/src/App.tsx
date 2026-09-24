import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import AlertHistory from './pages/AlertHistory'
import Comparison from './pages/Comparison'
import DayDetail from './pages/DayDetail'
import Overview from './pages/Overview'
import Statistics from './pages/Statistics'
import { getHouses } from './services/api'
import type { HouseMeta } from './types'

export default function App() {
  const [houses, setHouses] = useState<HouseMeta[]>([])
  const [selectedHouse, setSelectedHouse] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getHouses()
      .then((data) => {
        setHouses(data)
        if (data.length > 0) {
          setSelectedHouse(data[0].house_id)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="min-h-screen bg-app-bg p-8 text-slate-200">Loading dashboard...</div>
  }

  return (
    <div className="min-h-screen bg-app-bg text-slate-100 lg:flex">
      <Sidebar houses={houses} selectedHouse={selectedHouse} onSelectHouse={setSelectedHouse} />

      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <Routes>
          <Route path="/" element={<Overview selectedHouse={selectedHouse} />} />
          <Route path="/alerts" element={<AlertHistory selectedHouse={selectedHouse} />} />
          <Route path="/day-detail" element={<DayDetail selectedHouse={selectedHouse} />} />
          <Route path="/statistics" element={<Statistics selectedHouse={selectedHouse} />} />
          <Route path="/comparison" element={<Comparison />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
