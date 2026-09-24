type HeatmapRowProps = {
  values: number[]
}

function getHeatColor(value: number, max: number): string {
  if (max <= 0) return '#16a34a'

  const ratio = Math.min(1, value / max)
  if (ratio <= 0.5) {
    const t = ratio / 0.5
    const r = Math.round(34 + (234 - 34) * t)
    const g = Math.round(197 + (179 - 197) * t)
    const b = Math.round(94 + (8 - 94) * t)
    return `rgb(${r}, ${g}, ${b})`
  }

  const t = (ratio - 0.5) / 0.5
  const r = Math.round(234 + (239 - 234) * t)
  const g = Math.round(179 + (68 - 179) * t)
  const b = Math.round(8 + (68 - 8) * t)
  return `rgb(${r}, ${g}, ${b})`
}

export function HeatmapRow({ values }: HeatmapRowProps) {
  const max = Math.max(...values, 0)

  return (
    <div className="grid grid-cols-6 gap-2 md:grid-cols-12">
      {values.map((value, hour) => (
        <div
          key={`hour-${hour}`}
          title={`${String(hour).padStart(2, '0')}:00 error ${value.toFixed(4)}`}
          className="rounded-md px-2 py-2 text-center text-xs font-semibold text-slate-100"
          style={{ backgroundColor: getHeatColor(value, max) }}
        >
          {String(hour).padStart(2, '0')}
        </div>
      ))}
    </div>
  )
}
