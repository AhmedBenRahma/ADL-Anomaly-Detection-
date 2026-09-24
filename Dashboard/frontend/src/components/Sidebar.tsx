import { Bell, BarChart3, Calendar, GitCompare, LayoutDashboard } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import type { HouseMeta } from '../types'

type SidebarProps = {
  houses: HouseMeta[]
  selectedHouse: number
  onSelectHouse: (id: number) => void
}

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/day-detail', label: 'Day Detail', icon: Calendar },
  { to: '/statistics', label: 'Statistics', icon: BarChart3 },
  { to: '/comparison', label: 'Comparison', icon: GitCompare },
]

export function Sidebar({ houses, selectedHouse, onSelectHouse }: SidebarProps) {
  return (
    <aside className="w-full lg:w-72 bg-app-card border-r border-app-border p-4 lg:p-6 lg:min-h-screen">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">REFIT Monitoring</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-100">Anomaly Dashboard</h1>
        <p className="mt-1 text-sm text-app-muted">Elderly behavior signal intelligence</p>
      </div>

      <div className="mb-6">
        <label className="mb-2 block text-xs uppercase tracking-wide text-slate-400">House Selector</label>
        <select
          value={selectedHouse}
          onChange={(event) => onSelectHouse(Number(event.target.value))}
          className="w-full rounded-lg border border-slate-700 bg-app-bg px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500 transition focus:ring-2"
        >
          {houses.map((house) => (
            <option key={house.house_id} value={house.house_id}>
              {house.name}
            </option>
          ))}
        </select>
      </div>

      <nav className="space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                  isActive
                    ? 'border-cyan-700 bg-cyan-900/30 text-cyan-200'
                    : 'border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/60 hover:text-slate-100'
                }`
              }
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
