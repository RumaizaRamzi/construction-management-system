/**
 * Client-side report exports without extra dependencies.
 * A sheet is `{ name, columns: [{ key, label, value?: (row) => any }], rows: [] }`.
 */

const cellValue = (row, column) => {
  const raw = typeof column.value === 'function' ? column.value(row) : row?.[column.key]
  return raw === null || raw === undefined ? '' : raw
}

const csvEscape = (value) => {
  let text = String(value)
  // Neutralise spreadsheet formula injection for text cells.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const xmlEscape = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')

const safeFileName = (name) =>
  String(name || 'report')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'report'

const triggerDownload = (filename, blob) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const buildCsv = (sheet) => {
  const header = sheet.columns.map((c) => csvEscape(c.label)).join(',')
  const body = (sheet.rows || []).map((row) => sheet.columns.map((c) => csvEscape(cellValue(row, c))).join(','))
  return [header, ...body].join('\r\n')
}

export const exportCsv = (filename, sheet) => {
  triggerDownload(`${safeFileName(filename)}.csv`, new Blob(['\uFEFF', buildCsv(sheet)], { type: 'text/csv;charset=utf-8' }))
}

const sheetXml = (sheet) => {
  const name = xmlEscape(String(sheet.name || 'Sheet').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31))
  const header = `<Row>${sheet.columns
    .map((c) => `<Cell ss:StyleID="h"><Data ss:Type="String">${xmlEscape(c.label)}</Data></Cell>`)
    .join('')}</Row>`
  const rows = (sheet.rows || [])
    .map(
      (row) =>
        `<Row>${sheet.columns
          .map((c) => {
            const value = cellValue(row, c)
            const isNumber = typeof value === 'number' && Number.isFinite(value)
            return `<Cell><Data ss:Type="${isNumber ? 'Number' : 'String'}">${xmlEscape(value)}</Data></Cell>`
          })
          .join('')}</Row>`
    )
    .join('')
  return `<Worksheet ss:Name="${name}"><Table>${header}${rows}</Table></Worksheet>`
}

export const exportExcel = (filename, sheets) => {
  const list = (Array.isArray(sheets) ? sheets : [sheets]).filter(Boolean)
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    '<Styles><Style ss:ID="h"><Font ss:Bold="1"/></Style></Styles>' +
    list.map(sheetXml).join('') +
    '</Workbook>'
  triggerDownload(`${safeFileName(filename)}.xls`, new Blob([xml], { type: 'application/vnd.ms-excel' }))
}
