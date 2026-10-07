import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import Pagination from '../../components/ui/Pagination'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import {
  CheckSummary,
  CheckFilters,
  CheckForm,
  CheckTable,
  DeleteCheckDialog,
} from '../../components/checks'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage } from '../../services/api'
import { paginate } from '../../utils/helpers'
import {
  checkToForm,
  defaultCheckFilters,
  filterChecks,
  getCheckStats,
  normalizeCheckPayload,
} from '../../utils/checkHelpers'

const PAGE_SIZE = 8

export default function Checks() {
  const {
    checks,
    checksLoading,
    checksError,
    loadChecks,
    products,
    categories,
    addCheck,
    updateCheck,
    deleteCheck,
  } = useApp()
  const { success, error: toastError } = useToast()

  const [draftFilters, setDraftFilters] = useState(defaultCheckFilters)
  const [appliedFilters, setAppliedFilters] = useState(defaultCheckFilters)
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [appliedFilters])

  const stats = useMemo(() => getCheckStats(checks), [checks])

  const filtered = useMemo(
    () => filterChecks(checks, appliedFilters),
    [checks, appliedFilters]
  )

  const paged = paginate(filtered, page, PAGE_SIZE)

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (check) => {
    setEditing(check)
    setModalOpen(true)
  }

  const handleSubmit = async (form) => {
    setSaving(true)
    try {
      if (editing) {
        const payload = normalizeCheckPayload(form, editing.checkId || editing.checkNumber, editing)
        const { check, message } = await updateCheck(editing.id, payload)
        success(message || `Check ${check?.checkId || payload.checkId} updated.`)
      } else {
        const payload = normalizeCheckPayload(form, form.checkId || undefined)
        const { check, message } = await addCheck(payload)
        success(message || `Check ${check?.checkId || 'created'} created.`)
      }
      setModalOpen(false)
      setEditing(null)
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to save check.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      const { message } = await deleteCheck(deleteTarget.id)
      success(message || `Check ${deleteTarget.checkId || deleteTarget.check} deleted.`)
      setDeleteTarget(null)
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to delete check.'))
    } finally {
      setSaving(false)
    }
  }

  const handleFilter = () => setAppliedFilters({ ...draftFilters })
  const handleReset = () => {
    const empty = defaultCheckFilters()
    setDraftFilters(empty)
    setAppliedFilters(empty)
  }

  const formInitialValues = useMemo(
    () => (editing ? checkToForm(editing) : null),
    [editing]
  )

  if (checksLoading && checks.length === 0) {
    return <LoadingState label="Loading checks..." />
  }

  if (checksError && checks.length === 0) {
    return (
      <div className="page-shell">
        <ApiErrorState
          title="Unable to load checks"
          message={checksError}
          onRetry={() => loadChecks().catch(() => {})}
        />
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Breadcrumbs items={[{ label: 'Checks' }]} />
          <h1 className="page-title">Check Management</h1>
          <p className="page-subtitle">
            Monitor equipment inspections, maintenance and scheduled checks
          </p>
        </div>
        <button type="button" className="btn-primary shrink-0" onClick={openCreate} disabled={saving}>
          <Plus size={16} />
          Add Check
        </button>
      </div>

      <CheckSummary stats={stats} />

      <CheckFilters
        filters={draftFilters}
        onChange={setDraftFilters}
        onFilter={handleFilter}
        onReset={handleReset}
        products={products}
        categories={categories}
      />

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Showing <span className="font-medium text-slate-800 dark:text-slate-200">{paged.data.length}</span> of{' '}
            <span className="font-medium text-slate-800 dark:text-slate-200">{filtered.length}</span> checks
          </p>
        </div>
        <div className="p-4 md:p-0">
          <CheckTable
            checks={paged.data}
            onEdit={openEdit}
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

      <CheckForm
        open={modalOpen}
        onClose={() => {
          if (saving) return
          setModalOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        initialValues={formInitialValues}
        products={products}
        isEdit={!!editing}
      />

      <DeleteCheckDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        check={deleteTarget}
      />
    </div>
  )
}
