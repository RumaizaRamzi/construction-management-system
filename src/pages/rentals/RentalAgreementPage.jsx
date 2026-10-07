import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import LoadingState from '../../components/ui/LoadingState'
import SendInvoiceSmsButton from '../../components/ui/SendInvoiceSmsButton'
import { RentalAgreement } from '../../components/rentals'
import { useApp } from '../../contexts/AppContext'
import { downloadTextFile } from '../../utils/helpers'

export default function RentalAgreementPage() {
  const { id } = useParams()
  const { rentals, rentalsLoading, settings, loadRental } = useApp()
  const printRef = useRef(null)

  const rental = rentals.find((r) => String(r.id) === String(id))

  useEffect(() => {
    if (!id) return
    loadRental(id).catch(() => {})
  }, [id, loadRental])

  const handlePrint = () => window.print()

  const handleDownload = () => {
    if (!rental) return
    const content = printRef.current?.innerText || ''
    const filename = `${rental.rentalId || rental.rentalNumber || 'rental-agreement'}.txt`
    downloadTextFile(filename, content)
  }

  if (rentalsLoading && !rental) {
    return <LoadingState label="Loading agreement..." />
  }

  if (!rental) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Rentals', to: '/rentals' }, { label: 'Not found' }]} />
        <div className="card p-8 text-center">
          <h1 className="page-title">Rental not found</h1>
          <p className="page-subtitle mt-2">The rental agreement could not be loaded.</p>
          <Link to="/rentals" className="btn-primary mt-6 inline-flex">
            <ArrowLeft size={18} />
            Back to Rentals
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="no-print">
        <Breadcrumbs
          items={[
            { label: 'Rentals', to: '/rentals' },
            { label: rental.rentalId || rental.rentalNumber, to: `/rentals/${rental.id}` },
            { label: 'Agreement' },
          ]}
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="page-title">Rental Agreement</h1>
            <p className="page-subtitle">Print or download the rental contract</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/rentals/${rental.id}`} className="btn-secondary">
              <ArrowLeft size={16} />
              Back
            </Link>
            <button type="button" className="btn-secondary" onClick={handleDownload}>
              <Download size={16} />
              Download
            </button>
            <SendInvoiceSmsButton type="rental" id={rental.id} />
            <button type="button" className="btn-primary" onClick={handlePrint}>
              <Printer size={16} />
              Print A4
            </button>
          </div>
        </div>
      </div>

      <div ref={printRef} className="invoice-print">
        <RentalAgreement rental={rental} settings={settings} />
      </div>
    </div>
  )
}
