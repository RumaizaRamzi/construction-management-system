import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import LoadingState from '../../components/ui/LoadingState'
import { SaleForm } from '../../components/sales'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'
import {
  emptySaleForm,
  normalizeSalePayload,
  validateSaleForm,
} from '../../utils/saleHelpers'

function saleToForm(sale) {
  return {
    customerId: sale.customerId ? String(sale.customerId) : '',
    customer: sale.customer || '',
    customerPhone: sale.customerPhone || '',
    customerEmail: sale.customerEmail || '',
    customerAddress: sale.customerAddress || '',
    date: sale.date,
    items: (sale.items || []).map((item) => ({
      ...item,
      _originalQty: item.quantity,
    })),
    discount: sale.orderDiscount ?? 0,
    taxRate: sale.taxRate ?? 0,
    amountPaid: sale.amountPaid || 0,
    paymentStatus: sale.paymentStatus || 'Pending',
    paymentMethod: sale.paymentMethod || 'Cash',
    paymentDate: sale.paymentDate || sale.date,
    saleStatus: sale.saleStatus || 'Completed',
    notes: sale.notes || '',
    branchId: sale.branchId != null ? String(sale.branchId) : '',
  }
}

export default function SaleFormPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const {
    sales,
    products,
    customers,
    categories,
    addSale,
    updateSale,
    addCustomer,
    loadSale,
    salesLoading,
    settings,
  } = useApp()
  const defaultTaxRate = Number(settings?.taxRate || 0)
  const { success, error: toastError } = useToast()

  const isEdit = Boolean(id) && location.pathname.endsWith('/edit')
  const sale = isEdit ? sales.find((s) => String(s.id) === String(id)) : null

  const [form, setForm] = useState(() => ({ ...emptySaleForm(), taxRate: defaultTaxRate }))
  const [saving, setSaving] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(isEdit)

  useEffect(() => {
    if (!isEdit || !id) {
      setLoadingEdit(false)
      return undefined
    }
    let cancelled = false
    setLoadingEdit(true)
    loadSale(id)
      .catch(() => {
        if (!cancelled) toastError('Unable to load sale.')
      })
      .finally(() => {
        if (!cancelled) setLoadingEdit(false)
      })
    return () => {
      cancelled = true
    }
  }, [isEdit, id, loadSale, toastError])

  useEffect(() => {
    if (isEdit && sale) {
      setForm(saleToForm(sale))
    } else if (!isEdit) {
      setForm({ ...emptySaleForm(), taxRate: defaultTaxRate })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, sale])

  useEffect(() => {
    if (!isEdit) setForm((f) => ({ ...f, taxRate: defaultTaxRate }))
  }, [isEdit, defaultTaxRate])

  const pageTitle = isEdit ? 'Edit Sale' : 'Create Sale'
  const breadcrumbLabel = isEdit ? sale?.invoiceNumber || 'Edit' : 'New Sale'

  const handleAddCustomer = async (customerData) => {
    try {
      const { customer } = await addCustomer({
        name: customerData.name.trim(),
        phone: customerData.phone || '',
        email: customerData.email || '',
        address: customerData.address || '',
        status: 'Active',
      })
      setForm((f) => ({
        ...f,
        customerId: String(customer.id),
        customer: customer.name,
        customerPhone: customer.phone || '',
        customerEmail: customer.email || '',
        customerAddress: customer.address || '',
      }))
      success('Customer added successfully.')
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to add customer.'))
    }
  }

  const saveSale = async (formData, printAfter = false) => {
    const errors = validateSaleForm(formData, products)
    if (Object.keys(errors).length) {
      if (errors.stock) {
        toastError('Insufficient stock available.')
      } else {
        toastError(Object.values(errors)[0] || 'Please correct the form.')
      }
      return
    }

    // Invoice number is assigned by the backend on create.
    const payload = normalizeSalePayload(formData, isEdit ? sale?.invoiceNumber : undefined)

    setSaving(true)
    try {
      if (isEdit) {
        const { sale: updated, message } = await updateSale(Number(id), payload)
        success(message || 'Sale updated successfully.')
        navigate(printAfter ? `/sales/${updated.id}/invoice` : `/sales/${updated.id}`)
      } else {
        const { sale: created, message } = await addSale(payload)
        success(message || 'Sale created successfully.')
        navigate(printAfter ? `/sales/${created.id}/invoice` : `/sales/${created.id}`)
      }
    } catch (error) {
      const fieldErrors = getApiValidationErrors(error)
      const stockMsg = fieldErrors.stock || fieldErrors.items
      toastError(stockMsg || getApiErrorMessage(error, 'Unable to save sale.'))
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = (formData) => {
    if (!saving) saveSale(formData, false)
  }
  const handleSaveAndPrint = (formData) => {
    if (!saving) saveSale(formData, true)
  }

  if (isEdit && (loadingEdit || salesLoading) && !sale) {
    return <LoadingState label="Loading sale..." />
  }

  if (isEdit && !sale && !loadingEdit) {
    return (
      <div className="page-shell">
        <PageHeader
          title="Sale not found"
          breadcrumbs={[{ label: 'Sales', to: '/sales' }, { label: 'Not found' }]}
        />
        <div className="card p-8 text-center">
          <p className="page-subtitle">The sale you are trying to edit does not exist.</p>
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
        title={pageTitle}
        subtitle={
          isEdit
            ? 'Update sale details, line items and payment'
            : 'Record a new equipment or product sale'
        }
        breadcrumbs={[
          { label: 'Sales', to: '/sales' },
          ...(isEdit && sale ? [{ label: sale.invoiceNumber, to: `/sales/${sale.id}` }] : []),
          { label: breadcrumbLabel },
        ]}
        actions={
          <Link to={isEdit ? `/sales/${id}` : '/sales'} className="btn-secondary">
            <ArrowLeft size={16} />
            Back
          </Link>
        }
      />

      <SaleForm
        form={form}
        setForm={setForm}
        products={products}
        customers={customers}
        categories={categories}
        onSubmit={handleSubmit}
        onCancel={() => navigate(isEdit ? `/sales/${id}` : '/sales')}
        onAddCustomer={handleAddCustomer}
        submitLabel={saving ? 'Saving…' : isEdit ? 'Update Sale' : 'Create Sale'}
        secondaryAction={handleSaveAndPrint}
      />
    </div>
  )
}
