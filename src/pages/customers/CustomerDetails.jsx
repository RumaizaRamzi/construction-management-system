import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarCheck,
  CreditCard,
  IdCard,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  ShoppingCart,
} from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import DataTable from '../../components/ui/DataTable'
import StatusBadge from '../../components/ui/StatusBadge'
import StatCard from '../../components/ui/StatCard'
import EmptyState from '../../components/ui/EmptyState'
import LoadingState from '../../components/ui/LoadingState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import Modal from '../../components/ui/Modal'
import CustomerIdPhoto from '../../components/customers/CustomerIdPhoto'
import { useApp } from '../../contexts/AppContext'
import { formatCurrency, formatDate } from '../../utils/helpers'
import { getApiErrorMessage } from '../../services/api'

export default function CustomerDetails() {
  const { id } = useParams()
  const {
    customers,
    customersLoading,
    loadCustomer,
    sales,
    rentals,
    bookings,
    income,
  } = useApp()

  const customerId = Number(id)
  const cached = customers.find((c) => Number(c.id) === customerId)
  const [customer, setCustomer] = useState(cached || null)
  const [detailLoading, setDetailLoading] = useState(!cached)
  const [detailError, setDetailError] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [idPhotoViewSrc, setIdPhotoViewSrc] = useState(null)

  useEffect(() => {
    let cancelled = false

    if (cached) {
      setCustomer(cached)
      setDetailLoading(false)
      setDetailError(null)
      setNotFound(false)
      return undefined
    }

    if (customersLoading) {
      setDetailLoading(true)
      return undefined
    }

    ;(async () => {
      setDetailLoading(true)
      setDetailError(null)
      try {
        const row = await loadCustomer(id)
        if (cancelled) return
        if (!row) {
          setNotFound(true)
          setCustomer(null)
        } else {
          setCustomer(row)
          setNotFound(false)
        }
      } catch (error) {
        if (!cancelled) {
          setDetailError(getApiErrorMessage(error, 'Unable to load customer details.'))
        }
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id, cached, customersLoading, loadCustomer])

  const purchaseHistory = useMemo(
    () => sales.filter((s) => Number(s.customerId) === customerId),
    [sales, customerId]
  )

  const rentalHistory = useMemo(
    () => rentals.filter((r) => Number(r.customerId) === customerId),
    [rentals, customerId]
  )

  const bookingHistory = useMemo(
    () => bookings.filter((b) => Number(b.customerId) === customerId),
    [bookings, customerId]
  )

  const paymentHistory = useMemo(() => {
    const fromSales = purchaseHistory.map((s) => ({
      id: `sale-${s.id}`,
      date: s.date,
      type: 'Sale',
      reference: s.invoiceNumber,
      amount: s.total,
      status: s.paymentStatus,
      method: s.paymentMethod,
    }))
    const fromRentals = rentalHistory.map((r) => ({
      id: `rental-${r.id}`,
      date: r.startDate,
      type: 'Rental',
      reference: r.rentalId,
      amount: r.total,
      status: r.paymentStatus,
      method: 'Rental Contract',
    }))
    const fromIncome = income
      .filter(
        (i) =>
          fromSales.some((s) => s.reference === i.reference) ||
          fromRentals.some((r) => r.reference === i.reference)
      )
      .map((i) => ({
        id: `income-${i.id}`,
        date: i.date,
        type: i.type,
        reference: i.reference,
        amount: i.amount,
        status: 'Paid',
        method: i.paymentMethod,
      }))
    return [...fromSales, ...fromRentals, ...fromIncome].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    )
  }, [purchaseHistory, rentalHistory, income])

  if (detailLoading || (customersLoading && !customer)) {
    return <LoadingState label="Loading customer details..." />
  }

  if (detailError) {
    return (
      <div className="card">
        <ApiErrorState
          title="Unable to load customer details."
          message={detailError}
          onRetry={() => {
            setDetailError(null)
            setDetailLoading(true)
            loadCustomer(id)
              .then((row) => {
                if (!row) setNotFound(true)
                else setCustomer(row)
              })
              .catch((error) => {
                setDetailError(getApiErrorMessage(error, 'Unable to load customer details.'))
              })
              .finally(() => setDetailLoading(false))
          }}
        />
      </div>
    )
  }

  if (notFound || !customer) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Customers', to: '/customers' }, { label: 'Not Found' }]} />
        <EmptyState title="Customer not found" description="This customer may have been removed." />
        <Link to="/customers" className="btn-secondary inline-flex">
          <ArrowLeft size={16} />
          Back to Customers
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: 'Customers', to: '/customers' }, { label: customer.name }]} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="page-title">{customer.name}</h1>
            <p className="page-subtitle">
              {customer.customerCode ? `${customer.customerCode} · ` : ''}
              {customer.customerType || 'Company'} · Customer profile and transaction history
            </p>
          </div>
          <Link to="/customers" className="btn-secondary">
            <ArrowLeft size={16} />
            Back
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">Contact Info</h3>
            <StatusBadge status={customer.status} />
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Phone size={16} className="text-slate-400 mt-0.5 shrink-0" />
              <span>{customer.phone || '—'}</span>
            </div>
            <div className="flex items-start gap-3">
              <Mail size={16} className="text-slate-400 mt-0.5 shrink-0" />
              <span>{customer.email || '—'}</span>
            </div>
            <div className="flex items-start gap-3">
              <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
              <span>
                {[customer.address, customer.city].filter(Boolean).join(', ') || '—'}
              </span>
            </div>
            {customer.companyName ? (
              <p className="text-xs text-slate-500 pt-1">Company: {customer.companyName}</p>
            ) : null}
            {customer.notes ? (
              <p className="text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3">
                {customer.notes}
              </p>
            ) : null}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
              <div className="flex items-start gap-3">
                <IdCard size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <span>
                  <span className="text-xs text-slate-500">ID Number: </span>
                  {customer.idNumber || '—'}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1.5">ID Photo</p>
                {customer.hasIdPhoto ? (
                  <CustomerIdPhoto
                    customerId={customer.id}
                    className="h-36 w-full"
                    onClick={setIdPhotoViewSrc}
                  />
                ) : (
                  <p className="text-sm">—</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Purchases"
            value={formatCurrency(customer.totalPurchases)}
            icon={ShoppingCart}
            tone="green"
          />
          <StatCard title="Total Rentals" value={customer.totalRentals} icon={KeyRound} tone="blue" />
          <StatCard
            title="Pending Payment"
            value={formatCurrency(customer.pendingPayment)}
            icon={CreditCard}
            tone="red"
          />
          <StatCard title="Bookings" value={bookingHistory.length} icon={CalendarCheck} tone="violet" />
        </div>
      </div>

      <div className="card">
        <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-4">
          <h3 className="font-display font-semibold">Purchase History</h3>
          <p className="text-sm text-slate-500 mt-0.5">Local sales data — API connection planned later</p>
        </div>
        <DataTable
          columns={[
            { key: 'invoiceNumber', label: 'Invoice' },
            { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
            { key: 'products', label: 'Products' },
            { key: 'quantity', label: 'Qty' },
            { key: 'total', label: 'Total', render: (r) => formatCurrency(r.total) },
            {
              key: 'paymentStatus',
              label: 'Payment',
              render: (r) => <StatusBadge status={r.paymentStatus} />,
            },
            {
              key: 'saleStatus',
              label: 'Status',
              render: (r) => <StatusBadge status={r.saleStatus} />,
            },
          ]}
          data={purchaseHistory}
          emptyTitle="No purchases"
          emptyDescription="This customer has no recorded sales yet."
        />
      </div>

      <div className="card">
        <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-4">
          <h3 className="font-display font-semibold">Rental History</h3>
          <p className="text-sm text-slate-500 mt-0.5">Local rental data — API connection planned later</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4 border-b border-slate-200 dark:border-slate-800">
          <StatCard title="Total Rentals" value={rentalHistory.length} icon={KeyRound} tone="blue" />
          <StatCard
            title="Active Rentals"
            value={rentalHistory.filter((r) =>
              ['Active', 'Confirmed', 'Overdue'].includes(r.rentalStatus)
            ).length}
            icon={CalendarCheck}
            tone="green"
          />
          <StatCard
            title="Rental Spending"
            value={formatCurrency(rentalHistory.reduce((sum, r) => sum + Number(r.total || 0), 0))}
            icon={ShoppingCart}
            tone="violet"
          />
          <StatCard
            title="Pending Balance"
            value={formatCurrency(rentalHistory.reduce((sum, r) => sum + Number(r.balance || 0), 0))}
            icon={CreditCard}
            tone="red"
          />
        </div>
        <DataTable
          columns={[
            {
              key: 'rentalId',
              label: 'Rental ID',
              render: (r) => (
                <Link to={`/rentals/${r.id}`} className="font-medium text-brand-600 hover:underline">
                  {r.rentalId || r.rentalNumber}
                </Link>
              ),
            },
            { key: 'product', label: 'Product' },
            { key: 'quantity', label: 'Qty' },
            { key: 'startDate', label: 'Start', render: (r) => formatDate(r.startDate) },
            { key: 'expectedReturn', label: 'Due', render: (r) => formatDate(r.expectedReturn) },
            { key: 'total', label: 'Total', render: (r) => formatCurrency(r.total) },
            {
              key: 'rentalStatus',
              label: 'Status',
              render: (r) => <StatusBadge status={r.rentalStatus} />,
            },
          ]}
          data={rentalHistory}
          emptyTitle="No rentals"
          emptyDescription="This customer has no rental contracts."
        />
      </div>

      <div className="card">
        <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-4">
          <h3 className="font-display font-semibold">Booking History</h3>
        </div>
        <DataTable
          columns={[
            { key: 'product', label: 'Product' },
            { key: 'quantity', label: 'Qty' },
            { key: 'startDate', label: 'Start', render: (r) => formatDate(r.startDate) },
            { key: 'endDate', label: 'End', render: (r) => formatDate(r.endDate) },
            { key: 'deposit', label: 'Deposit', render: (r) => formatCurrency(r.deposit) },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'notes', label: 'Notes', className: 'max-w-[200px] truncate' },
          ]}
          data={bookingHistory}
          emptyTitle="No bookings"
          emptyDescription="This customer has no upcoming or past bookings."
        />
      </div>

      <div className="card">
        <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-4">
          <h3 className="font-display font-semibold">Payment History</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Derived from local sales, rentals, and income records
          </p>
        </div>
        <DataTable
          columns={[
            { key: 'date', label: 'Date', render: (r) => formatDate(r.date) },
            { key: 'type', label: 'Type' },
            { key: 'reference', label: 'Reference' },
            { key: 'amount', label: 'Amount', render: (r) => formatCurrency(r.amount) },
            { key: 'method', label: 'Method' },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          ]}
          data={paymentHistory}
          emptyTitle="No payments"
          emptyDescription="Payment activity will appear here."
        />
      </div>

      <Modal open={!!idPhotoViewSrc} onClose={() => setIdPhotoViewSrc(null)} title="Customer ID Photo" size="lg">
        {idPhotoViewSrc ? (
          <img src={idPhotoViewSrc} alt="Customer ID" className="mx-auto max-h-[70vh] w-auto rounded-lg object-contain" />
        ) : null}
      </Modal>
    </div>
  )
}
