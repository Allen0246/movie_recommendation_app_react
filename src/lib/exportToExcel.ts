import * as XLSX from 'xlsx'

export function exportToExcel<T extends Record<string, unknown>>(
  rows: T[],
  sheetName: string,
  filenamePrefix: string,
) {
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14)
  XLSX.writeFile(workbook, `${filenamePrefix}_${timestamp}.xlsx`)
}
