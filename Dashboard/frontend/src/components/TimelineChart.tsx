import {
  CartesianGrid,
  ComposedChart,
  Dot,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DaySummary } from '../types'

type TimelineChartProps = {
  timeline: DaySummary[]
}

export function TimelineChart({ timeline }: TimelineChartProps) {
  const anomalies = timeline.filter((row) => row.is_anomaly)

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={timeline}>
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} minTickGap={24} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f1117', border: '1px solid #334155', borderRadius: '10px' }}
            labelStyle={{ color: '#cbd5e1' }}
          />

          {/* Mark anomaly dates with subtle red vertical regions. */}
          {anomalies.map((row) => (
            <ReferenceArea key={`zone-${row.date}`} x1={row.date} x2={row.date} fill="#ef4444" fillOpacity={0.14} strokeOpacity={0} />
          ))}

          <Line
            type="monotone"
            dataKey="consumption_mean"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={<Dot r={1.5} strokeWidth={1} />}
            name="Consumption Mean"
          />
          <Scatter data={anomalies} dataKey="consumption_mean" fill="#ef4444" name="Anomalous Day" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
