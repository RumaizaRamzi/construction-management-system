import { Fragment, useState } from 'react'
import { ChevronDown, ChevronUp, History } from 'lucide-react'
import ProductImage from '../ui/ProductImage'
import Modal from '../ui/Modal'
import RentalStatusBadge from './RentalStatusBadge'
import { formatCurrency, formatDate } from '../../utils/helpers'
import { getProductRentalUsage } from '../../utils/rentalHelpers'

export default function RentalHistory({ rentals = [], products = [] }) {
  const usage = getProductRentalUsage(rentals, products)
  const [expandedId, setExpandedId] = useState(null)
  const [modalProduct, setModalProduct] = useState(null)

  const sorted = [...usage].sort((a, b) => b.rentalCount - a.rentalCount)

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90">
                {['Product', 'Rentals', 'Total Days', 'Income', 'Currently Rented', 'Last Rented', 'History'].map(
                  (label) => (
                    <th
                      key={label}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap"
                    >
                      {label}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sorted.map((row) => (
                <Fragment key={row.productId}>
                  <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ProductImage src={row.image} alt={row.productName} className="h-10 w-10 shrink-0" />
                        <span className="font-medium text-slate-900 dark:text-white">{row.productName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{row.rentalCount}</td>
                    <td className="px-4 py-3">{row.rentalDays}</td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(row.rentalIncome)}</td>
                    <td className="px-4 py-3">{row.currentlyRented}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.lastRented ? formatDate(row.lastRented) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-secondary !py-1 !px-2 text-xs"
                          onClick={() =>
                            setExpandedId((id) => (id === row.productId ? null : row.productId))
                          }
                        >
                          {expandedId === row.productId ? (
                            <>
                              <ChevronUp size={14} /> Hide
                            </>
                          ) : (
                            <>
                              <ChevronDown size={14} /> Expand
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary !py-1 !px-2 text-xs"
                          onClick={() => setModalProduct(row)}
                        >
                          <History size={14} /> View All
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === row.productId && row.history.length > 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-3 bg-slate-50/50 dark:bg-slate-900/40">
                        <div className="space-y-2">
                          {row.history.slice(0, 5).map((r) => (
                            <div
                              key={r.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                            >
                              <div>
                                <span className="font-medium">{r.rentalId}</span>
                                <span className="text-slate-500"> — {r.customer}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-slate-500">
                                  {formatDate(r.startDate)} → {formatDate(r.expectedReturn)}
                                </span>
                                <RentalStatusBadge status={r.rentalStatus} />
                                <span className="font-medium">{formatCurrency(r.total)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={Boolean(modalProduct)}
        onClose={() => setModalProduct(null)}
        title={modalProduct ? `Rental History — ${modalProduct.productName}` : ''}
        size="lg"
      >
        {modalProduct && (
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {modalProduct.history.length === 0 ? (
              <p className="text-sm text-slate-500">No rental history for this product.</p>
            ) : (
              modalProduct.history.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{r.rentalId}</p>
                    <p className="text-slate-500">{r.customer}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-500">
                      {formatDate(r.startDate)} — {formatDate(r.expectedReturn)} ({r.duration} days)
                    </p>
                    <div className="mt-1 flex items-center justify-end gap-2">
                      <RentalStatusBadge status={r.rentalStatus} />
                      <span className="font-medium">{formatCurrency(r.total)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
