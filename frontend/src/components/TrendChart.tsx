import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

interface LineConfig {
  dataKey: string
  color: string
  label?: string
}

interface TrendChartProps {
  data: object[]
  lines: LineConfig[]
  xDataKey?: string
  height?: number
}

export default function TrendChart({ data, lines, xDataKey = 'date', height = 260 }: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey={xDataKey}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: '#1e293b',
            border: 'none',
            borderRadius: '8px',
            color: '#f1f5f9',
            fontSize: 12,
          }}
          itemStyle={{ color: '#cbd5e1' }}
          labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: '#64748b' }}
        />
        {lines.map((l) => (
          <Line
            key={l.dataKey}
            type="monotone"
            dataKey={l.dataKey}
            name={l.label ?? l.dataKey}
            stroke={l.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
