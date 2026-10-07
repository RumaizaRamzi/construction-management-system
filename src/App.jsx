import AppRoutes from './routes/AppRoutes'
import { AppProvider } from './contexts/AppContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import ErrorBoundary from './components/ui/ErrorBoundary'
import OfflineBanner from './components/ui/OfflineBanner'

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppProvider>
          <ToastProvider>
            <OfflineBanner />
            <AppRoutes />
          </ToastProvider>
        </AppProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
