import { useMemo, useState } from 'react'
import { Edit2, Plus, Tags, Trash2 } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import SearchBar from '../../components/ui/SearchBar'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import StatCard from '../../components/ui/StatCard'
import LoadingState from '../../components/ui/LoadingState'
import EmptyState from '../../components/ui/EmptyState'
import ApiErrorState from '../../components/ui/ApiErrorState'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage } from '../../services/api'

const emptyForm = { name: '', description: '', productCount: 0 }

export default function Categories() {
  const {
    categories,
    products,
    categoriesLoading,
    categoriesError,
    loadCategories,
    productsLoading,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useApp()
  const { success, error: toastError } = useToast()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  const enriched = useMemo(
    () =>
      categories.map((cat) => ({
        ...cat,
        productCount: products.filter((p) => Number(p.categoryId) === Number(cat.id)).length,
      })),
    [categories, products]
  )

  const stats = useMemo(() => ({
    total: categories.length,
    products: products.length,
    avgPerCategory: categories.length ? Math.round(products.length / categories.length) : 0,
  }), [categories, products])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return enriched
    return enriched.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
    )
  }, [enriched, search])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (category) => {
    setEditing(category)
    setForm({ name: category.name, description: category.description || '', productCount: category.productCount })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toastError('Category name is required.')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const { message } = await updateCategory(editing.id, {
          name: form.name.trim(),
          description: form.description,
        })
        success(message || 'Category updated.')
      } else {
        const { message } = await addCategory({
          name: form.name.trim(),
          description: form.description,
          status: 'Active',
        })
        success(message || 'Category created.')
      }
      setModalOpen(false)
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to save category.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const result = await deleteCategory(deleteTarget.id)
      success(result.message || 'Category deleted.')
      setDeleteTarget(null)
    } catch (error) {
      toastError(getApiErrorMessage(error, 'Unable to delete category.'))
    }
  }

  const columns = [
    { key: 'name', label: 'Category' },
    { key: 'description', label: 'Description', className: 'max-w-[300px]' },
    { key: 'productCount', label: 'Products' },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex gap-1">
          <button type="button" className="btn-secondary !px-2 !py-1" onClick={() => openEdit(r)}>
            <Edit2 size={14} />
          </button>
          <button type="button" className="btn-danger !px-2 !py-1" onClick={() => setDeleteTarget(r)}>
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ]

  const loading = categoriesLoading || productsLoading

  return (
    <div className="page-shell">
      <PageHeader
        title="Categories"
        subtitle="Organize inventory into product groups"
        breadcrumbs={[{ label: 'Categories' }]}
        actions={
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus size={16} />
            Add Category
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Categories" value={stats.total} icon={Tags} tone="brand" />
        <StatCard title="Total Products" value={stats.products} icon={Tags} tone="blue" />
        <StatCard title="Avg per Category" value={stats.avgPerCategory} icon={Tags} tone="green" />
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Search categories..." className="max-w-md" />

      {loading ? (
        <div className="card">
          <LoadingState label="Loading categories..." />
        </div>
      ) : categoriesError ? (
        <div className="card">
          <ApiErrorState
            title="Unable to load categories. Please try again."
            message={categoriesError}
            onRetry={loadCategories}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-4">
          <EmptyState title="No categories available." description="Create categories to organize your inventory." />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((cat) => (
              <div key={cat.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{cat.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">{cat.description}</p>
                  </div>
                  <span className="rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 px-2.5 py-0.5 text-xs font-medium">
                    {cat.productCount} items
                  </span>
                </div>
                <button type="button" className="btn-secondary mt-4 w-full text-xs" onClick={() => openEdit(cat)}>
                  Edit Category
                </button>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-4">
              <h3 className="font-display font-semibold">All Categories</h3>
            </div>
            <DataTable
              columns={columns}
              data={filtered}
              emptyTitle="No categories available."
              emptyDescription="Create categories to organize your inventory."
            />
          </div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? 'Edit Category' : 'Add Category'}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" form="category-form" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Category'}
            </button>
          </>
        }
      >
        <form id="category-form" onSubmit={handleSubmit} className="grid gap-4">
          <div>
            <label className="label">Name</label>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input-field min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description of this category..." />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete category"
        message={
          deleteTarget?.productCount > 0
            ? `“${deleteTarget?.name}” has ${deleteTarget.productCount} product(s). Deletion will be blocked if they are still assigned.`
            : `Delete category “${deleteTarget?.name}”?`
        }
        confirmText="Delete"
        danger
      />
    </div>
  )
}
