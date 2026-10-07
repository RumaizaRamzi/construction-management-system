import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Breadcrumbs from '../../components/ui/Breadcrumbs'
import LoadingState from '../../components/ui/LoadingState'
import { RentalForm } from '../../components/rentals'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'
import {
  emptyRentalForm,
  normalizeRentalPayload,
  rentalIsStockOut,
} from '../../utils/rentalHelpers'

function rentalToForm(rental) {
  return {
    customerId: String(rental.customerId || ''),
    customer: rental.customer || '',
    customerPhone: rental.customerPhone || '',
    customerEmail: rental.customerEmail || '',
    customerAddress: rental.customerAddress || '',
    productId: String(rental.productId || ''),
    product: rental.product || '',
    product_serial_number: rental.product_serial_number || '',
    productCategory: rental.productCategory || '',
    productImage: rental.productImage || '',
    productCondition: rental.productCondition || '',
    quantity: rental.quantity || 1,
    rate: rental.rate ?? '',
    startDate: rental.startDate || '',
    expectedReturn: rental.expectedReturn || '',
    discount: rental.discount || 0,
    deposit: rental.deposit ?? '',
    lateFee: rental.lateFee || 0,
    damageFee: rental.damageFee || 0,
    amountPaid: rental.amountPaid || 0,
    paymentStatus: rental.paymentStatus || 'Pending',
    paymentMethod: rental.paymentMethod || 'Cash',
    rentalStatus: rental.rentalStatus || 'Confirmed',
    notes: rental.notes || '',
    specialInstructions: rental.specialInstructions || '',
    deliveryNotes: rental.deliveryNotes || '',
    branchId: rental.branchId != null ? String(rental.branchId) : '',
    timeline: rental.timeline,
    returnInfo: rental.returnInfo,
    _originalQty: rentalIsStockOut(rental) ? rental.quantity : 0,
  }
}

export default function RentalFormPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const {
    rentals,
    products,
    customers,
    addRental,
    updateRental,
    addCustomer,
    loadRental,
    rentalsLoading,
  } = useApp()
  const { success, error: showError } = useToast()

  const isEdit = location.pathname.endsWith('/edit')
  const isNew = location.pathname.endsWith('/new')

  const rental = useMemo(
    () => (isEdit ? rentals.find((r) => String(r.id) === String(id)) : null),
    [rentals, id, isEdit]
  )

  const [form, setForm] = useState(emptyRentalForm())
  const [ready, setReady] = useState(isNew)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  useEffect(() => {
    if (!isEdit || !id) return
    if (rental) return
    loadRental(id).catch(() => {})
  }, [isEdit, id, rental, loadRental])

  useEffect(() => {
    if (isNew) {
      setForm(emptyRentalForm())
      setReady(true)
      return
    }
    if (isEdit && rental) {
      setForm(rentalToForm(rental))
      setReady(true)
    } else if (isEdit && !rental && !rentalsLoading) {
      setReady(true)
    }
  }, [isNew, isEdit, rental, rentalsLoading])

  const handleAddCustomer = async (data) => {
    try {
      const { customer: created } = await addCustomer({
        ...data,
        status: 'Active',
      })
      setForm((f) => ({
        ...f,
        customerId: String(created.id),
        customer: created.name,
        customerPhone: created.phone || '',
        customerEmail: created.email || '',
        customerAddress: created.address || '',
      }))
      success('Customer added.')
    } catch (err) {
      showError(getApiErrorMessage(err, 'Unable to add customer.'))
    }
  }

  const saveRental = async (formData, printAgreement = false) => {
    setSaving(true)
    setFormError(null)
    const payload = normalizeRentalPayload(
      formData,
      isEdit && rental ? rental.rentalId || rental.rentalNumber : undefined
    )

    try {
      if (isEdit && rental) {
        const { rental: updated, message } = await updateRental(rental.id, payload)
        success(message || 'Rental updated successfully.')
        navigate(
          printAgreement
            ? `/rentals/${updated.id}/agreement`
            : `/rentals/${updated.id}`
        )
        return
      }

      const { rental: created, message } = await addRental(payload)
      success(message || 'Rental created successfully.')
      navigate(
        printAgreement
          ? `/rentals/${created.id}/agreement`
          : `/rentals/${created.id}`
      )
    } catch (err) {
      const fieldErrors = getApiValidationErrors(err)
      const msg =
        fieldErrors.quantity ||
        fieldErrors.items ||
        fieldErrors.expected_return_date ||
        getApiErrorMessage(err, 'Unable to save rental.')
      setFormError(msg)
      showError(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = (formData) => saveRental(formData, false)

  const handlePrintAgreement = (formData) => saveRental(formData, true)

  if (!ready || (isEdit && !rental && rentalsLoading)) {
    return <LoadingState label="Loading rental form..." />
  }

  if (isEdit && !rental) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Rentals', to: '/rentals' },
            { label: 'Not found' },
          ]}
        />
        <div className="card p-8 text-center">
          <h1 className="page-title">Rental not found</h1>
          <p className="page-subtitle mt-2">The rental you are trying to edit does not exist.</p>
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Rentals', to: '/rentals' },
              { label: isEdit ? rental.rentalId || rental.rentalNumber : 'New Rental' },
            ]}
          />
          <h1 className="page-title">{isEdit ? 'Edit Rental' : 'Create Rental'}</h1>
          <p className="page-subtitle">
            {isEdit
              ? 'Update rental details, equipment and payment'
              : 'Book equipment for a customer with dates and deposit'}
          </p>
        </div>
        <Link to="/rentals" className="btn-secondary">
          <ArrowLeft size={18} />
          Back
        </Link>
      </div>

      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {formError}
        </div>
      )}

      <RentalForm
        form={form}
        setForm={setForm}
        products={products}
        customers={customers}
        onAddCustomer={handleAddCustomer}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/rentals')}
        secondaryAction={handlePrintAgreement}
        submitLabel={saving ? 'Saving...' : isEdit ? 'Update Rental' : 'Save Rental'}
        showRentalStatus={isEdit}
        submitting={saving}
      />
    </div>
  )
}
