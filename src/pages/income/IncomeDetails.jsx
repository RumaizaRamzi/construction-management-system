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
  IncomeForm,
  PaymentStatusBadge,
  IncomeSourceBadge,
  DeleteIncomeDialog,
} from '../../components/income'
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
import { incomeToForm, normalizeIncomePayload } from '../../utils/incomeHelpers'
import {
  buildFinancialTimeline,
  paymentsForIncome,
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

export default function IncomeDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    income,
    incomeLoading,
    expenses,
    customers,
    sales,
    rentals,
    bookings,
    incomePayments,
    expensePayments,
    loadIncomeRecord,
    updateIncome,
    deleteIncome,
    addIncomePayment,
    updateIncomePayment,
    deleteIncomePayment,
  } = useApp()
  const { success, error: showError } = useToast()

  const [detailLoading, setDetailLoading] = useState(true)
  const [detailError, setDetailError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [paying, setPaying] = useState(false)

  const record = useMemo(
    () => income.find((i) => String(i.id) === String(id)),
    [income, id]
  )

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setDetailLoading(true)
    setDetailError(null)
    loadIncomeRecord(id)
      .catch((err) => {
        if (!cancelled) {
          setDetailError(getApiErrorMessage(err, 'Unable to load income.'))
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, loadIncomeRecord])

  const payments = useMemo(
    () => paymentsForIncome(incomePayments, record),
    [incomePayments, record]
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
    () => (record ? incomeToForm({ ...record, paidAmount: paidTotal }) : null),
    [record, paidTotal]
  )

  const canAddPayment = record && remaining > 0

  const timeline = useMemo(
    () => buildFinancialTimeline({ type: 'income', record, payments }),
    [record, payments]
  )

  const relatedItems = useMemo(() => {
    if (!record) return []
    const items = []

    if (record.source === 'Sale') {
      const sale =
        sales.find((s) => Number(s.id) === Number(record.relatedId)) ||
        sales.find((s) => s.invoiceNumber === record.reference)
      if (sale) {
        items.push({
          key: 'sale',
          label: 'Related Sale',
          title: sale.invoiceNumber,
          subtitle: sale.customer,
          to: `/sales/${sale.id}`,
          actionLabel: 'View Sale',
        })
      }
    }

    if (record.source === 'Rental') {
      const rental =
        rentals.find((r) => Number(r.id) === Number(record.relatedId)) ||
        rentals.find((r) => (r.rentalId || r.rentalNumber) === record.reference)
      if (rental) {
        items.push({
          key: 'rental',
          label: 'Related Rental',
          title: rental.rentalId || rental.rentalNumber,
          subtitle: rental.customer,
          to: `/rentals/${rental.id}`,
          actionLabel: 'View Rental',
        })
      }
    }

    if (record.source === 'Booking') {
      const booking =
        bookings.find((b) => Number(b.id) === Number(record.relatedId)) ||
        bookings.find((b) => (b.bookingNumber || b.bookingId) === record.reference)
      if (booking) {
        items.push({
          key: 'booking',
          label: 'Related Booking',
          title: booking.bookingNumber || booking.bookingId,
          subtitle: booking.customer,
          to: '/bookings',
          actionLabel: 'View Booking',
        })
      }
    }

    if (record.customerId) {
      items.push({
        key: 'customer',
        label: 'Customer',
        title: record.customer,
        subtitle: `Customer #${record.customerId}`,
        to: `/customers/${record.customerId}`,
        actionLabel: 'View Customer',
      })
    }

    return items
  }, [record, sales, rentals, bookings])

  const handleEdit = async (form) => {
    if (!record) return
    setSaving(true)
    try {
      const payload = normalizeIncomePayload(form, record.incomeId, record)
      const { message } = await updateIncome(record.id, payload)
      success(message || `Income ${payload.incomeId} updated.`)
      setEditOpen(false)
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to save income.'))
    } finally {
      setSaving(false)
    }
  }

  const handlePayment = async (payment) => {
    if (!record) return
    setPaying(true)
    try {
      if (editingPayment) {
        const { message } = await updateIncomePayment(editingPayment.id, payment)
        success(message || 'Payment updated successfully.')
      } else {
        const { message } = await addIncomePayment(record.id, payment)
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
      const { message } = await deleteIncomePayment(deletePaymentTarget.id)
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
      const result = await deleteIncome(record.id)
      success(result?.message || `Income ${record.incomeId} deleted.`)
      navigate('/income')
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to delete income.'))
    } finally {
      setSaving(false)
    }
  }

  if ((detailLoading || incomeLoading) && !record) {
    return <LoadingState label="Loading income..." />
  }

  if (!record) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Income', to: '/income' }, { label: 'Not found' }]} />
        <div className="card p-8 text-center">
          <h1 className="page-title">Income record not found</h1>
          <p className="page-subtitle mt-2">
            {detailError || 'The income entry you are looking for does not exist or was removed.'}
          </p>
          <Link to="/income" className="btn-primary mt-6 inline-flex">
            <ArrowLeft size={18} />
            Back to Income
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
              { label: 'Income', to: '/income' },
              { label: record.incomeId },
            ]}
          />
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="page-title">{record.incomeId}</h1>
            <IncomeSourceBadge source={record.source} />
            <PaymentStatusBadge status={record.paymentStatus} />
          </div>
          <p className="page-subtitle">
            {formatDateDMY(record.date)} · {record.customer}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to="/income" className="btn-secondary">
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
        totalLabel="Total Amount"
        paidLabel="Paid Amount"
        remainingLabel="Remaining Amount"
      />

      <div className="grid gap-4 xl:grid-cols-3 no-print">
        <div className="xl:col-span-2 space-y-4">
          <div className="card p-5">
            <h2 className="font-display font-semibold text-slate-900 dark:text-white mb-4">
              Income Information
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Income ID">{record.incomeId}</Field>
              <Field label="Date">{formatDateDMY(record.date)}</Field>
              <Field label="Income Source">
                <IncomeSourceBadge source={record.source} />
              </Field>
              <Field label="Category">{record.category}</Field>
              <Field label="Customer">{record.customer}</Field>
              <Field label="Reference Number">{record.reference}</Field>
              <Field label="Payment Method">{record.paymentMethod}</Field>
              <Field label="Payment Status">
                <PaymentStatusBadge status={record.paymentStatus} />
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

      <PrintTransaction type="income" record={record} payments={payments} />

      <IncomeForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEdit}
        initialValues={formInitialValues}
        customers={customers}
        sales={sales}
        rentals={rentals}
        bookings={bookings}
        isEdit
      />

      <PaymentForm
        open={paymentOpen}
        onClose={() => {
          setPaymentOpen(false)
          setEditingPayment(null)
        }}
        onSubmit={handlePayment}
        title={editingPayment ? 'Edit Payment' : 'Add Payment'}
        initialValues={editingPayment}
        remaining={remaining}
        excludeAmount={editingPayment ? Number(editingPayment.amount) || 0 : 0}
        contextLabel={`${record.incomeId} — ${formatCurrency(record.amount)} total`}
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

      <DeleteIncomeDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        record={record}
      />
    </div>
  )
}
