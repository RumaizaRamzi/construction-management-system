import logo from '../../assets/logo.jpg'

export const BRAND_LOGO_URL = logo

export default function BrandLogo({ className = 'h-10 w-10', alt = 'RN Trading Lanka (Pvt) Ltd logo' }) {
  return (
    <img
      src={logo}
      alt={alt}
      className={`shrink-0 rounded-xl bg-white object-contain ${className}`}
      draggable={false}
    />
  )
}
