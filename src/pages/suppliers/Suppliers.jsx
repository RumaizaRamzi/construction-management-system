import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Edit2, Eye, Plus, Trash2, Truck } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SearchBar from '../../components/ui/SearchBar'
import DataTable from '../../components/ui/DataTable'
import Pagination from '../../components/ui/Pagination'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import StatCard from '../../components/ui/StatCard'
import LoadingState from '../../components/ui/LoadingState'
import EmptyState from '../../components/ui/EmptyState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage } from '../../services/api'
import { formatCurrency, paginate } from '../../utils/helpers'

const emptyForm = {
  name: '',
  contact: '',
  email: '',
  phone: '',
  productsSupplied: '',
  purchaseHistory: 0,
  outstanding: 0,
}

export default function Suppliers() {
  const {
    suppliers,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    suppliersLoading,
    suppliersError,
    loadSuppliers,
  } = useApp()
  const { success, error: toastError } = useToast()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const stats = useMemo(() => ({
    total: suppliers.length,
    purchaseVolume: suppliers.reduce((sum, s) => sum + (s.purchaseHistory || 0), 0),
    outstanding: suppliers.reduce((sum, s) => sum + (s.outstanding || 0), 0),
    withBalance: suppliers.filter((s) => s.outstanding > 0).length,
  }), [suppliers])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return suppliers
    return suppliers.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.contact?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.productsSupplied?.toLowerCase().includes(q) ||
        s.supplierCode?.toLowerCase().includes(q)
    )
  }, [suppliers, search])

  const paged = paginate(filtered, page, 10)

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (supplier) => {
    setEditing(supplier)
    setForm({
      name: supplier.name || '',
      contact: supplier.contact || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      productsSupplied: supplier.productsSupplied || '',
      purchaseHistory: supplier.purchaseHistory || 0,
      outstanding: supplier.outstanding || 0,
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = {
      name: form.name.trim(),
      contact: form.contact.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      productsSupplied: form.productsSupplied,
      outstanding: Number(form.outstanding) || 0,
    }
    setSaving(true)
    try {
      if (editing) {
        const { message } = await updateSupplier(editing.id, payload)
        success(message || 'Supplier updated.')
      } else {
        const { message } = await addSupplier(payload)
        success(message || 'Supplier created.')
      }
      setModalOpen(false)
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to save supplier.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const result = await deleteSupplier(deleteId)
      success(result.message || 'Supplier removed.')
      setDeleteId(null)
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to delete supplier.'))
    }
  }

  const columns = [
    { key: 'name', label: 'Supplier' },
    { key: 'contact', label: 'Contact Person' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'productsSupplied', label: 'Products Supplied', className: 'max-w-[200px]' },
    { key: 'outstanding', label: 'Outstanding', render: (r) => formatCurrency(r.outstanding) },
    {
      key: 'status',
      label: 'Status',
      render: (r) => r.status || 'Active',
    },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex gap-1">
          <Link to={`/suppliers/${r.id}`} className="btn-secondary !px-2 !py-1" title="View details">
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
        title="Suppliers"
        subtitle="Manage vendor relationships and purchase accounts"
        breadcrumbs={[{ label: 'Suppliers' }]}
        actions={
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus size={16} />
            Add Supplier
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Suppliers" value={stats.total} icon={Truck} tone="brand" />
        <StatCard title="Purchase Volume" value={formatCurrency(stats.purchaseVolume)} icon={Truck} tone="blue" />
        <StatCard title="Outstanding Balance" value={formatCurrency(stats.outstanding)} icon={Truck} tone="red" />
        <StatCard title="With Balance Due" value={stats.withBalance} icon={Truck} tone="violet" />
      </div>

      <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search supplier, contact, products..." className="max-w-md" />

      <div className="card">
        {suppliersLoading ? (
          <LoadingState label="Loading suppliers..." />
        ) : suppliersError ? (
          <ApiErrorState
            title="Unable to load suppliers. Please try again."
            message={suppliersError}
            onRetry={loadSuppliers}
          />
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No suppliers found." description="Add suppliers to track purchasing." />
          </div>
        ) : (
          <>
            <DataTable columns={columns} data={paged.data} emptyTitle="No suppliers found." />
            <div className="px-4">
              <Pagination page={paged.page} totalPages={paged.totalPages} total={paged.total} onChange={setPage} />
            </div>
          </>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? 'Edit Supplier' : 'Add Supplier'}
        size="lg"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" form="supplier-form" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Supplier'}
            </button>
          </>
        }
      >
        <form id="supplier-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Supplier Name</label>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Contact Person</label>
            <input className="input-field" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Email</label>
            <input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Products Supplied</label>
            <input className="input-field" value={form.productsSupplied} onChange={(e) => setForm({ ...form, productsSupplied: e.target.value })} placeholder="Comma-separated product list" />
          </div>
          <div>
            <label className="label">Outstanding Balance</label>
            <input type="number" min="0" className="input-field" value={form.outstanding} onChange={(e) => setForm({ ...form, outstanding: e.target.value })} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete supplier"
        message="Remove this supplier? If linked to products or expenses, it will be deactivated instead."
        confirmText="Delete"
        danger
      />
    </div>
  )
}
