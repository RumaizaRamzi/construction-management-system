import { useLayoutEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    // 'instant' overrides the global smooth scroll so a new page opens at the top without animating.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 px-3 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6 print:p-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
