import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Tags,
  History,
  ShoppingCart,
  FileText,
  KeyRound,
  CalendarCheck,
  Undo2,
  Users,
  Truck,
  TrendingUp,
  Wallet,
  Wrench,
  AlarmClock,
  CalendarDays,
  BarChart3,
  Bell,
  Settings,
  Shield,
  ShieldCheck,
  ScrollText,
  X,
  ChevronDown,
  Tractor,
  CirclePlus,
  FileSearch,
  ShoppingBag,
  UserCog,
  UserPlus,
  BadgeCheck,
  SlidersHorizontal,
  Landmark,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useApp } from '../../contexts/AppContext'
import BrandLogo from '../ui/BrandLogo'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  {
    label: 'Inventory',
    icon: Package,
    permissions: ['products.view', 'categories.view', 'purchases.view'],
    children: [
      { to: '/products', label: 'Products', icon: Package, permissions: ['products.view'] },
      { to: '/categories', label: 'Categories', icon: Tags, permissions: ['categories.view', 'products.view'] },
      { to: '/purchases', label: 'Purchases', icon: ShoppingBag, permissions: ['purchases.view'] },
      { to: '/stock-history', label: 'Stock History', icon: History, permissions: ['products.view'] },
    ],
  },
  {
    label: 'Sales',
    icon: ShoppingCart,
    permissions: ['sales.view'],
    children: [
      { to: '/sales', label: 'Sales', icon: ShoppingCart, permissions: ['sales.view'] },
      { to: '/invoices', label: 'Invoices', icon: FileText, permissions: ['sales.view'] },
    ],
  },
  {
    label: 'Rentals',
    icon: KeyRound,
    permissions: ['rentals.view', 'bookings.view'],
    children: [
      { to: '/rentals', label: 'Rentals', icon: KeyRound, permissions: ['rentals.view'] },
      { to: '/bookings', label: 'Bookings', icon: CalendarCheck, permissions: ['bookings.view'] },
      { to: '/returns', label: 'Returns', icon: Undo2, permissions: ['rentals.view', 'rentals.return'] },
      { to: '/calendar', label: 'Calendar', icon: CalendarDays, permissions: ['bookings.view', 'rentals.view'] },
    ],
  },
  {
    label: 'Vehicles',
    icon: Tractor,
    permissions: ['vehicles.view'],
    children: [
      { to: '/vehicles', label: 'All Vehicles', icon: Tractor, permissions: ['vehicles.view'], end: true },
      { to: '/vehicles/new', label: 'Add Vehicle', icon: CirclePlus, permissions: ['vehicles.create'] },
      { to: '/vehicles/rentals', label: 'Vehicle Rental', icon: KeyRound, permissions: ['vehicles.view'] },
      { to: '/vehicles/maintenance', label: 'Maintenance', icon: Wrench, permissions: ['vehicles.view'] },
      { to: '/vehicles/details', label: 'Vehicle Details', icon: FileSearch, permissions: ['vehicles.view'] },
    ],
  },
  {
    label: 'Staff',
    icon: UserCog,
    permissions: ['staff.view', 'staff.create', 'staff.attendance'],
    children: [
      { to: '/staff', label: 'All Staff', icon: Users, permissions: ['staff.view'], end: true },
      { to: '/staff/create', label: 'Add Staff', icon: UserPlus, permissions: ['staff.create'] },
      { to: '/staff/attendance', label: 'Attendance', icon: CalendarCheck, permissions: ['staff.attendance', 'staff.view'] },
    ],
  },
  { to: '/customers', label: 'Customers', icon: Users, permissions: ['customers.view'] },
  { to: '/suppliers', label: 'Suppliers', icon: Truck, permissions: ['suppliers.view'] },
  {
    label: 'Finance',
    icon: Wallet,
    permissions: ['income.view', 'expenses.view', 'cheques.view'],
    children: [
      { to: '/income', label: 'Income', icon: TrendingUp, permissions: ['income.view'] },
      { to: '/expenses', label: 'Expenses', icon: Wallet, permissions: ['expenses.view'] },
      { to: '/cheques', label: 'Cheques', icon: Landmark, permissions: ['cheques.view'] },
    ],
  },
  {
    label: 'Operations',
    icon: Wrench,
    permissions: ['checks.view', 'maintenance.view', 'notifications.view'],
    children: [
      { to: '/maintenance', label: 'Maintenance', icon: Wrench, permissions: ['maintenance.view'] },
      { to: '/reminders', label: 'Reminders', icon: AlarmClock, permissions: ['checks.view', 'notifications.view'] },
    ],
  },
  { to: '/reports', label: 'Reports', icon: BarChart3, permissions: ['reports.view'] },
  { to: '/notifications', label: 'Notifications', icon: Bell, permissions: ['notifications.view'] },
  {
    label: 'History',
    icon: ScrollText,
    permissions: ['activity.view', 'audit.view'],
    children: [
      { to: '/activity', label: 'Activity History', icon: History, permissions: ['activity.view'] },
      { to: '/audit-logs', label: 'Audit Logs', icon: ShieldCheck, permissions: ['audit.view'] },
    ],
  },
  { to: '/settings', label: 'My Settings', icon: Settings },
  {
    label: 'Administration',
    icon: Shield,
    adminOnly: true,
    children: [
      { to: '/admin/users', label: 'Users & Logins', icon: UserCog },
      { to: '/admin/roles', label: 'Roles & Permissions', icon: BadgeCheck },
      { to: '/admin/activity-logs', label: 'Activity Logs', icon: ScrollText },
      { to: '/admin/settings', label: 'Settings', icon: SlidersHorizontal },
    ],
  },
]

function itemAllowed(item, canAny) {
  if (!item.permissions?.length) return true
  return canAny(item.permissions)
}

function NavItem({ item, onNavigate }) {
  const Icon = item.icon
  if (item.children) {
    return <NavGroup item={item} onNavigate={onNavigate} />
  }
  return (
    <NavLink
      to={item.to}
      end={item.to === '/' || item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-sidebar-active text-white'
            : 'text-slate-300 hover:bg-sidebar-hover hover:text-white'
        }`
      }
    >
      <Icon size={18} aria-hidden />
      <span>{item.label}</span>
    </NavLink>
  )
}

function NavGroup({ item, onNavigate }) {
  const [open, setOpen] = useState(true)
  const Icon = item.icon
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-sidebar-hover hover:text-white"
        aria-expanded={open}
      >
        <Icon size={18} aria-hidden />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="ml-3 mt-1 space-y-1 border-l border-slate-700 pl-3">
          {item.children.map((child) => (
            <NavItem key={child.to} item={child} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ open, onClose }) {
  const { canAny, user, isAdmin } = useApp()

  const visibleNav = useMemo(() => {
    return nav
      .map((item) => {
        if (item.adminOnly && !isAdmin) return null
        if (item.children) {
          const children = item.children.filter((child) => itemAllowed(child, canAny))
          if (!children.length) return null
          return { ...item, children }
        }
        if (!itemAllowed(item, canAny)) return null
        return item
      })
      .filter(Boolean)
  }, [canAny, isAdmin])

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/50 lg:hidden ${open ? 'block' : 'hidden'}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 flex w-[min(18rem,100vw)] flex-col bg-sidebar text-white transition-transform duration-200 lg:static lg:w-72 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-700/80 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo className="h-11 w-11 p-0.5" />
            <div className="min-w-0">
              <p className="font-display text-sm font-bold leading-tight">RN TRADING LANKA PVT. LTD</p>
              <p className="truncate text-[11px] text-gold-400">{user?.role || 'Construction Management'}</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 hover:bg-sidebar-hover lg:hidden"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {visibleNav.map((item) => (
            <NavItem key={item.label} item={item} onNavigate={onClose} />
          ))}
        </nav>

        <div className="border-t border-slate-700/80 p-4 text-xs text-slate-400">
          RN TRADING LANKA PVT. LTD · Construction Management
        </div>
      </aside>
    </>
  )
}
