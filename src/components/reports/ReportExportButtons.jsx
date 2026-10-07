import { useState } from 'react'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import { useToast } from '../../contexts/ToastContext'
import { getApiErrorMessage } from '../../services/api'
import reportService from '../../services/reportService'
import { exportCsv, exportExcel } from '../../utils/exportHelpers'

/**
 * `getSheets` returns the sheets to export; CSV uses the first sheet only.
 * Hidden without reports.export; the backend re-checks the permission before each export.
 */
export default function ReportExportButtons({ filename, getSheets, disabled = false }) {
  const { can } = useApp()
  const { success, error: toastError } = useToast()
  const [busy, setBusy] = useState(false)

  if (!can('reports.export')) return null

  const run = async (kind) => {
    const sheets = (getSheets?.() || []).filter(Boolean)
    if (!sheets.length || !sheets.some((s) => s.rows?.length)) {
      toastError('There is no data to export for the selected filters.')
      return
    }
    setBusy(true)
    try {
      await reportService.authorizeExport(filename, kind)
    } catch (err) {
      toastError(getApiErrorMessage(err, 'You do not have permission to export reports.'))
      setBusy(false)
      return
    }
    try {
      if (kind === 'csv') exportCsv(filename, sheets[0])
      else exportExcel(filename, sheets)
      success(kind === 'csv' ? 'CSV export downloaded.' : 'Excel export downloaded.')
    } catch {
      toastError('Export failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => run('csv')} disabled={disabled || busy}>
        <FileText size={16} />
        CSV
      </button>
      <button type="button" className="btn-secondary" onClick={() => run('excel')} disabled={disabled || busy}>
        <FileSpreadsheet size={16} />
        Excel
      </button>
    </>
  )
}
