import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Edit2, Eye, Plus, Trash2, Upload, Users, X } from 'lucide-react'
import CustomerIdPhoto from '../../components/customers/CustomerIdPhoto'
import AddressAutocomplete from '../../components/ui/AddressAutocomplete'
import PageHeader from '../../components/ui/PageHeader'
import SearchBar from '../../components/ui/SearchBar'
import FilterDropdown from '../../components/ui/FilterDropdown'
import DataTable from '../../components/ui/DataTable'
import Pagination from '../../components/ui/Pagination'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import StatusBadge from '../../components/ui/StatusBadge'
import StatCard from '../../components/ui/StatCard'
import LoadingState from '../../components/ui/LoadingState'
import EmptyState from '../../components/ui/EmptyState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { formatCurrency, paginate } from '../../utils/helpers'
import { getApiErrorMessage, getApiValidationErrors } from '../../services/api'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
]

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'Company', label: 'Company' },
  { value: 'Individual', label: 'Individual' },
]

const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'pending-desc', label: 'Pending (High–Low)' },
  { value: 'purchases-desc', label: 'Purchases (High–Low)' },
]

const emptyForm = {
  name: '',
  companyName: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  customerType: 'Company',
  status: 'Active',
  notes: '',
  idNumber: '',
}

const ID_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ID_PHOTO_MAX_BYTES = 5 * 1024 * 1024

function validateIdPhoto(file) {
  if (!file) return null
  if (!ID_PHOTO_TYPES.includes(file.type)) return 'ID photo must be a JPG, PNG or WEBP image.'
  if (file.size > ID_PHOTO_MAX_BYTES) return 'ID photo must not be larger than 5 MB.'
  return null
}

function validateCustomerForm(form) {
  const errors = {}
  if (!form.name?.trim()) errors.name = 'Customer name is required.'
  if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }
  if (form.phone?.trim() && form.phone.trim().length < 7) {
    errors.phone = 'Enter a valid phone number.'
  }
  if (!['Active', 'Inactive'].includes(form.status)) errors.status = 'Select a valid status.'
  if (!['Company', 'Individual'].includes(form.customerType)) {
    errors.customerType = 'Select a valid customer type.'
  }
  if (form.idNumber?.trim().length > 100) errors.idNumber = 'ID number must not exceed 100 characters.'
  return errors
}

export default function Customers() {
  const {
    customers,
    customersLoading,
    customersError,
    loadCustomers,
    addCustomer,
    updateCustomer,
    uploadCustomerIdPhoto,
    removeCustomerIdPhoto,
    deleteCustomer,
  } = useApp()
  const { success, error: toastError } = useToast()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name-asc')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [idPhotoFile, setIdPhotoFile] = useState(null)
  const [idPhotoPreview, setIdPhotoPreview] = useState(null)
  const [removeIdPhoto, setRemoveIdPhoto] = useState(false)

  useEffect(() => {
    if (!idPhotoFile) {
      setIdPhotoPreview(null)
      return undefined
    }
    const url = URL.createObjectURL(idPhotoFile)
    setIdPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [idPhotoFile])

  const resetIdPhoto = () => {
    setIdPhotoFile(null)
    setRemoveIdPhoto(false)
  }

  const handleIdPhotoChange = (e) => {
    const file = e.target.files?.[0] || null
    e.target.value = ''
    if (!file) return
    const error = validateIdPhoto(file)
    setFormErrors((prev) => ({ ...prev, idPhoto: error || undefined }))
    if (error) return
    setIdPhotoFile(file)
    setRemoveIdPhoto(false)
  }

  const savedAddresses = useMemo(
    () => customers.filter((c) => c.address).map((c) => ({ address: c.address, city: c.city || '' })),
    [customers]
  )

  const stats = useMemo(
    () => ({
      total: customers.length,
      active: customers.filter((c) => c.status === 'Active').length,
      pending: customers.reduce((sum, c) => sum + (c.pendingPayment || 0), 0),
      purchases: customers.reduce((sum, c) => sum + (c.totalPurchases || 0), 0),
    }),
    [customers]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = customers.filter((c) => {
      const matchStatus = statusFilter === 'all' || c.status === statusFilter
      const matchType = typeFilter === 'all' || c.customerType === typeFilter
      const matchSearch =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        c.companyName?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.customerCode?.toLowerCase().includes(q)
      return matchStatus && matchType && matchSearch
    })

    rows = [...rows].sort((a, b) => {
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name)
      if (sortBy === 'pending-desc') return (b.pendingPayment || 0) - (a.pendingPayment || 0)
      if (sortBy === 'purchases-desc') return (b.totalPurchases || 0) - (a.totalPurchases || 0)
      return a.name.localeCompare(b.name)
    })

    return rows
  }, [customers, search, statusFilter, typeFilter, sortBy])

  const paged = paginate(filtered, page, 10)

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormErrors({})
    resetIdPhoto()
    setModalOpen(true)
  }

  const openEdit = (customer) => {
    setEditing(customer)
    setForm({
      name: customer.name || '',
      companyName: customer.companyName || customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      city: customer.city || '',
      customerType: customer.customerType || 'Company',
      status: customer.status || 'Active',
      notes: customer.notes || '',
      idNumber: customer.idNumber || '',
    })
    setFormErrors({})
    resetIdPhoto()
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const nextErrors = validateCustomerForm(form)
    setFormErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSaving(true)
    try {
      const payload = {
        ...form,
        companyName: form.companyName.trim() || form.name.trim(),
      }
      const result = editing ? await updateCustomer(editing.id, payload) : await addCustomer(payload)
      success(result.message || (editing ? 'Customer updated successfully.' : 'Customer created successfully.'))

      const savedId = result.customer?.id ?? editing?.id
      if (savedId && (idPhotoFile || removeIdPhoto)) {
        try {
          if (idPhotoFile) await uploadCustomerIdPhoto(savedId, idPhotoFile)
          else await removeCustomerIdPhoto(savedId)
        } catch (photoErr) {
          toastError(
            getApiErrorMessage(photoErr, 'Customer was saved, but the ID photo could not be updated. Please try again.')
          )
        }
      }
      resetIdPhoto()
      setModalOpen(false)
    } catch (err) {
      const fieldErrors = getApiValidationErrors(err)
      if (Object.keys(fieldErrors).length) {
        setFormErrors({
          name: fieldErrors.name,
          email: fieldErrors.email,
          phone: fieldErrors.phone,
          companyName: fieldErrors.company_name,
          customerType: fieldErrors.customer_type,
          status: fieldErrors.status,
          address: fieldErrors.address,
          city: fieldErrors.city,
          notes: fieldErrors.notes,
          idNumber: fieldErrors.id_number,
        })
      }
      toastError(getApiErrorMessage(err, 'Unable to save customer. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const result = await deleteCustomer(deleteId)
      success(result.message || 'Customer deleted successfully.')
      setDeleteId(null)
    } catch (err) {
      toastError(
        getApiErrorMessage(
          err,
          'This customer cannot be deleted because related transactions already exist.'
        )
      )
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (r) => (
        <div>
          <Link to={`/customers/${r.id}`} className="font-medium text-brand-600 hover:underline">
            {r.name}
          </Link>
          {r.customerCode ? <p className="text-xs text-slate-400">{r.customerCode}</p> : null}
        </div>
      ),
    },
    { key: 'customerType', label: 'Type' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'address', label: 'Address', className: 'max-w-[180px] truncate' },
    { key: 'totalPurchases', label: 'Purchases', render: (r) => formatCurrency(r.totalPurchases) },
    { key: 'totalRentals', label: 'Rentals' },
    { key: 'pendingPayment', label: 'Pending', render: (r) => formatCurrency(r.pendingPayment) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex gap-1">
          <Link to={`/customers/${r.id}`} className="btn-secondary !px-2 !py-1">
            <Eye size={14} />
          </Link>
          <button type="button" className="btn-secondary !px-2 !py-1" onClick={() => openEdit(r)}>
            <Edit2 size={14} />
          </button>
          <button type="button" className="btn-danger !px-2 !py-1" onClick={() => setDeleteId(r.id)}>
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="page-shell">
      <PageHeader
        title="Customers"
        subtitle="Manage client accounts, purchases, and rental history"
        breadcrumbs={[{ label: 'Customers' }]}
        actions={
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus size={16} aria-hidden />
            Add Customer
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Customers" value={stats.total} icon={Users} tone="brand" />
        <StatCard title="Active" value={stats.active} icon={Users} tone="green" />
        <StatCard title="Pending Payments" value={formatCurrency(stats.pending)} icon={Users} tone="red" />
        <StatCard title="Total Purchases" value={formatCurrency(stats.purchases)} icon={Users} tone="blue" />
      </div>

      <div className="flex flex-wrap gap-3">
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search name, email, phone..."
          className="min-w-[240px] flex-1"
        />
        <FilterDropdown
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
          options={STATUS_OPTIONS}
          className="w-40"
        />
        <FilterDropdown
          value={typeFilter}
          onChange={(v) => {
            setTypeFilter(v)
            setPage(1)
          }}
          options={TYPE_OPTIONS}
          className="w-40"
        />
        <FilterDropdown
          value={sortBy}
          onChange={(v) => {
            setSortBy(v)
            setPage(1)
          }}
          options={SORT_OPTIONS}
          className="w-48"
        />
      </div>

      <div className="card">
        {customersLoading ? (
          <LoadingState label="Loading customers..." />
        ) : customersError ? (
          <ApiErrorState
            title="Unable to load customers."
            message={customersError}
            onRetry={loadCustomers}
          />
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No customers found."
              description="Add your first customer to get started."
              action={
                <button type="button" className="btn-primary" onClick={openCreate}>
                  <Plus size={16} /> Add Customer
                </button>
              }
            />
          </div>
        ) : (
          <>
            <DataTable columns={columns} data={paged.data} emptyTitle="No customers found." />
            <div className="px-4">
              <Pagination
                page={paged.page}
                totalPages={paged.totalPages}
                total={paged.total}
                onChange={setPage}
              />
            </div>
          </>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? 'Edit Customer' : 'Add Customer'}
        size="lg"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" form="customer-form" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Customer'}
            </button>
          </>
        }
      >
        <form id="customer-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Customer Name</label>
            <input
              className="input-field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            {formErrors.name ? <p className="mt-1 text-xs text-rose-600">{formErrors.name}</p> : null}
          </div>
          <div>
            <label className="label">Company Name</label>
            <input
              className="input-field"
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              placeholder="Optional — defaults to customer name"
            />
            {formErrors.companyName ? (
              <p className="mt-1 text-xs text-rose-600">{formErrors.companyName}</p>
            ) : null}
          </div>
          <div>
            <label className="label">Customer Type</label>
            <select
              className="input-field"
              value={form.customerType}
              onChange={(e) => setForm({ ...form, customerType: e.target.value })}
            >
              <option value="Company">Company</option>
              <option value="Individual">Individual</option>
            </select>
            {formErrors.customerType ? (
              <p className="mt-1 text-xs text-rose-600">{formErrors.customerType}</p>
            ) : null}
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              className="input-field"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            {formErrors.phone ? <p className="mt-1 text-xs text-rose-600">{formErrors.phone}</p> : null}
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input-field"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            {formErrors.email ? <p className="mt-1 text-xs text-rose-600">{formErrors.email}</p> : null}
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address</label>
            <AddressAutocomplete
              className="input-field"
              value={form.address}
              onChange={(address) => setForm((f) => ({ ...f, address }))}
              onSelect={(item) =>
                setForm((f) => (f.city?.trim() || !item.city ? f : { ...f, city: item.city }))
              }
              savedAddresses={savedAddresses}
            />
          </div>
          <div>
            <label className="label">City</label>
            <input
              className="input-field"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input-field"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea
              className="input-field min-h-[80px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional notes..."
            />
          </div>
          <div>
            <label className="label">ID Number</label>
            <input
              className="input-field"
              value={form.idNumber}
              onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
              placeholder="Optional"
              maxLength={100}
              autoComplete="off"
            />
            {formErrors.idNumber ? <p className="mt-1 text-xs text-rose-600">{formErrors.idNumber}</p> : null}
          </div>
          <div>
            <label className="label">ID Photo</label>
            <div className="flex items-start gap-3">
              {idPhotoPreview ? (
                <img
                  src={idPhotoPreview}
                  alt="Selected ID"
                  className="h-20 w-28 rounded-lg border border-slate-200 bg-slate-50 object-contain p-1 dark:border-slate-700 dark:bg-slate-800"
                />
              ) : editing?.hasIdPhoto && !removeIdPhoto ? (
                <CustomerIdPhoto customerId={editing.id} className="h-20 w-28" />
              ) : null}
              <div className="flex flex-col gap-2">
                <label className="btn-secondary cursor-pointer !py-1.5 text-sm">
                  <Upload size={14} aria-hidden />
                  {idPhotoPreview || (editing?.hasIdPhoto && !removeIdPhoto) ? 'Replace' : 'Upload'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={handleIdPhotoChange}
                    disabled={saving}
                  />
                </label>
                {idPhotoPreview ? (
                  <button type="button" className="btn-secondary !py-1.5 text-sm" onClick={() => setIdPhotoFile(null)}>
                    <X size={14} aria-hidden /> Clear
                  </button>
                ) : editing?.hasIdPhoto && !removeIdPhoto ? (
                  <button type="button" className="btn-danger !py-1.5 text-sm" onClick={() => setRemoveIdPhoto(true)}>
                    <Trash2 size={14} aria-hidden /> Remove
                  </button>
                ) : null}
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {removeIdPhoto ? 'The current ID photo will be removed when you save.' : 'Optional · JPG, PNG or WEBP, up to 5 MB'}
            </p>
            {formErrors.idPhoto ? <p className="mt-1 text-xs text-rose-600">{formErrors.idPhoto}</p> : null}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => !deleting && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Customer?"
        message="This action cannot be undone. If the customer has related transactions, they will be set to Inactive instead."
        confirmText={deleting ? 'Working...' : 'Delete'}
        danger
        loading={deleting}
      />
    </div>
  )
}
