import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertBadge } from '../components/AlertBadge'
import { getAnomalies } from '../services/api'
import type { AnomalyAlert, AnomalyFilters } from '../types'

type AlertHistoryProps = {
  selectedHouse: number
}

const PAGE_SIZE = 20

export default function AlertHistory({ selectedHouse }: AlertHistoryProps) {
  const navigate = useNavigate()

  const [filters, setFilters] = useState<AnomalyFilters>({})
  const [rows, setRows] = useState<AnomalyAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setLoading(true)
    getAnomalies(selectedHouse, filters)
      .then((data) => {
        setRows(data)
        setPage(1)
      })
      .finally(() => setLoading(false))
  }, [selectedHouse, filters])

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return rows.slice(start, start + PAGE_SIZE)
  }, [page, rows])

  const exportCsv = () => {
    const header = ['date', 'score', 'threshold', 'excess_pct', 'severity', 'day_of_week', 'season']
    const body = rows.map((r) => [r.date, r.score, r.threshold, r.excess_pct, r.severity, r.day_of_week, r.season].join(','))
    const csv = [header.join(','), ...body].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `alerts_house_${selectedHouse}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-3 rounded-xl border border-app-border bg-app-card p-4 md:grid-cols-2 xl:grid-cols-5">
        <input
          type="date"
          className="rounded-lg border border-slate-700 bg-app-bg px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-cyan-500"
          onChange={(event) => setFilters((prev) => ({ ...prev, start_date: event.target.value || undefined }))}
        />
        <input
          type="date"
          className="rounded-lg border border-slate-700 bg-app-bg px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-cyan-500"
          onChange={(event) => setFilters((prev) => ({ ...prev, end_date: event.target.value || undefined }))}
        />
        <select
          className="rounded-lg border border-slate-700 bg-app-bg px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-cyan-500"
          onChange={(event) =>
            setFilters((prev) => ({
              ...prev,
              severity: (event.target.value || undefined) as AnomalyFilters['severity'],
            }))
          }
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="moderate">Moderate</option>
        </select>
        <select
          className="rounded-lg border border-slate-700 bg-app-bg px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-cyan-500"
          onChange={(event) => setFilters((prev) => ({ ...prev, season: event.target.value || undefined }))}
        >
          <option value="">All seasons</option>
          <option value="winter">Winter</option>
          <option value="spring">Spring</option>
          <option value="summer">Summer</option>
          <option value="autumn">Autumn</option>
        </select>
        <select
          className="rounded-lg border border-slate-700 bg-app-bg px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-cyan-500"
          onChange={(event) => setFilters((prev) => ({ ...prev, day_of_week: event.target.value || undefined }))}
        >
          <option value="">All weekdays</option>
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((weekday) => (
            <option key={weekday} value={weekday}>
              {weekday}
            </option>
          ))}
        </select>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-lg border border-cyan-500/60 bg-cyan-900/40 px-3 py-2 text-sm text-cyan-200 transition hover:bg-cyan-900/60"
        >
          Export CSV
        </button>
      </div>

      <section className="overflow-x-auto rounded-xl border border-app-border bg-app-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-900/60 text-slate-300">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Score</th>
              <th className="px-4 py-3 text-left">Threshold</th>
              <th className="px-4 py-3 text-left">Excess %</th>
              <th className="px-4 py-3 text-left">Severity</th>
              <th className="px-4 py-3 text-left">Day of Week</th>
              <th className="px-4 py-3 text-left">Season</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && pageRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-4 text-slate-400">
                  No anomaly alerts for current filters.
                </td>
              </tr>
            )}
            {pageRows.map((row) => (
              <tr
                key={row.date}
                className="cursor-pointer border-t border-slate-800 text-slate-100 transition hover:bg-slate-800/40"
                onClick={() => navigate(`/day-detail?date=${row.date}`)}
              >
                <td className="px-4 py-3">{row.date}</td>
                <td className="px-4 py-3">{row.score.toFixed(4)}</td>
                <td className="px-4 py-3">{row.threshold.toFixed(4)}</td>
                <td className="px-4 py-3">{row.excess_pct.toFixed(2)}%</td>
                <td className="px-4 py-3">
                  <AlertBadge severity={row.severity} />
                </td>
                <td className="px-4 py-3">{row.day_of_week}</td>
                <td className="px-4 py-3">{row.season}</td>
                <td className="px-4 py-3 text-cyan-300">View</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="flex items-center justify-between text-sm text-slate-300">
        <p>
          Page {page} of {pageCount}
        </p>
        <div className="space-x-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
            className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </footer>
    </div>
  )
}
