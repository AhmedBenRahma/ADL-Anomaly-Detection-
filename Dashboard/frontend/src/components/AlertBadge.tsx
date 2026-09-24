import type { AnomalyAlert } from '../types'

type AlertBadgeProps = {
  severity: AnomalyAlert['severity']
}

const severityStyle: Record<AnomalyAlert['severity'], string> = {
  critical: 'border-rose-500/60 bg-rose-500/20 text-rose-200',
  high: 'border-orange-500/60 bg-orange-500/20 text-orange-200',
  moderate: 'border-yellow-500/60 bg-yellow-500/20 text-yellow-200',
}

export function AlertBadge({ severity }: AlertBadgeProps) {
  const label = severity.charAt(0).toUpperCase() + severity.slice(1)

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${severityStyle[severity]}`}>{label}</span>
}
