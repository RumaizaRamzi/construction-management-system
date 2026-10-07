import { useState } from 'react'

const PLACEHOLDER = '/images/product-1.svg'

export default function ProductImage({ src, alt, className = 'h-12 w-12', width, height }) {
  const [failed, setFailed] = useState(false)
  const resolved = !src || failed ? PLACEHOLDER : src

  return (
    <img
      src={resolved}
      alt={alt || 'Product'}
      className={`rounded-lg object-cover bg-slate-100 dark:bg-slate-800 ${className}`}
      loading="lazy"
      decoding="async"
      width={width}
      height={height}
      onError={() => setFailed(true)}
    />
  )
}
