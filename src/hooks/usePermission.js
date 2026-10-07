import { useApp } from '../contexts/AppContext'

/** Convenience helpers for permission checks in UI components. */
export function usePermission() {
  const { can, canAny, canAll, permissions, user } = useApp()
  return { can, canAny, canAll, permissions, user, role: user?.role }
}

export default usePermission
