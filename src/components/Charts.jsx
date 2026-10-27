import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, AreaChart, Area, PieChart, Pie, Cell } from 'recharts'
import { money } from '../lib/utils'

const axis = { fontSize: 12, fill: '#64748b' }
const tooltipStyle = { borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }

export const STATUS_COLORS = {
  Booked: '#94a3b8',
  Picked: '#38bdf8',
  'In Transit': '#6366f1',
  'Out for Delivery': '#f59e0b',
  Delivered: '#10b981',
  Returned: '#f97316',
  Cancelled: '#f43f5e',
}

export function ParcelsBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="parcels" name="Booked" fill="#6366f1" radius={[4, 4, 0, 0]} />
        <Bar dataKey="delivered" name="Delivered" fill="#10b981" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function RevenueAreaChart({ data, dataKey = 'revenue', name = 'Revenue' }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(v)} />
        <Area type="monotone" dataKey={dataKey} name={name} stroke="#6366f1" strokeWidth={2} fill={`url(#grad-${dataKey})`} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function StatusDonut({ counts }) {
  const data = Object.entries(STATUS_COLORS)
    .map(([name]) => ({ name, value: counts[name] || 0 }))
    .filter((d) => d.value > 0)
  const total = data.reduce((t, d) => t + d.value, 0)

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2} strokeWidth={0}>
              {data.map((d) => (
                <Cell key={d.name} fill={STATUS_COLORS[d.name]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold">{total}</span>
          <span className="text-xs text-slate-500">Parcels</span>
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[d.name] }} />
              {d.name}
            </span>
            <span className="font-medium text-slate-700">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
