export const formatCurrency = (amount, currency = 'LKR') => {
  const value = Number(amount) || 0
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export const formatDate = (date) => {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

/** DD/MM/YYYY for booking/calendar displays */
export const formatDateDMY = (date) => {
  if (!date) return '—'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export const formatDateTime = (date) => {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export const cn = (...classes) => classes.filter(Boolean).join(' ')

export const daysBetween = (start, end) => {
  const s = new Date(start)
  const e = new Date(end)
  const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24))
  return Math.max(diff, 0)
}

export const paginate = (items, page = 1, pageSize = 10) => {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(page, 1), totalPages)
  const start = (current - 1) * pageSize
  return {
    data: items.slice(start, start + pageSize),
    page: current,
    pageSize,
    total,
    totalPages,
  }
}

export const downloadTextFile = (filename, content, mime = 'text/plain') => {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
