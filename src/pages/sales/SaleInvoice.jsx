import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import LoadingState from '../../components/ui/LoadingState'
import SendInvoiceSmsButton from '../../components/ui/SendInvoiceSmsButton'
import { InvoiceTemplate } from '../../components/sales'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
export default function SaleInvoice() {
  const { id } = useParams()
  const { sales, settings, loadSale } = useApp()
  const { error: toastError } = useToast()
  const [loading, setLoading] = useState(true)

  const sale = sales.find((s) => String(s.id) === String(id))

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadSale(id)
      .catch(() => {
        if (!cancelled) toastError('Unable to load invoice.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, loadSale, toastError])

  const handlePrint = () => window.print()

  if (loading && !sale) {
    return <LoadingState label="Loading invoice..." />
  }

  if (!sale) {
    return (
      <div className="page-shell">
        <PageHeader
          title="Invoice not found"
          breadcrumbs={[{ label: 'Sales', to: '/sales' }, { label: 'Invoice not found' }]}
        />
        <div className="card p-8 text-center">
          <p className="page-subtitle">The sale invoice you are looking for does not exist.</p>
          <Link to="/sales" className="btn-primary mt-6 inline-flex">
            <ArrowLeft size={18} />
            Back to Sales
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <PageHeader
        className="no-print"
        title="Sale Invoice"
        subtitle={sale.invoiceNumber}
        breadcrumbs={[
          { label: 'Sales', to: '/sales' },
          { label: sale.invoiceNumber, to: `/sales/${sale.id}` },
          { label: 'Invoice' },
        ]}
        actions={
          <>
            <Link to={`/sales/${sale.id}`} className="btn-secondary">
              <ArrowLeft size={16} />
              Back
            </Link>
            <SendInvoiceSmsButton type="sale" id={sale.id} />
            <button type="button" className="btn-primary" onClick={handlePrint} title="Use 'Save as PDF' in the print dialog to download">
              <Printer size={16} />
              Print / Save PDF
            </button>
          </>
        }
      />

      <div className="invoice-print">
        <InvoiceTemplate sale={sale} settings={settings} />
      </div>
    </div>
  )
}
