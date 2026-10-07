import { cn } from '../../utils/helpers'

export default function NotificationBadge({ count = 0, className }) {
  if (!count) return null
  return (
    <span
      className={cn(
        'absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white',
        className
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
