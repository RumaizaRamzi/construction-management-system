import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import customerService from '../../services/customerService'

/** Loads the ID photo through the authenticated API; the image is never exposed via a public URL. */
export default function CustomerIdPhoto({ customerId, version, className = '', onClick }) {
  const [src, setSrc] = useState(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let objectUrl = null
    let cancelled = false
    setStatus('loading')
    setSrc(null)

    customerService
      .getIdPhotoBlob(customerId)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [customerId, version])

  if (status === 'loading') {
    return <div className={`animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800 ${className}`} aria-label="Loading ID photo" />
  }

  if (status === 'error') {
    return (
      <div className={`flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 dark:border-slate-700 ${className}`}>
        <ImageOff size={18} aria-hidden />
        Unable to load ID photo
      </div>
    )
  }

  const image = <img src={src} alt="Customer ID" className="h-full w-full rounded-lg object-contain" />

  return onClick ? (
    <button
      type="button"
      onClick={() => onClick(src)}
      className={`rounded-lg border border-slate-200 bg-slate-50 p-1 transition-colors hover:border-brand-500 dark:border-slate-700 dark:bg-slate-800 ${className}`}
      title="View full size"
    >
      {image}
    </button>
  ) : (
    <div className={`rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800 ${className}`}>{image}</div>
  )
}
