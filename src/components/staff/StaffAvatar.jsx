import { initials, useStaffPhoto } from '../../utils/staffHelpers'

const SIZES = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-24 w-24 text-2xl',
}

/** Staff photo loaded through the authenticated API, falling back to initials. */
export default function StaffAvatar({ staff, size = 'sm', version = 0, previewUrl = null }) {
  const photoUrl = useStaffPhoto(previewUrl ? null : staff?.id, !previewUrl && staff?.hasPhoto, version)
  const src = previewUrl || photoUrl
  const box = SIZES[size] || SIZES.sm

  if (src) {
    return <img src={src} alt={staff?.fullName || 'Staff photo'} className={`${box} shrink-0 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700`} />
  }

  return (
    <span className={`${box} inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300`} aria-hidden>
      {initials(staff?.fullName)}
    </span>
  )
}
