import { Eye, Edit2, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import MaintenanceStatusBadge from './MaintenanceStatusBadge'
import PriorityBadge from '../checks/PriorityBadge'
import { formatCurrency, formatDateDMY } from '../../utils/helpers'
import EmptyState from '../ui/EmptyState'

function MaintenanceCard({ record, onEdit, onDelete }) {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 font-medium">{record.maintenanceId}</p>
          <p className="font-semibold text-slate-900 dark:text-white truncate">{record.product}</p>
          <p className="text-sm text-slate-500 mt-0.5">{record.maintenanceType}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <MaintenanceStatusBadge status={record.status} record={record} />
          <PriorityBadge priority={record.priority} />
        </div>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">{record.description}</p>

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
        <div>
          <p className="text-slate-400">Start</p>
          <p className="font-medium">{formatDateDMY(record.startDate)}</p>
        </div>
        <div>
          <p className="text-slate-400">Expected</p>
          <p className="font-medium">{formatDateDMY(record.expectedCompletion)}</p>
        </div>
        <div>
          <p className="text-slate-400">Technician</p>
          <p className="font-medium">{record.technician}</p>
        </div>
        <div>
          <p className="text-slate-400">Cost</p>
          <p className="font-medium">{formatCurrency(record.cost || record.estimatedCost)}</p>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Link to={`/maintenance/${record.id}`} className="btn-secondary flex-1 text-xs justify-center">
          <Eye size={14} />
          View
        </Link>
        <button type="button" className="btn-secondary flex-1 text-xs" onClick={() => onEdit?.(record)}>
          <Edit2 size={14} />
          Edit
        </button>
        <button type="button" className="btn-danger flex-1 text-xs" onClick={() => onDelete?.(record)}>
          <Trash2 size={14} />
          Delete
        </button>
      </div>
    </div>
  )
}

export default function MaintenanceTable({ records = [], onEdit, onDelete }) {
  if (!records.length) {
    return (
      <EmptyState
        title="No maintenance records"
        description="Adjust filters or create a new maintenance job."
      />
    )
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {records.map((record) => (
          <MaintenanceCard
            key={record.id}
            record={record}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-semibold">Maintenance ID</th>
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Description</th>
              <th className="px-4 py-3 font-semibold">Start Date</th>
              <th className="px-4 py-3 font-semibold">Expected Completion</th>
              <th className="px-4 py-3 font-semibold">Technician</th>
              <th className="px-4 py-3 font-semibold">Cost</th>
              <th className="px-4 py-3 font-semibold">Priority</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {records.map((record) => (
              <tr key={record.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  <Link
                    to={`/maintenance/${record.id}`}
                    className="text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {record.maintenanceId}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-800 dark:text-slate-100">
                  {record.product}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{record.maintenanceType}</td>
                <td className="px-4 py-3 max-w-[220px] truncate text-slate-600 dark:text-slate-300">
                  {record.description}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDateDMY(record.startDate)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {formatDateDMY(record.expectedCompletion)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{record.technician}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {formatCurrency(record.cost || record.estimatedCost)}
                </td>
                <td className="px-4 py-3">
                  <PriorityBadge priority={record.priority} />
                </td>
                <td className="px-4 py-3">
                  <MaintenanceStatusBadge status={record.status} record={record} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Link
                      to={`/maintenance/${record.id}`}
                      className="btn-secondary !px-2 !py-1"
                      title="View"
                    >
                      <Eye size={14} />
                    </Link>
                    <button
                      type="button"
                      className="btn-secondary !px-2 !py-1"
                      title="Edit"
                      onClick={() => onEdit?.(record)}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn-danger !px-2 !py-1"
                      title="Delete"
                      onClick={() => onDelete?.(record)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
