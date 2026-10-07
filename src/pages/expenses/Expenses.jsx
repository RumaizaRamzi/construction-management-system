import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import Pagination from '../../components/ui/Pagination'
import LoadingState from '../../components/ui/LoadingState'
import {
  ExpenseStats,
  ExpenseFilters,
  ExpenseTable,
  ExpenseForm,
  ExpenseCategorySummary,
  DeleteExpenseDialog,
} from '../../components/expense'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage } from '../../services/api'
import { paginate } from '../../utils/helpers'
import {
  defaultExpenseFilters,
  expenseToForm,
  filterExpenses,
  generateExpenseId,
  normalizeExpensePayload,
  sortExpenses,
} from '../../utils/expenseHelpers'

const PAGE_SIZE = 8

export default function Expenses() {
  const {
    expenses,
    expensesLoading,
    expensesError,
    loadExpenses,
    suppliers,
    products,
    maintenance,
    addExpense,
    updateExpense,
    deleteExpense,
  } = useApp()
  const { success, error: showError } = useToast()

  const [draftFilters, setDraftFilters] = useState(defaultExpenseFilters)
  const [appliedFilters, setAppliedFilters] = useState(defaultExpenseFilters)
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
    const list = filterExpenses(expenses, appliedFilters)
    return sortExpenses(list, sortBy, sortDir)
  }, [expenses, appliedFilters, sortBy, sortDir])

  const paged = paginate(filtered, page, PAGE_SIZE)

  const supplierNames = useMemo(
    () => expenses.map((e) => e.supplier).filter(Boolean),
    [expenses]
  )

  const productNames = useMemo(
    () => expenses.map((e) => e.product).filter(Boolean),
    [expenses]
  )

  const formInitialValues = useMemo(
    () => (editing ? expenseToForm(editing) : null),
    [editing]
  )

  const handleSubmit = async (form) => {
    setSaving(true)
    try {
      if (editing) {
        const payload = normalizeExpensePayload(form, editing.expenseId, editing)
        const { message } = await updateExpense(editing.id, payload)
        success(message || `Expense ${payload.expenseId} updated.`)
      } else {
        const expenseId = generateExpenseId(expenses)
        const payload = normalizeExpensePayload(form, expenseId)
        const { message } = await addExpense(payload)
        success(message || `Expense ${expenseId} created.`)
      }
      setModalOpen(false)
      setEditing(null)
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to save expense.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const result = await deleteExpense(deleteTarget.id)
      success(result?.message || `Expense ${deleteTarget.expenseId} deleted.`)
      setDeleteTarget(null)
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to delete expense.'))
    }
  }

  if (expensesLoading && expenses.length === 0) {
    return <LoadingState label="Loading expenses..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Breadcrumbs items={[{ label: 'Expenses' }]} />
          <h1 className="page-title">Expense Management</h1>
          <p className="page-subtitle">
            Track operating and equipment expenses across suppliers and products.
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
          Add Expense
        </button>
      </div>

      {expensesError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex flex-wrap items-center justify-between gap-3">
          <span>{expensesError}</span>
          <button type="button" className="btn-secondary text-xs" onClick={() => loadExpenses().catch(() => {})}>
            Retry
          </button>
        </div>
      )}

      <ExpenseStats expenses={expenses} />

      <ExpenseFilters
        filters={draftFilters}
        onChange={setDraftFilters}
        onFilter={() => setAppliedFilters({ ...draftFilters })}
        onReset={() => {
          const empty = defaultExpenseFilters()
          setDraftFilters(empty)
          setAppliedFilters(empty)
        }}
        suppliers={supplierNames}
        products={productNames}
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
          <ExpenseTable
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

      <ExpenseCategorySummary expenses={expenses} />

      <ExpenseForm
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        initialValues={formInitialValues}
        suppliers={suppliers}
        products={products}
        maintenance={maintenance}
        isEdit={!!editing}
      />

      <DeleteExpenseDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        record={deleteTarget}
      />
    </div>
  )
}
