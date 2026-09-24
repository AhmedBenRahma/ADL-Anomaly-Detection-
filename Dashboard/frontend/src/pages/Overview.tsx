import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { KPICard } from '../components/KPICard'
import { TimelineChart } from '../components/TimelineChart'
import { getHouseSummary } from '../services/api'
import type { HouseSummary } from '../types'

type OverviewProps = {
  selectedHouse: number
}

export default function Overview({ selectedHouse }: OverviewProps) {
  const [summary, setSummary] = useState<HouseSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getHouseSummary(selectedHouse)
      .then(setSummary)
      .finally(() => setLoading(false))
  }, [selectedHouse])

  const monthlyData = useMemo(() => {
    const map = new Map<string, number>()
    ;(summary?.timeline ?? []).forEach((day) => {
      if (!day.is_anomaly) return
      const month = day.date.slice(0, 7)
      map.set(month, (map.get(month) ?? 0) + 1)
    })

    return Array.from(map.entries()).map(([month, anomalies]) => ({ month, anomalies }))
  }, [summary])

  if (loading || !summary) {
    return <div className="text-slate-300">Loading overview...</div>
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KPICard label="Total Days" value={summary.total_days} variant="blue" />
        <KPICard label="Normal Days" value={summary.normal_days} variant="green" />
        <KPICard label="Anomalous Days" value={summary.anomalous_days} variant="red" />
        <KPICard label="Anomaly Rate" value={`${summary.anomaly_rate.toFixed(2)}%`} variant="orange" />
      </section>

      <section className="rounded-xl border border-app-border bg-app-card p-4">
        <h2 className="mb-3 text-base font-semibold text-slate-100">Daily Consumption Timeline</h2>
        <TimelineChart timeline={summary.timeline} />
      </section>

      <section className="rounded-xl border border-app-border bg-app-card p-4">
        <h2 className="mb-3 text-base font-semibold text-slate-100">Monthly Anomaly Count</h2>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fill: '#94a3b8' }} />
              <YAxis tick={{ fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f1117', border: '1px solid #334155', borderRadius: '10px' }} />
              <Bar dataKey="anomalies" fill="#f97316" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}
