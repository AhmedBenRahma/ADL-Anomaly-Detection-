import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import { HeatmapRow } from '../components/HeatmapRow'
import { getDayDetail, getHouseSummary } from '../services/api'
import type { DayDetail as DayDetailType, DaySummary } from '../types'

type DayDetailProps = {
  selectedHouse: number
}

function minuteLabel(minute: number): string {
  const hour = Math.floor(minute / 60)
  const min = minute % 60
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export default function DayDetail({ selectedHouse }: DayDetailProps) {
  const [searchParams] = useSearchParams()
  const [days, setDays] = useState<DaySummary[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [detail, setDetail] = useState<DayDetailType | null>(null)

  useEffect(() => {
    getHouseSummary(selectedHouse).then((summary) => {
      setDays(summary.timeline)
      const fromQuery = searchParams.get('date')
      setSelectedDate(fromQuery || summary.timeline.at(-1)?.date || '')
    })
  }, [searchParams, selectedHouse])

  useEffect(() => {
    if (!selectedDate) return
    getDayDetail(selectedHouse, selectedDate).then(setDetail)
  }, [selectedDate, selectedHouse])

  const signalData = useMemo(() => {
    if (!detail) return []
    const rows: Array<{ time: string; original: number; reconstructed: number }> = []

    // Render every 5th minute to keep line chart readable and responsive.
    for (let i = 0; i < 1440; i += 5) {
      rows.push({
        time: minuteLabel(i),
        original: detail.original_signal[i] ?? 0,
        reconstructed: detail.reconstructed_signal[i] ?? 0,
      })
    }

    return rows
  }, [detail])

  const windowRows = useMemo(() => {
    if (!detail) return []
    return detail.window_scores.map((window) => ({
      ...window,
      label: `${minuteLabel(window.start_minute)}-${minuteLabel(window.end_minute)}`,
      color: window.is_anomaly ? '#ef4444' : '#3b82f6',
    }))
  }, [detail])

  const summaryText = useMemo(() => {
    if (!detail) return 'Loading anomaly summary...'
    const anomalous = detail.window_scores.filter((window) => window.is_anomaly)
    if (anomalous.length === 0) {
      return 'No anomaly interval detected for this day.'
    }

    const start = anomalous[0].start_minute
    const end = anomalous[anomalous.length - 1].end_minute
    return `Anomaly detected between ${minuteLabel(start)} and ${minuteLabel(end)}`
  }, [detail])

  if (!detail) {
    return <div className="text-slate-300">Loading day details...</div>
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-app-border bg-app-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Day Diagnostics</h2>
            <p className="text-sm text-slate-400">Investigate signal reconstruction and error patterns.</p>
          </div>
          <select
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="rounded-lg border border-slate-700 bg-app-bg px-3 py-2 text-sm text-slate-100"
          >
            {days.map((day) => (
              <option key={day.date} value={day.date}>
                {day.date}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-xl border border-app-border bg-app-card p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Score vs Threshold</p>
        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-end md:gap-8">
          <h3 className="text-4xl font-semibold text-cyan-300">{detail.score.toFixed(4)}</h3>
          <p className="text-slate-300">Threshold: {detail.threshold.toFixed(4)}</p>
          <p className={`text-sm font-medium ${detail.is_anomaly ? 'text-rose-300' : 'text-emerald-300'}`}>
            {detail.is_anomaly ? 'Anomalous Day' : 'Normal Day'}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-app-border bg-app-card p-4">
        <h2 className="mb-3 text-base font-semibold text-slate-100">Original vs Reconstructed Signal (24h)</h2>
        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={signalData}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} minTickGap={28} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f1117', border: '1px solid #334155', borderRadius: '10px' }} />
              <Legend />
              <Line type="monotone" dataKey="original" stroke="#22d3ee" dot={false} strokeWidth={1.8} />
              <Line type="monotone" dataKey="reconstructed" stroke="#a78bfa" dot={false} strokeWidth={1.8} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-app-border bg-app-card p-4">
        <h2 className="mb-3 text-base font-semibold text-slate-100">Window MSE (30-minute)</h2>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={windowRows}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} minTickGap={35} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f1117', border: '1px solid #334155', borderRadius: '10px' }} />
              <Bar dataKey="score" radius={[5, 5, 0, 0]}>
                {windowRows.map((window) => (
                  <Cell key={window.label} fill={window.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-app-border bg-app-card p-4">
        <h2 className="mb-3 text-base font-semibold text-slate-100">Hourly Error Heatmap</h2>
        <HeatmapRow values={detail.hourly_errors} />
      </section>

      <p className="text-sm text-slate-300">{summaryText}</p>
    </div>
  )
}
