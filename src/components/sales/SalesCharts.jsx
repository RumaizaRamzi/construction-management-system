import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ChartCard from '../ui/ChartCard'
import DateRangePicker from '../ui/DateRangePicker'
import { formatCurrency } from '../../utils/helpers'
import { PAYMENT_STATUSES } from '../../utils/saleHelpers'

const PIE_COLORS = ['#c8211a', '#0ea5e9', '#10b981', '#d4a017', '#8b5cf6', '#64748b']

export default function SalesCharts({
  sales = [],
  products = [],
  dateFrom: controlledFrom,
  dateTo: controlledTo,
  onDateFromChange,
  onDateToChange,
}) {
  const [localFrom, setLocalFrom] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA')
  })
  const [localTo, setLocalTo] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('en-CA')
  })

  const from = controlledFrom ?? localFrom
  const to = controlledTo ?? localTo
  const setFrom = onDateFromChange ?? setLocalFrom
  const setTo = onDateToChange ?? setLocalTo

  const filtered = useMemo(() => {
    return sales.filter((s) => {
      if (from && s.date < from) return false
      if (to && s.date > to) return false
      return s.saleStatus !== 'Cancelled'
    })
  }, [sales, from, to])

  const dailySales = useMemo(() => {
    const map = {}
    filtered.forEach((s) => {
      map[s.date] = (map[s.date] || 0) + Number(s.total || 0)
    })
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date: date.slice(5), total, label: date }))
  }, [filtered])

  const monthlySales = useMemo(() => {
    const map = {}
    filtered.forEach((s) => {
      const month = String(s.date).slice(0, 7)
      map[month] = (map[month] || 0) + Number(s.total || 0)
    })
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        total,
      }))
  }, [filtered])

  const categorySales = useMemo(() => {
    const productMap = Object.fromEntries(products.map((p) => [p.id, p.category]))
    const map = {}
    filtered.forEach((s) => {
      ;(s.items || []).forEach((item) => {
        const category = productMap[item.productId] || 'Uncategorized'
        map[category] = (map[category] || 0) + Number(item.total ?? item.quantity * item.unitPrice)
      })
      if (!s.items?.length && s.products) {
        map['Uncategorized'] = (map['Uncategorized'] || 0) + Number(s.total || 0)
      }
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [filtered, products])

  const paymentStatusData = useMemo(() => {
    const map = Object.fromEntries(PAYMENT_STATUSES.map((s) => [s, 0]))
    filtered.forEach((s) => {
      map[s.paymentStatus] = (map[s.paymentStatus] || 0) + 1
    })
    return Object.entries(map)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }))
  }, [filtered])

  const currencyTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <p className="font-medium">{label}</p>
        <p className="text-brand-600">{formatCurrency(payload[0].value)}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <p className="label mb-2">Report Period</p>
        <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Daily Sales" subtitle="Revenue by day">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailySales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={currencyTooltip} />
              <Bar dataKey="total" fill="#c8211a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Sales" subtitle="Revenue trend">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlySales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={currencyTooltip} />
              <Area type="monotone" dataKey="total" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Sales by Product Category" subtitle="Category breakdown">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categorySales}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              >
                {categorySales.map((_, index) => (
                  <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Payment Status Distribution" subtitle="Invoice counts">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={paymentStatusData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {paymentStatusData.map((_, index) => (
                  <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
