import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page, totalPages, onChange, total }) {
  if (totalPages <= 1) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3">
      <p className="text-sm text-slate-500">
        Page {page} of {totalPages}
        {typeof total === 'number' && ` · ${total} records`}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-secondary !px-3"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          className="btn-secondary !px-3"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
