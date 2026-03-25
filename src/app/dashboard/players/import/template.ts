export function generateCSVTemplate(): string {
  const headers = [
    'first_name',
    'last_name',
    'date_of_birth',
    'age_group',
    'parent_email',
    'parent_name',
    'parent_phone',
    'group_name',
    'medical_info',
  ]

  const exampleRows = [
    [
      'John',
      'Smith',
      '15/03/2015',
      'U10',
      'mary.smith@email.com',
      'Mary Smith',
      '0412345678',
      'Monday U10s',
      'Asthma - carries inhaler',
    ],
    [
      'Sarah',
      'Jones',
      '22/07/2014',
      'U12',
      'david.jones@email.com',
      'David Jones',
      '0498765432',
      'Wednesday U12s',
      '',
    ],
  ]

  const lines = [
    headers.join(','),
    ...exampleRows.map((row) => row.map((cell) => (cell.includes(',') ? `"${cell}"` : cell)).join(',')),
  ]

  return lines.join('\n')
}

export function downloadCSVTemplate() {
  const csv = generateCSVTemplate()
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'player_import_template.csv'
  link.click()
  URL.revokeObjectURL(url)
}
