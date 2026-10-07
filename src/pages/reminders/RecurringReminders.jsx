import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Pagination from '../../components/ui/Pagination'
import SearchBar from '../../components/ui/SearchBar'
import FilterDropdown from '../../components/ui/FilterDropdown'
import {
  RecurringReminderTable,
  RecurringReminderForm,
} from '../../components/reminders'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { paginate } from '../../utils/helpers'
import {
  REMINDER_FREQUENCIES,
  calcNextReminderDate,
  getTodayISO,
  recurringToForm,
} from '../../utils/reminderHelpers'

const PAGE_SIZE = 8

export default function RecurringReminders() {
  const {
    products,
    recurringReminders,
    addRecurringReminder,
    updateRecurringReminder,
    deleteRecurringReminder,
  } = useApp()
  const { success } = useToast()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [frequencyFilter, setFrequencyFilter] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const formInitialValues = useMemo(
    () => (editing ? recurringToForm(editing) : null),
    [editing]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return recurringReminders.filter((r) => {
      if (q) {
        const hay = `${r.reminder} ${r.product} ${r.frequency}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (statusFilter && r.status !== statusFilter) return false
      if (frequencyFilter && r.frequency !== frequencyFilter) return false
      return true
    })
  }, [recurringReminders, search, statusFilter, frequencyFilter])

  const paged = paginate(filtered, page, PAGE_SIZE)

  const handleSubmit = (form) => {
    if (editing) {
      updateRecurringReminder(editing.id, {
        ...form,
        productId: form.productId ? Number(form.productId) : null,
      })
      success('Recurring reminder updated.')
    } else {
      addRecurringReminder({
        ...form,
        productId: form.productId ? Number(form.productId) : null,
        lastSent: form.lastSent || null,
      })
      success('Recurring reminder created.')
    }
    setModalOpen(false)
    setEditing(null)
  }

  const handlePause = (item) => {
    updateRecurringReminder(item.id, { status: 'Paused' })
    success('Reminder paused.')
  }

  const handleResume = (item) => {
    const nextReminder =
      item.nextReminder && item.nextReminder >= getTodayISO()
        ? item.nextReminder
        : calcNextReminderDate(getTodayISO(), item.frequency) || getTodayISO()
    updateRecurringReminder(item.id, { status: 'Active', nextReminder })
    success('Reminder resumed.')
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteRecurringReminder(deleteTarget.id)
    success('Recurring reminder deleted.')
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Reminders', to: '/reminders' },
              { label: 'Recurring' },
            ]}
          />
          <h1 className="page-title">Recurring Reminders</h1>
          <p className="page-subtitle">
            Schedule repeating equipment follow-ups by frequency
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/reminders" className="btn-secondary">
            <ArrowLeft size={16} />
            Back
          </Link>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          >
            <Plus size={16} />
            Add Recurring
          </button>
        </div>
      </div>

      <div className="card p-4 flex flex-col gap-3 lg:flex-row lg:items-end">
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search recurring reminders..."
          className="flex-1"
        />
        <FilterDropdown
          label="Status"
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'Active', label: 'Active' },
            { value: 'Paused', label: 'Paused' },
          ]}
          className="w-full lg:w-44"
        />
        <FilterDropdown
          label="Frequency"
          value={frequencyFilter}
          onChange={(v) => {
            setFrequencyFilter(v)
            setPage(1)
          }}
          options={[
            { value: '', label: 'All frequencies' },
            ...REMINDER_FREQUENCIES.map((f) => ({ value: f, label: f })),
          ]}
          className="w-full lg:w-52"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 md:p-0">
          <RecurringReminderTable
            records={paged.data}
            onEdit={(item) => {
              setEditing(item)
              setModalOpen(true)
            }}
            onPause={handlePause}
            onResume={handleResume}
            onDelete={setDeleteTarget}
          />
        </div>
        <div className="px-4 border-t border-slate-200 dark:border-slate-800">
          <Pagination
            page={paged.page}
            totalPages={paged.totalPages}
            total={paged.total}
            onChange={setPage}
          />
        </div>
      </div>

      <RecurringReminderForm
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        initialValues={formInitialValues}
        products={products}
        isEdit={!!editing}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Recurring Reminder"
        message={`Delete "${deleteTarget?.reminder}"? This cannot be undone.`}
        confirmText="Delete"
        danger
      />
    </div>
  )
}
