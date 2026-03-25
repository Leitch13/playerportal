/**
 * Convert headers and rows to a CSV string with proper escaping.
 * Includes BOM for Excel compatibility.
 */
export function toCSV(headers: string[], rows: string[][]): string {
  const BOM = '\uFEFF'

  function escapeCell(cell: string): string {
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n') || cell.includes('\r')) {
      return `"${cell.replace(/"/g, '""')}"`
    }
    return cell
  }

  const headerLine = headers.map(escapeCell).join(',')
  const dataLines = rows.map((row) => row.map(escapeCell).join(','))

  return BOM + [headerLine, ...dataLines].join('\r\n')
}
