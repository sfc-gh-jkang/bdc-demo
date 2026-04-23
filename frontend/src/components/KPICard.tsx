import { type LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KPICardProps {
  icon: LucideIcon
  label: string
  value: string | number
  trend?: number // percentage change, positive = up
  iconColor?: string
}

function formatValue(value: string | number): string {
  if (typeof value === 'number') {
    if (Math.abs(value) >= 1000) {
      return value.toLocaleString()
    }
    return String(value)
  }
  return value
}

export default function KPICard({ icon: Icon, label, value, trend, iconColor = 'text-blue-500' }: KPICardProps) {
  const trendUp = trend !== undefined && trend > 0
  const trendDown = trend !== undefined && trend < 0
  const trendNeutral = trend !== undefined && trend === 0

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-5"
      style={{ boxShadow: 'var(--card-shadow)' }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-500 text-sm font-medium">{label}</p>
          <p className="text-slate-900 text-2xl font-bold mt-1">{formatValue(value)}</p>
        </div>
        <div className={`p-2.5 rounded-lg bg-slate-100 ${iconColor}`}>
          <Icon size={20} />
        </div>
      </div>

      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1">
          {trendUp && (
            <>
              <TrendingUp size={14} className="text-emerald-500" />
              <span className="text-emerald-600 text-xs font-medium">+{trend.toFixed(1)}%</span>
            </>
          )}
          {trendDown && (
            <>
              <TrendingDown size={14} className="text-red-500" />
              <span className="text-red-600 text-xs font-medium">{trend.toFixed(1)}%</span>
            </>
          )}
          {trendNeutral && (
            <>
              <Minus size={14} className="text-slate-400" />
              <span className="text-slate-500 text-xs font-medium">0%</span>
            </>
          )}
          <span className="text-slate-400 text-xs ml-0.5">vs last period</span>
        </div>
      )}
    </div>
  )
}
