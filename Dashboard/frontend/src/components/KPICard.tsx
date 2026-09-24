import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

type Variant = 'blue' | 'green' | 'red' | 'orange'

type KPICardProps = {
  label: string
  value: string | number
  variant: Variant
  trend?: number
}

const variantClasses: Record<Variant, string> = {
  blue: 'border-blue-500/60',
  green: 'border-emerald-500/60',
  red: 'border-rose-500/60',
  orange: 'border-orange-500/60',
}

export function KPICard({ label, value, variant, trend }: KPICardProps) {
  const hasTrend = typeof trend === 'number'
  const trendUp = (trend ?? 0) >= 0

  return (
    <article className={`rounded-xl border bg-app-card p-4 shadow-soft ${variantClasses[variant]}`}>
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <h3 className="text-2xl font-semibold text-slate-100">{value}</h3>
        {hasTrend && (
          <span className={`inline-flex items-center gap-1 text-xs ${trendUp ? 'text-emerald-300' : 'text-rose-300'}`}>
            {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(trend ?? 0).toFixed(1)}%
          </span>
        )}
      </div>
    </article>
  )
}
