import { Loader2 } from 'lucide-react'
import { cn } from '../../utils/helpers'

const variants = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  success: 'btn-success',
}

/**
 * Shared button with loading + accessible label support.
 */
export default function Button({
  children,
  variant = 'primary',
  type = 'button',
  loading = false,
  disabled = false,
  className,
  icon: Icon,
  'aria-label': ariaLabel,
  ...rest
}) {
  return (
    <button
      type={type}
      className={cn(variants[variant] || variants.primary, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : Icon ? <Icon size={16} aria-hidden /> : null}
      {children}
    </button>
  )
}
