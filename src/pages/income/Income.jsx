import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import Pagination from '../../components/ui/Pagination'
import LoadingState from '../../components/ui/LoadingState'
import {
  IncomeStats,
  IncomeFilters,
  IncomeTable,
  IncomeForm,
  IncomeReportSummary,
  DeleteIncomeDialog,
} from '../../components/income'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage } from '../../services/api'
import { paginate } from '../../utils/helpers'
import {
  defaultIncomeFilters,
  filterIncome,
  generateIncomeId,
  incomeToForm,
  normalizeIncomePayload,
  sortIncome,
} from '../../utils/incomeHelpers'

const PAGE_SIZE = 8

export default function Income() {
  const {
    income,
    incomeLoading,
    incomeError,
    loadIncome,
    customers,
    sales,
    rentals,
    bookings,
    addIncome,
    updateIncome,
    deleteIncome,
  } = useApp()
  const { success, error: showError } = useToast()

  const [draftFilters, setDraftFilters] = useState(defaultIncomeFilters)
  const [appliedFilters, setAppliedFilters] = useState(defaultIncomeFilters)
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [appliedFilters, sortBy, sortDir])

  const filtered = useMemo(() => {
    const list = filterIncome(income, appliedFilters)
    return sortIncome(list, sortBy, sortDir)
  }, [income, appliedFilters, sortBy, sortDir])

  const paged = paginate(filtered, page, PAGE_SIZE)

  const customerNames = useMemo(
    () => income.map((i) => i.customer).filter(Boolean),
    [income]
  )

  const formInitialValues = useMemo(
    () => (editing ? incomeToForm(editing) : null),
    [editing]
  )

  const handleSubmit = async (form) => {
    setSaving(true)
    try {
      if (editing) {
        const payload = normalizeIncomePayload(form, editing.incomeId, editing)
        const { message } = await updateIncome(editing.id, payload)
        success(message || `Income ${payload.incomeId} updated.`)
      } else {
        const incomeId = generateIncomeId(income)
        const payload = normalizeIncomePayload(form, incomeId)
        const { message } = await addIncome(payload)
        success(message || `Income ${incomeId} created.`)
      }
      setModalOpen(false)
      setEditing(null)
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to save income.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const result = await deleteIncome(deleteTarget.id)
      success(result?.message || `Income ${deleteTarget.incomeId} deleted.`)
      setDeleteTarget(null)
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to delete income.'))
    }
  }

  if (incomeLoading && income.length === 0) {
    return <LoadingState label="Loading income..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Breadcrumbs items={[{ label: 'Income' }]} />
          <h1 className="page-title">Income Management</h1>
          <p className="page-subtitle">
            Track and monitor income from sales, rentals, bookings and other business activities.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary shrink-0"
          disabled={saving}
          onClick={() => {
            setEditing(null)
            setModalOpen(true)
          }}
        >
          <Plus size={16} />
          Add Income
        </button>
      </div>

      {incomeError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex flex-wrap items-center justify-between gap-3">
          <span>{incomeError}</span>
          <button type="button" className="btn-secondary text-xs" onClick={() => loadIncome().catch(() => {})}>
            Retry
          </button>
        </div>
      )}

      <IncomeStats income={income} />

      <IncomeFilters
        filters={draftFilters}
        onChange={setDraftFilters}
        onFilter={() => setAppliedFilters({ ...draftFilters })}
        onReset={() => {
          const empty = defaultIncomeFilters()
          setDraftFilters(empty)
          setAppliedFilters(empty)
        }}
        customers={customerNames}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={(by, dir) => {
          setSortBy(by)
          setSortDir(dir)
        }}
      />

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3">
          <p className="text-sm text-slate-500">
            Showing{' '}
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {paged.data.length}
            </span>{' '}
            of{' '}
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {filtered.length}
            </span>{' '}
            records
          </p>
        </div>
        <div className="p-4 md:p-0">
          <IncomeTable
            records={paged.data}
            onEdit={(record) => {
              setEditing(record)
              setModalOpen(true)
            }}
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

      <IncomeReportSummary income={income} />

      <IncomeForm
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        initialValues={formInitialValues}
        customers={customers}
        sales={sales}
        rentals={rentals}
        bookings={bookings}
        isEdit={!!editing}
      />

      <DeleteIncomeDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        record={deleteTarget}
      />
    </div>
  )
}
