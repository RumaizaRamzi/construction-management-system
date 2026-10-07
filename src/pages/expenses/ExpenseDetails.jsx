import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Banknote,
  Pencil,
  Printer,
  Trash2,
} from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import LoadingState from '../../components/ui/LoadingState'
import {
  ExpenseForm,
  ExpenseCategoryBadge,
  ExpensePaymentStatusBadge,
  DeleteExpenseDialog,
} from '../../components/expense'
import {
  AmountSummaryCards,
  PaymentHistoryTable,
  PaymentForm,
  FinancialTimeline,
  RelatedRecordCard,
  PrintTransaction,
  FinancialSummary,
  PaymentViewModal,
  DeletePaymentDialog,
} from '../../components/financial'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage } from '../../services/api'
import { expenseToForm, normalizeExpensePayload } from '../../utils/expenseHelpers'
import {
  buildFinancialTimeline,
  paymentsForExpense,
  sumPaymentAmounts,
} from '../../utils/financialHelpers'
import { formatCurrency, formatDateDMY } from '../../utils/helpers'

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <div className="text-sm font-medium text-slate-900 dark:text-white break-words">
        {children || '—'}
      </div>
    </div>
  )
}

export default function ExpenseDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    income,
    expenses,
    expensesLoading,
    suppliers,
    products,
    maintenance,
    incomePayments,
    expensePayments,
    loadExpense,
    updateExpense,
    deleteExpense,
    addExpensePayment,
    updateExpensePayment,
    deleteExpensePayment,
  } = useApp()
  const { success, error: showError } = useToast()

  const [detailLoading, setDetailLoading] = useState(true)
  const [detailError, setDetailError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [paying, setPaying] = useState(false)

  const record = useMemo(
    () => expenses.find((e) => String(e.id) === String(id)),
    [expenses, id]
  )

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setDetailLoading(true)
    setDetailError(null)
    loadExpense(id)
      .catch((err) => {
        if (!cancelled) {
          setDetailError(getApiErrorMessage(err, 'Unable to load expense.'))
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, loadExpense])

  const payments = useMemo(
    () => paymentsForExpense(expensePayments, record),
    [expensePayments, record]
  )

  const paidTotal =
    record?.paidAmount != null ? Number(record.paidAmount) || 0 : sumPaymentAmounts(payments)
  const remaining =
    record?.remainingAmount != null
      ? Math.max(0, Number(record.remainingAmount) || 0)
      : Math.max(0, (Number(record?.amount) || 0) - paidTotal)

  const [editOpen, setEditOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState(null)
  const [viewPayment, setViewPayment] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePaymentTarget, setDeletePaymentTarget] = useState(null)

  const formInitialValues = useMemo(
    () => (record ? expenseToForm({ ...record, paidAmount: paidTotal }) : null),
    [record, paidTotal]
  )

  const canAddPayment = record && remaining > 0

  const timeline = useMemo(
    () => buildFinancialTimeline({ type: 'expense', record, payments }),
    [record, payments]
  )

  const relatedItems = useMemo(() => {
    if (!record) return []
    const items = []

    if (record.productId) {
      const product = products.find((p) => Number(p.id) === Number(record.productId))
      if (product) {
        items.push({
          key: 'product',
          label: 'Related Product',
          title: product.name,
          subtitle: product.serial_number || product.category,
          to: `/products/${product.id}`,
          actionLabel: 'View Product',
        })
      }
    } else if (record.product) {
      items.push({
        key: 'product-name',
        label: 'Related Product',
        title: record.product,
        subtitle: 'Linked by name',
      })
    }

    if (record.supplierId) {
      const supplier = suppliers.find((s) => Number(s.id) === Number(record.supplierId))
      if (supplier) {
        items.push({
          key: 'supplier',
          label: 'Related Supplier',
          title: supplier.name,
          subtitle: supplier.contact || supplier.email,
          to: '/suppliers',
          actionLabel: 'View Supplier',
        })
      }
    }

    if (record.maintenanceId) {
      const m = maintenance.find((item) => Number(item.id) === Number(record.maintenanceId))
      if (m) {
        items.push({
          key: 'maintenance',
          label: 'Related Maintenance',
          title: m.maintenanceId,
          subtitle: `${m.product} — ${m.maintenanceType}`,
          to: `/maintenance/${m.id}`,
          actionLabel: 'View Maintenance',
        })
      }
    }

    return items
  }, [record, products, suppliers, maintenance])

  const handleEdit = async (form) => {
    if (!record) return
    setSaving(true)
    try {
      const payload = normalizeExpensePayload(form, record.expenseId, record)
      const { message } = await updateExpense(record.id, payload)
      success(message || `Expense ${payload.expenseId} updated.`)
      setEditOpen(false)
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to save expense.'))
    } finally {
      setSaving(false)
    }
  }

  const handlePayment = async (payment) => {
    if (!record) return
    setPaying(true)
    try {
      if (editingPayment) {
        const { message } = await updateExpensePayment(editingPayment.id, payment)
        success(message || 'Payment updated successfully.')
      } else {
        const { message } = await addExpensePayment(record.id, payment)
        success(message || 'Payment added successfully.')
      }
      setPaymentOpen(false)
      setEditingPayment(null)
    } catch (err) {
      showError(getApiErrorMessage(err, 'Payment exceeds the remaining balance.'))
    } finally {
      setPaying(false)
    }
  }

  const handleDeletePayment = async () => {
    if (!deletePaymentTarget) return
    setPaying(true)
    try {
      const { message } = await deleteExpensePayment(deletePaymentTarget.id)
      success(message || 'Payment deleted successfully.')
      setDeletePaymentTarget(null)
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to delete payment.'))
    } finally {
      setPaying(false)
    }
  }

  const handleDelete = async () => {
    if (!record) return
    setSaving(true)
    try {
      const result = await deleteExpense(record.id)
      success(result?.message || `Expense ${record.expenseId} deleted.`)
      navigate('/expenses')
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to delete expense.'))
    } finally {
      setSaving(false)
    }
  }

  if ((detailLoading || expensesLoading) && !record) {
    return <LoadingState label="Loading expenses..." />
  }

  if (!record) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Expenses', to: '/expenses' }, { label: 'Not found' }]} />
        <div className="card p-8 text-center">
          <h1 className="page-title">Expense record not found</h1>
          <p className="page-subtitle mt-2">
            {detailError || 'The expense entry you are looking for does not exist or was removed.'}
          </p>
          <Link to="/expenses" className="btn-primary mt-6 inline-flex">
            <ArrowLeft size={18} />
            Back to Expenses
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between no-print">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Expenses', to: '/expenses' },
              { label: record.expenseId },
            ]}
          />
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="page-title">{record.expenseId}</h1>
            <ExpenseCategoryBadge category={record.category} />
            <ExpensePaymentStatusBadge status={record.paymentStatus} />
          </div>
          <p className="page-subtitle">
            {formatDateDMY(record.date)} · {record.supplier}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to="/expenses" className="btn-secondary">
            <ArrowLeft size={16} />
            Back
          </Link>
          <button
            type="button"
            className="btn-secondary"
            disabled={saving || paying}
            onClick={() => setEditOpen(true)}
          >
            <Pencil size={16} />
            Edit
          </button>
          {canAddPayment && (
            <button
              type="button"
              className="btn-primary"
              disabled={paying || saving}
              onClick={() => {
                setEditingPayment(null)
                setPaymentOpen(true)
              }}
            >
              <Banknote size={16} />
              {paying ? 'Processing payment...' : 'Add Payment'}
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={() => window.print()}>
            <Printer size={16} />
            Print
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={saving || paying}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>

      <AmountSummaryCards
        total={record.amount}
        paid={paidTotal}
        remaining={remaining}
        totalLabel="Total Expense"
        paidLabel="Paid"
        remainingLabel="Remaining"
      />

      <div className="grid gap-4 xl:grid-cols-3 no-print">
        <div className="xl:col-span-2 space-y-4">
          <div className="card p-5">
            <h2 className="font-display font-semibold text-slate-900 dark:text-white mb-4">
              Expense Information
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Expense ID">{record.expenseId}</Field>
              <Field label="Expense Date">{formatDateDMY(record.date)}</Field>
              <Field label="Category">
                <ExpenseCategoryBadge category={record.category} />
              </Field>
              <Field label="Supplier / Payee">{record.supplier}</Field>
              <Field label="Reference">{record.reference}</Field>
              <Field label="Related Product">{record.product || 'No Related Product'}</Field>
              <Field label="Related Maintenance">{record.maintenanceLabel || '—'}</Field>
              <Field label="Payment Method">{record.paymentMethod}</Field>
              <Field label="Payment Status">
                <ExpensePaymentStatusBadge status={record.paymentStatus} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Description">{record.description}</Field>
              </div>
              {record.notes && (
                <div className="sm:col-span-2">
                  <Field label="Notes">{record.notes}</Field>
                </div>
              )}
            </div>
          </div>

          <PaymentHistoryTable
            payments={payments}
            onView={setViewPayment}
            onEdit={(payment) => {
              setEditingPayment(payment)
              setPaymentOpen(true)
            }}
            onDelete={setDeletePaymentTarget}
          />
        </div>

        <div className="space-y-4">
          <FinancialTimeline events={timeline} />
          <RelatedRecordCard items={relatedItems} />
        </div>
      </div>

      <div className="no-print">
        <FinancialSummary
          income={income}
          expenses={expenses}
          incomePayments={incomePayments}
          expensePayments={expensePayments}
        />
      </div>

      <PrintTransaction type="expense" record={record} payments={payments} />

      <ExpenseForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEdit}
        initialValues={formInitialValues}
        suppliers={suppliers}
        products={products}
        maintenance={maintenance}
        isEdit
      />

      <PaymentForm
        open={paymentOpen}
        onClose={() => {
          setPaymentOpen(false)
          setEditingPayment(null)
        }}
        onSubmit={handlePayment}
        title={editingPayment ? 'Edit Expense Payment' : 'Add Expense Payment'}
        initialValues={editingPayment}
        remaining={remaining}
        excludeAmount={editingPayment ? Number(editingPayment.amount) || 0 : 0}
        contextLabel={`${record.expenseId} — ${formatCurrency(record.amount)} total`}
      />

      <PaymentViewModal
        open={!!viewPayment}
        onClose={() => setViewPayment(null)}
        payment={viewPayment}
      />

      <DeletePaymentDialog
        open={!!deletePaymentTarget}
        onClose={() => setDeletePaymentTarget(null)}
        onConfirm={handleDeletePayment}
        payment={deletePaymentTarget}
      />

      <DeleteExpenseDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        record={record}
      />
    </div>
  )
}
