import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import LoadingState from '../../components/ui/LoadingState'
import { RentalReturnForm } from '../../components/rentals'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage } from '../../services/api'

const RETURNABLE_STATUSES = ['Active', 'Overdue', 'Confirmed']

export default function RentalReturn() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    rentals,
    rentalsLoading,
    settings,
    completeRentalReturn,
    loadRental,
  } = useApp()
  const { success, error: showError } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const rental = rentals.find((r) => String(r.id) === String(id))
  const lateFeePerDay = settings?.lateFeePerDay ?? 2500

  useEffect(() => {
    if (!id) return
    loadRental(id).catch(() => {})
  }, [id, loadRental])

  const handleComplete = async (returnData) => {
    if (!rental) return
    setSubmitting(true)
    try {
      const { message } = await completeRentalReturn(rental.id, {
        ...returnData,
        returnedQuantity: returnData.returnedQty,
        damagedQuantity: returnData.damagedQty,
        missingQuantity: returnData.missingQty,
        sendToMaintenance: ['Damaged', 'Needs Maintenance'].includes(returnData.condition),
      })
      success(message || 'Rental returned successfully.')
      navigate(`/rentals/${rental.id}`)
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to process return.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (rentalsLoading && !rental) {
    return <LoadingState label="Loading rental..." />
  }

  if (!rental) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Rentals', to: '/rentals' }, { label: 'Not found' }]} />
        <div className="card p-8 text-center">
          <h1 className="page-title">Rental not found</h1>
          <p className="page-subtitle mt-2">The rental you are trying to return does not exist.</p>
          <Link to="/rentals" className="btn-primary mt-6 inline-flex">
            <ArrowLeft size={18} />
            Back to Rentals
          </Link>
        </div>
      </div>
    )
  }

  if (!RETURNABLE_STATUSES.includes(rental.rentalStatus)) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Rentals', to: '/rentals' },
            { label: rental.rentalId || rental.rentalNumber, to: `/rentals/${rental.id}` },
            { label: 'Return' },
          ]}
        />
        <div className="card p-8 text-center">
          <h1 className="page-title">Return not available</h1>
          <p className="page-subtitle mt-2">
            This rental is {rental.rentalStatus.toLowerCase()} and cannot be processed for return.
          </p>
          <Link to={`/rentals/${rental.id}`} className="btn-primary mt-6 inline-flex">
            <ArrowLeft size={18} />
            Back to Rental
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Rentals', to: '/rentals' },
              { label: rental.rentalId || rental.rentalNumber, to: `/rentals/${rental.id}` },
              { label: 'Return' },
            ]}
          />
          <h1 className="page-title">Process Return</h1>
          <p className="page-subtitle">
            Record equipment return, inspect condition, and calculate charges
          </p>
        </div>
        <Link to={`/rentals/${rental.id}`} className="btn-secondary">
          <ArrowLeft size={18} />
          Cancel
        </Link>
      </div>

      <RentalReturnForm
        key={`${rental.id}-${rental.items?.length || 0}-${rental.returns?.length || 0}`}
        rental={rental}
        lateFeePerDay={lateFeePerDay}
        onSubmit={handleComplete}
        onCancel={() => navigate(`/rentals/${rental.id}`)}
        submitting={submitting}
      />
    </div>
  )
}
