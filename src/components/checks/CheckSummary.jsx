import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  CalendarDays,
} from 'lucide-react'
import StatCard from '../ui/StatCard'

export default function CheckSummary({ stats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <StatCard title="Total Checks" value={stats.total} icon={ClipboardCheck} tone="brand" />
      <StatCard title="Due Today" value={stats.dueToday} icon={Clock3} tone="red" />
      <StatCard title="Due This Week" value={stats.dueThisWeek} icon={CalendarDays} tone="blue" />
      <StatCard title="Overdue" value={stats.overdue} icon={AlertTriangle} tone="red" />
      <StatCard title="Completed" value={stats.completed} icon={CheckCircle2} tone="green" />
      <StatCard title="Upcoming" value={stats.upcoming} icon={CalendarClock} tone="violet" />
    </div>
  )
}
