import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getStats } from '../services/api'
import type { HouseStats } from '../types'

type StatisticsProps = {
  selectedHouse: number
}

function buildHistogram(values: number[], bins = 12): Array<{ bin: string; count: number }> {
  if (values.length === 0) return []

  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max === min) {
    return [{ bin: min.toFixed(3), count: values.length }]
  }

  const width = (max - min) / bins
  const counts = new Array<number>(bins).fill(0)

  values.forEach((value) => {
    const index = Math.min(bins - 1, Math.floor((value - min) / width))
    counts[index] += 1
  })

  return counts.map((count, index) => ({
    bin: (min + width * index).toFixed(3),
    count,
  }))
}

export default function Statistics({ selectedHouse }: StatisticsProps) {
  const [stats, setStats] = useState<HouseStats | null>(null)

  useEffect(() => {
    getStats(selectedHouse).then(setStats)
  }, [selectedHouse])

  const scoreDistribution = useMemo(() => {
    if (!stats) return []

    const normal = buildHistogram(stats.score_distribution.normal)
    const anomaly = buildHistogram(stats.score_distribution.anomalous)
    const length = Math.max(normal.length, anomaly.length)

    return Array.from({ length }).map((_, index) => ({
      bin: normal[index]?.bin ?? anomaly[index]?.bin ?? String(index),
      normal: normal[index]?.count ?? 0,
      anomalous: anomaly[index]?.count ?? 0,
    }))
  }, [stats])

  if (!stats) {
    return <div className="text-slate-300">Loading statistics...</div>
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <section className="h-[340px] rounded-xl border border-app-border bg-app-card p-4">
        <h2 className="mb-2 text-base font-semibold text-slate-100">Anomalies by Weekday</h2>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={stats.by_weekday}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip contentStyle={{ backgroundColor: '#0f1117', border: '1px solid #334155', borderRadius: '10px' }} />
            <Legend />
            <Bar dataKey="normal_count" fill="#22c55e" />
            <Bar dataKey="anomaly_count" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="h-[340px] rounded-xl border border-app-border bg-app-card p-4">
        <h2 className="mb-2 text-base font-semibold text-slate-100">Anomalies by Season</h2>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={stats.by_season}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis dataKey="season" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip contentStyle={{ backgroundColor: '#0f1117', border: '1px solid #334155', borderRadius: '10px' }} />
            <Legend />
            <Bar dataKey="normal_count" fill="#3b82f6" />
            <Bar dataKey="anomaly_count" fill="#f97316" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="h-[340px] rounded-xl border border-app-border bg-app-card p-4">
        <h2 className="mb-2 text-base font-semibold text-slate-100">Score Distribution</h2>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={scoreDistribution}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis dataKey="bin" tick={{ fill: '#94a3b8', fontSize: 11 }} minTickGap={20} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip contentStyle={{ backgroundColor: '#0f1117', border: '1px solid #334155', borderRadius: '10px' }} />
            <Legend />
            <Bar dataKey="normal" fill="#38bdf8" />
            <Bar dataKey="anomalous" fill="#fb7185" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="h-[340px] rounded-xl border border-app-border bg-app-card p-4">
        <h2 className="mb-2 text-base font-semibold text-slate-100">Top 10 Anomalous Days</h2>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={stats.top10_anomalies} layout="vertical">
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis dataKey="date" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={88} />
            <Tooltip contentStyle={{ backgroundColor: '#0f1117', border: '1px solid #334155', borderRadius: '10px' }} />
            <Bar dataKey="score" fill="#ef4444" radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  )
}
