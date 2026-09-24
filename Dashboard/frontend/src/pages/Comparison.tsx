import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getComparison } from '../services/api'
import type { ComparisonRow } from '../types'

export default function Comparison() {
  const [rows, setRows] = useState<ComparisonRow[]>([])

  useEffect(() => {
    getComparison().then(setRows)
  }, [])

  const radarRows = useMemo(() => {
    if (rows.length === 0) return []

    const maxRate = Math.max(...rows.map((row) => row.anomaly_rate), 1)
    const maxScore = Math.max(...rows.map((row) => row.mean_score), 1)

    return rows.map((row) => ({
      house: `House ${row.house_id}`,
      anomalyRate: (row.anomaly_rate / maxRate) * 100,
      meanScore: (row.mean_score / maxScore) * 100,
    }))
  }, [rows])

  return (
    <div className="space-y-4">
      <section className="overflow-x-auto rounded-xl border border-app-border bg-app-card">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-slate-900/60 text-slate-300">
            <tr>
              <th className="px-4 py-3 text-left">House</th>
              <th className="px-4 py-3 text-left">Total Days</th>
              <th className="px-4 py-3 text-left">Anomalous Days</th>
              <th className="px-4 py-3 text-left">Anomaly Rate</th>
              <th className="px-4 py-3 text-left">Mean Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.house_id} className="border-t border-slate-800 text-slate-100">
                <td className="px-4 py-3">House {row.house_id}</td>
                <td className="px-4 py-3">{row.total_days}</td>
                <td className="px-4 py-3">{row.anomalous_days}</td>
                <td className="px-4 py-3">{row.anomaly_rate.toFixed(2)}%</td>
                <td className="px-4 py-3">{row.mean_score.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="h-[340px] rounded-xl border border-app-border bg-app-card p-4">
          <h2 className="mb-2 text-base font-semibold text-slate-100">Anomaly Rate per House</h2>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={rows} layout="vertical">
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fill: '#94a3b8' }} />
              <YAxis dataKey="house_id" type="category" tick={{ fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f1117', border: '1px solid #334155', borderRadius: '10px' }} />
              <Bar dataKey="anomaly_rate" fill="#f97316" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="h-[340px] rounded-xl border border-app-border bg-app-card p-4">
          <h2 className="mb-2 text-base font-semibold text-slate-100">Radar Multi-Metric Comparison</h2>
          <ResponsiveContainer width="100%" height="90%">
            <RadarChart data={radarRows} outerRadius={105}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="house" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Radar dataKey="anomalyRate" stroke="#ef4444" fill="#ef4444" fillOpacity={0.25} name="Anomaly Rate (norm)" />
              <Radar dataKey="meanScore" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.25} name="Mean Score (norm)" />
              <Tooltip contentStyle={{ backgroundColor: '#0f1117', border: '1px solid #334155', borderRadius: '10px' }} />
            </RadarChart>
          </ResponsiveContainer>
        </section>
      </div>
    </div>
  )
}
