import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, Trophy, Phone, GitBranch, ChevronDown, Bot, Snowflake } from 'lucide-react'
import { useDealer } from '@/context/DealerContext'
import { useDashboard } from '@/api/dashboard'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/calls', label: 'Calls', icon: Phone },
  { to: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { to: '/analyst', label: 'Agent', icon: Bot },
]

export default function Layout() {
  const { dealerId, setDealerId } = useDealer()
  const { data } = useDashboard(null)
  const dealers = data?.dealers ?? []

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="flex flex-col w-60 min-h-screen bg-[#1e293b] text-slate-300 shrink-0">
        <div className="px-6 py-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <Snowflake className="text-white" size={18} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-none">BDC</p>
              <p className="text-slate-400 text-xs mt-0.5">BDC Coaching</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-slate-700">
          <p className="text-slate-500 text-xs">Powered by Snowflake</p>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top header */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <h1 className="text-slate-800 font-semibold text-base">Agent Coaching Dashboard</h1>

          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-500">Dealer:</label>
            <div className="relative">
              <select
                value={dealerId ?? ''}
                onChange={(e) => setDealerId(e.target.value || null)}
                className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">All Dealers</option>
                {dealers.map((d) => (
                  <option key={d.dealer_id} value={d.dealer_id}>
                    {d.dealer_name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
